"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { GameEvent } from "@bgo/sdk";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BOTC_TYPE,
  TB_DISTRIBUTION,
  TROUBLE_BREWING_BY_ID,
  tonightOrder,
  type BotCMove,
  type BotCPhase,
  type BotCView,
  type Character,
  type CharacterTeam,
  type NightStep,
  type ReminderToken,
  type SeatGrimoire,
} from "./shared";

type SendInfoPayload = Extract<BotCMove, { kind: "st.sendInfo" }>["info"];
type OnEvent = (listener: (e: GameEvent) => void) => () => void;

type Send = (move: BotCMove) => Promise<void>;
type SeatPlayer = { id: string; name: string };

const TEAM_LABEL: Record<CharacterTeam, string> = {
  townsfolk: "Townsfolk",
  outsider: "Outsiders",
  minion: "Minions",
  demon: "Demons",
  traveller: "Travellers",
  fabled: "Fabled",
};

const TEAM_TINT: Record<CharacterTeam, string> = {
  townsfolk: "text-info",
  outsider: "text-warning",
  minion: "text-error/80",
  demon: "text-error",
  traveller: "text-base-content/60",
  fabled: "text-secondary",
};

function BotCBoard({
  view,
  players,
  sendMove,
  onEvent,
}: BoardProps<BotCView, BotCMove>) {
  if (view.viewer === "storyteller") {
    return (
      <StorytellerSurface view={view} players={players} sendMove={sendMove} />
    );
  }
  if (view.viewer === "spectator") {
    return <SpectatorPlaceholder view={view} players={players} />;
  }
  return (
    <PlayerSurface
      view={view}
      players={players}
      sendMove={sendMove}
      onEvent={onEvent}
    />
  );
}

// ============================================================================
// Storyteller
// ============================================================================

function StorytellerSurface({
  view,
  players,
  sendMove,
}: {
  view: Extract<BotCView, { viewer: "storyteller" }>;
  players: SeatPlayer[];
  sendMove: Send;
}) {
  const { state } = view;
  if (state.phase === "setup") {
    return <StorytellerSetup state={state} players={players} sendMove={sendMove} />;
  }
  return <StorytellerGrimoire state={state} players={players} sendMove={sendMove} />;
}

function StorytellerSetup({
  state,
  players,
  sendMove,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  players: SeatPlayer[];
  sendMove: Send;
}) {
  const playerById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );

  const scriptCharacters = useMemo(
    () =>
      state.scriptCharacterIds
        .map((id) => TROUBLE_BREWING_BY_ID[id])
        .filter((c): c is Character => Boolean(c)),
    [state.scriptCharacterIds],
  );

  const charactersByTeam = useMemo(() => {
    const groups: Partial<Record<CharacterTeam, Character[]>> = {};
    for (const c of scriptCharacters) {
      (groups[c.team] ??= []).push(c);
    }
    return groups;
  }, [scriptCharacters]);

  // Current draft = whatever is in the grimoire right now (server is the
  // source of truth — every dropdown change autosaves).
  const draft = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const seatId of state.seatOrder) {
      m[seatId] = state.grimoire[seatId]?.characterId ?? null;
    }
    return m;
  }, [state.seatOrder, state.grimoire]);

  const counts = useMemo(() => countByTeam(draft, scriptCharacters), [
    draft,
    scriptCharacters,
  ]);

  const recommended = TB_DISTRIBUTION[state.seatOrder.length] ?? [0, 0, 0, 0];
  const allAssigned = state.seatOrder.every((id) => draft[id]);

  const setSeat = async (seatId: string, characterId: string | null) => {
    const next = { ...draft, [seatId]: characterId };
    const assignments = filterAssignments(next);
    if (Object.keys(assignments).length === 0) return; // never send empty
    await sendMove({ kind: "st.assignCharacters", assignments });
  };

  const autoAssign = async () => {
    const picked = pickBalancedTB(scriptCharacters, state.seatOrder.length);
    if (!picked) return;
    const shuffled = shuffle(picked);
    const next: Record<string, string> = {};
    state.seatOrder.forEach((seatId, i) => {
      next[seatId] = shuffled[i]!.id;
    });
    await sendMove({ kind: "st.assignCharacters", assignments: next });
  };

  const startFirstNight = async () => {
    await sendMove({ kind: "st.advancePhase" });
  };

  return (
    <div className="max-w-3xl w-full flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          Storyteller · setup · script {state.scriptId}
        </span>
        <h2 className="font-display text-2xl tracking-tight">
          Distribute characters
        </h2>
      </header>

      <div className="surface-ivory p-5 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="text-sm text-base-content/70">
            <span className="font-display text-base-content/85 mr-1.5">
              {state.seatOrder.length} players
            </span>
            recommends
            <DistributionStat
              label="T"
              picked={counts.townsfolk}
              target={recommended[0]}
              tint={TEAM_TINT.townsfolk}
            />
            <DistributionStat
              label="O"
              picked={counts.outsider}
              target={recommended[1]}
              tint={TEAM_TINT.outsider}
            />
            <DistributionStat
              label="M"
              picked={counts.minion}
              target={recommended[2]}
              tint={TEAM_TINT.minion}
            />
            <DistributionStat
              label="D"
              picked={counts.demon}
              target={recommended[3]}
              tint={TEAM_TINT.demon}
            />
          </div>
          <button
            type="button"
            className="btn btn-sm rounded-full px-4"
            onClick={autoAssign}
          >
            Auto-assign balanced
          </button>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {state.seatOrder.map((seatId) => {
            const player = playerById[seatId];
            const current = draft[seatId];
            return (
              <li
                key={seatId}
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-base-100/60"
              >
                <span className="font-display text-sm w-32 truncate">
                  {player?.name ?? seatId}
                </span>
                <select
                  className="flex-1 bg-transparent text-sm outline-none"
                  value={current ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    if (v !== current) void setSeat(seatId, v);
                  }}
                >
                  <option value="">— pick —</option>
                  {(["townsfolk", "outsider", "minion", "demon"] as const).map(
                    (team) => {
                      const chars = charactersByTeam[team] ?? [];
                      if (chars.length === 0) return null;
                      return (
                        <optgroup key={team} label={TEAM_LABEL[team]}>
                          {chars.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    },
                  )}
                </select>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        className="btn btn-primary self-end rounded-full px-6"
        onClick={startFirstNight}
        disabled={!allAssigned}
      >
        {allAssigned
          ? "Start the first night →"
          : `Assign ${state.seatOrder.length - countAssigned(draft)} more to start`}
      </button>
    </div>
  );
}

function DistributionStat({
  label,
  picked,
  target,
  tint,
}: {
  label: string;
  picked: number;
  target: number;
  tint: string;
}) {
  const ok = picked === target;
  return (
    <span className="ml-3 inline-flex items-baseline gap-1 font-mono text-sm">
      <span className={`${tint} font-semibold`}>{label}</span>
      <span className={ok ? "text-base-content/85" : "text-base-content/60"}>
        {picked}/{target}
      </span>
    </span>
  );
}

function StorytellerGrimoire({
  state,
  players,
  sendMove,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  players: SeatPlayer[];
  sendMove: Send;
}) {
  const playerById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );

  const livingCount = state.seatOrder.reduce(
    (n, id) => n + (state.grimoire[id]?.isAlive ? 1 : 0),
    0,
  );

  const advance = () => sendMove({ kind: "st.advancePhase" });
  const advanceLabel = phaseAdvanceLabel(state.phase, state.dayNumber);
  const isNight = state.phase === "firstNight" || state.phase === "night";
  const isFinished = state.phase === "finished";
  const [endingMatch, setEndingMatch] = useState(false);

  return (
    <div className="max-w-5xl w-full flex flex-col gap-4">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
            Storyteller · {phaseLabel(state.phase, state.dayNumber)} ·{" "}
            {livingCount}/{state.seatOrder.length} alive
          </span>
          <h2 className="font-display text-2xl tracking-tight">Grimoire</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isFinished && (
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-full border border-base-content/20 text-base-content/65 hover:bg-base-content/5"
              onClick={() => setEndingMatch(true)}
            >
              End match…
            </button>
          )}
          {advanceLabel && (
            <button
              type="button"
              className="btn btn-primary rounded-full px-5"
              onClick={advance}
            >
              {advanceLabel}
            </button>
          )}
        </div>
      </header>

      {isFinished && state.winner && (
        <FinishedBanner winner={state.winner} reason={state.endReason} />
      )}

      {endingMatch && (
        <EndMatchModal
          onConfirm={(winner, reason) => {
            void sendMove({ kind: "st.endMatch", winner, reason });
            setEndingMatch(false);
          }}
          onCancel={() => setEndingMatch(false)}
        />
      )}

      {isNight && (
        <NightOrderPanel
          state={state}
          playerById={playerById}
          sendMove={sendMove}
        />
      )}

      {state.phase === "day" && (
        <NominationsPanel
          nominations={state.nominations}
          openVote={state.openVote}
          grimoire={state.grimoire}
          executions={state.executions}
          seatOrder={state.seatOrder}
          playerById={playerById}
          sendMove={sendMove}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {state.seatOrder.map((seatId) => {
          const seat = state.grimoire[seatId];
          if (!seat) return null;
          return (
            <SeatCard
              key={seatId}
              seatId={seatId}
              seat={seat}
              playerName={playerById[seatId]?.name ?? seatId}
              sendMove={sendMove}
            />
          );
        })}
      </div>
    </div>
  );
}

function NightOrderPanel({
  state,
  playerById,
  sendMove,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  playerById: Record<string, SeatPlayer>;
  sendMove: Send;
}) {
  const isFirstNight = state.phase === "firstNight";
  const order = useMemo(
    () => tonightOrder(state.grimoire, isFirstNight),
    [state.grimoire, isFirstNight],
  );

  if (order.length === 0) {
    return (
      <section className="surface-ivory p-4 text-sm text-base-content/60 italic">
        No characters wake tonight.
      </section>
    );
  }

  const currentIndex = Math.min(state.nightStep, order.length - 1);

  return (
    <section className="surface-ivory p-4 flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg">Night order</h3>
        <span className="text-[11px] text-base-content/55 font-mono">
          step {currentIndex + 1} / {order.length}
        </span>
      </header>
      <ol className="flex flex-col gap-1">
        {order.map((step, i) => (
          <NightOrderItem
            key={step.id}
            step={step}
            index={i}
            isCurrent={i === currentIndex}
            playerById={playerById}
            scriptCharacterIds={state.scriptCharacterIds}
            onSelect={() =>
              void sendMove({ kind: "st.setNightStep", index: i })
            }
            onSendInfo={(target, info) =>
              sendMove({
                kind: "st.sendInfo",
                targetPlayerId: target,
                info,
              })
            }
          />
        ))}
      </ol>
    </section>
  );
}

function NightOrderItem({
  step,
  index,
  isCurrent,
  playerById,
  scriptCharacterIds,
  onSelect,
  onSendInfo,
}: {
  step: NightStep;
  index: number;
  isCurrent: boolean;
  playerById: Record<string, SeatPlayer>;
  scriptCharacterIds: readonly string[];
  onSelect: () => void;
  onSendInfo: (target: string, info: SendInfoPayload) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  // Auto-open when this becomes the active step.
  useEffect(() => {
    if (isCurrent) setOpen(true);
  }, [isCurrent]);

  const seatNames = step.seatIds
    .map((id) => playerById[id]?.name ?? id)
    .join(", ");

  return (
    <li
      className={`px-2 py-1.5 rounded ${
        isCurrent ? "bg-primary/8" : "hover:bg-base-content/4"
      }`}
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[11px] text-base-content/55 w-6 text-right">
          {index + 1}.
        </span>
        <span className="font-display text-sm">{step.label}</span>
        <span className="text-[11px] text-base-content/55 truncate flex-1">
          {seatNames}
        </span>
        <button
          type="button"
          className="text-[11px] px-2 py-0.5 rounded-full bg-base-content/10 hover:bg-base-content/15"
          onClick={() => {
            if (!isCurrent) onSelect();
            setOpen((o) => !o);
          }}
        >
          {open ? "close" : "wake"}
        </button>
      </div>
      {open && (
        <SendInfoForm
          step={step}
          playerById={playerById}
          scriptCharacterIds={scriptCharacterIds}
          onSend={(target, info) => {
            void onSendInfo(target, info);
          }}
        />
      )}
    </li>
  );
}

function SendInfoForm({
  step,
  playerById,
  scriptCharacterIds,
  onSend,
}: {
  step: NightStep;
  playerById: Record<string, SeatPlayer>;
  scriptCharacterIds: readonly string[];
  onSend: (target: string, info: SendInfoPayload) => void;
}) {
  const [target, setTarget] = useState(step.seatIds[0] ?? "");
  const [text, setText] = useState("");
  const [pickedSeats, setPickedSeats] = useState<Set<string>>(new Set());
  const [characterId, setCharacterId] = useState("");
  const [yesNo, setYesNo] = useState<"" | "yes" | "no">("");
  const [number, setNumber] = useState<string>("");

  // When the step changes, reset the dropdown to the first seat.
  useEffect(() => {
    setTarget(step.seatIds[0] ?? "");
  }, [step.id, step.seatIds]);

  const reset = () => {
    setText("");
    setPickedSeats(new Set());
    setCharacterId("");
    setYesNo("");
    setNumber("");
  };

  const buildInfo = (): SendInfoPayload | null => {
    const info: SendInfoPayload = {};
    if (text.trim()) info.text = text.trim().slice(0, 500);
    if (pickedSeats.size > 0) info.seats = Array.from(pickedSeats);
    if (characterId) info.character = characterId;
    if (yesNo) info.yesNo = yesNo === "yes";
    if (number !== "" && Number.isFinite(Number(number))) {
      info.number = Math.max(0, Math.floor(Number(number)));
    }
    return Object.keys(info).length === 0 ? null : info;
  };

  const submit = (sendToAll: boolean) => {
    const info = buildInfo();
    if (!info) return;
    const targets = sendToAll ? step.seatIds : [target];
    for (const t of targets) {
      if (t) onSend(t, info);
    }
    reset();
  };

  const togglePicked = (id: string) => {
    setPickedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSeats = Object.keys(playerById);

  return (
    <div className="ml-8 mt-1.5 p-2.5 border-l border-base-content/15 flex flex-col gap-2 text-xs">
      {step.seatIds.length > 1 && (
        <label className="flex items-center gap-2">
          <span className="text-base-content/60">to:</span>
          <select
            className="bg-transparent border-b border-base-content/15 px-1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {step.seatIds.map((id) => (
              <option key={id} value={id}>
                {playerById[id]?.name ?? id}
              </option>
            ))}
          </select>
        </label>
      )}
      <textarea
        className="bg-transparent border border-base-content/15 rounded px-2 py-1 min-h-[2.25rem] resize-y"
        rows={2}
        maxLength={500}
        placeholder="Whisper to them — e.g. 'One of these is the Investigator.'"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <details className="text-[11px]">
        <summary className="cursor-pointer text-base-content/60">
          structured fields
        </summary>
        <div className="mt-1.5 flex flex-col gap-1.5 pl-2">
          <div className="flex flex-wrap gap-1 items-baseline">
            <span className="text-base-content/55 mr-1">point at:</span>
            {allSeats.map((id) => {
              const on = pickedSeats.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePicked(id)}
                  className={`px-1.5 py-0.5 rounded-full border ${
                    on
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-base-content/15 text-base-content/55"
                  }`}
                >
                  {playerById[id]?.name ?? id}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-base-content/55">character:</span>
            <select
              className="bg-transparent border-b border-base-content/15 px-1 flex-1"
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
            >
              <option value="">—</option>
              {scriptCharacterIds.map((id) => {
                const c = TROUBLE_BREWING_BY_ID[id];
                return (
                  <option key={id} value={id}>
                    {c?.name ?? id}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-base-content/55">yes/no:</span>
              <select
                className="bg-transparent border-b border-base-content/15 px-1"
                value={yesNo}
                onChange={(e) => setYesNo(e.target.value as "yes" | "no" | "")}
              >
                <option value="">—</option>
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-base-content/55">number:</span>
              <input
                type="number"
                min={0}
                className="bg-transparent border-b border-base-content/15 w-12 px-1"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </label>
          </div>
        </div>
      </details>
      <div className="flex items-center gap-2 self-end">
        {step.seatIds.length > 1 && (
          <button
            type="button"
            className="text-[11px] px-2.5 py-1 rounded-full bg-base-content/10 hover:bg-base-content/15"
            onClick={() => submit(true)}
          >
            send to all ({step.seatIds.length})
          </button>
        )}
        <button
          type="button"
          className="text-[11px] px-2.5 py-1 rounded-full bg-primary/15 text-primary hover:bg-primary/25"
          onClick={() => submit(false)}
        >
          send →
        </button>
      </div>
    </div>
  );
}

function FinishedBanner({
  winner,
  reason,
}: {
  winner: "good" | "evil";
  reason: string | null;
}) {
  const tint =
    winner === "good"
      ? "bg-info/15 text-info border-info/35"
      : "bg-error/15 text-error border-error/35";
  return (
    <section
      className={`p-4 rounded-md border flex flex-col gap-1 ${tint}`}
    >
      <span className="text-[10px] uppercase tracking-[0.22em] opacity-80">
        Match ended
      </span>
      <h3 className="font-display text-xl">
        {winner === "good" ? "Good wins" : "Evil wins"}
      </h3>
      {reason && <p className="text-sm opacity-90">{reason}</p>}
    </section>
  );
}

function EndMatchModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (winner: "good" | "evil", reason: string) => void;
  onCancel: () => void;
}) {
  const [winner, setWinner] = useState<"good" | "evil">("good");
  const [reason, setReason] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onConfirm(winner, reason.trim() || "Storyteller called the game.");
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="surface-ivory p-6 max-w-md w-full flex flex-col gap-4"
      >
        <header className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
            End match
          </span>
          <h3 className="font-display text-xl">Who wins?</h3>
        </header>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWinner("good")}
            className={`flex-1 px-3 py-2 rounded-full border ${
              winner === "good"
                ? "bg-info/15 text-info border-info/35"
                : "border-base-content/15 text-base-content/55"
            }`}
          >
            Good wins
          </button>
          <button
            type="button"
            onClick={() => setWinner("evil")}
            className={`flex-1 px-3 py-2 rounded-full border ${
              winner === "evil"
                ? "bg-error/15 text-error border-error/35"
                : "border-base-content/15 text-base-content/55"
            }`}
          >
            Evil wins
          </button>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="How? (e.g. 'Imp executed on day 3', 'town reduced to 2')"
          rows={2}
          maxLength={120}
          className="bg-transparent border border-base-content/15 rounded px-2 py-1 text-sm resize-y"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-full text-sm text-base-content/65 hover:bg-base-content/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary rounded-full px-5"
          >
            End match
          </button>
        </div>
      </form>
    </div>
  );
}

function NominationsPanel({
  nominations,
  openVote,
  grimoire,
  executions,
  seatOrder,
  playerById,
  sendMove,
}: {
  nominations: Extract<BotCView, { viewer: "storyteller" }>["state"]["nominations"];
  openVote: Extract<BotCView, { viewer: "storyteller" }>["state"]["openVote"];
  grimoire: Extract<BotCView, { viewer: "storyteller" }>["state"]["grimoire"];
  executions: Extract<BotCView, { viewer: "storyteller" }>["state"]["executions"];
  seatOrder: readonly string[];
  playerById: Record<string, SeatPlayer>;
  sendMove: Send;
}) {
  const livingCount = seatOrder.reduce(
    (n, id) => n + (grimoire[id]?.isAlive ? 1 : 0),
    0,
  );
  const threshold = Math.ceil(livingCount / 2);

  const closeVote = () => sendMove({ kind: "st.closeVote" });
  const execute = (nomineeId: string) =>
    sendMove({ kind: "st.executeNominee", nomineeId });
  const skip = () => sendMove({ kind: "st.skipExecution" });
  const stOpen = (nominator: string, nominee: string) =>
    sendMove({ kind: "st.openNomination", nominator, nominee });

  const [stNominator, setStNominator] = useState("");
  const [stNominee, setStNominee] = useState("");

  return (
    <section className="surface-ivory p-4 flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-display text-lg">Today's nominations</h3>
        <span className="text-[11px] text-base-content/55 font-mono">
          threshold to put on the block: {threshold} of {livingCount}
        </span>
      </header>

      {executions.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-base-content/55 font-mono">
          {executions.map((e, i) => {
            const charName = e.executed
              ? (TROUBLE_BREWING_BY_ID[
                  grimoire[e.executed]?.characterId ?? ""
                ]?.name ?? "?")
              : null;
            return (
              <li key={i} className="whitespace-nowrap">
                day {e.dayNumber}:{" "}
                {e.executed ? (
                  <>
                    <span className="text-base-content/75">
                      {playerById[e.executed]?.name ?? e.executed}
                    </span>{" "}
                    <span className="text-base-content/45">({charName})</span>
                  </>
                ) : (
                  <span className="italic">no execution</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {nominations.length === 0 ? (
        <p className="text-sm text-base-content/55 italic">
          No nominations yet today.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {nominations.map((n) => {
            const isOpenHere = openVote?.nominationId === n.id;
            const tally = isOpenHere
              ? Object.values(openVote.votes).reduce(
                  (acc, v) => {
                    if (v === "yes") acc.yes++;
                    else acc.no++;
                    return acc;
                  },
                  { yes: 0, no: 0 },
                )
              : null;
            const result = n.result;
            const nomineeAlive = grimoire[n.nominee]?.isAlive ?? false;
            return (
              <li
                key={n.id}
                className={`flex items-baseline gap-2 px-2 py-1.5 rounded text-sm flex-wrap ${
                  result?.onTheBlock
                    ? "bg-error/8"
                    : isOpenHere
                      ? "bg-primary/8"
                      : "hover:bg-base-content/4"
                }`}
              >
                <span className="font-display">
                  {playerById[n.nominator]?.name ?? n.nominator}
                </span>
                <span className="text-base-content/55">→</span>
                <span className="font-display">
                  {playerById[n.nominee]?.name ?? n.nominee}
                </span>
                <span className="flex-1" />
                {tally && (
                  <span className="font-mono text-xs text-base-content/65">
                    voting: {tally.yes} yes / {tally.no} no
                  </span>
                )}
                {result && (
                  <span className="font-mono text-xs">
                    {result.yesCount} yes / {result.noCount} no
                    {result.onTheBlock && (
                      <span className="ml-2 text-error font-display uppercase tracking-[0.18em] text-[10px]">
                        on the block
                      </span>
                    )}
                  </span>
                )}
                {isOpenHere && (
                  <button
                    type="button"
                    className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary hover:bg-primary/25"
                    onClick={() => void closeVote()}
                  >
                    close vote
                  </button>
                )}
                {result && nomineeAlive && (
                  <button
                    type="button"
                    className="text-[11px] px-2 py-0.5 rounded-full bg-error/15 text-error hover:bg-error/25"
                    onClick={() => void execute(n.nominee)}
                  >
                    execute
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!openVote && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-base-content/10 text-xs">
          <span className="text-base-content/55">ST nominate:</span>
          <select
            className="bg-transparent border-b border-base-content/15 px-1"
            value={stNominator}
            onChange={(e) => setStNominator(e.target.value)}
          >
            <option value="">— nominator —</option>
            {seatOrder
              .filter((id) => grimoire[id]?.isAlive)
              .map((id) => (
                <option key={id} value={id}>
                  {playerById[id]?.name ?? id}
                </option>
              ))}
          </select>
          <span className="text-base-content/55">→</span>
          <select
            className="bg-transparent border-b border-base-content/15 px-1"
            value={stNominee}
            onChange={(e) => setStNominee(e.target.value)}
          >
            <option value="">— nominee —</option>
            {seatOrder.map((id) => (
              <option key={id} value={id}>
                {playerById[id]?.name ?? id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!stNominator || !stNominee}
            className="text-[11px] px-2.5 py-1 rounded-full bg-base-content/10 hover:bg-base-content/15 disabled:opacity-40"
            onClick={() => {
              void stOpen(stNominator, stNominee);
              setStNominator("");
              setStNominee("");
            }}
          >
            open
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className="text-[11px] px-2.5 py-1 rounded-full bg-base-content/10 hover:bg-base-content/15"
            onClick={() => void skip()}
          >
            skip execution
          </button>
        </div>
      )}
    </section>
  );
}

function SeatCard({
  seatId,
  seat,
  playerName,
  sendMove,
}: {
  seatId: string;
  seat: SeatGrimoire;
  playerName: string;
  sendMove: Send;
}) {
  const character = seat.characterId
    ? TROUBLE_BREWING_BY_ID[seat.characterId] ?? null
    : null;
  const [reminderDraft, setReminderDraft] = useState("");

  const setAlive = (alive: boolean) =>
    sendMove({ kind: "st.setAlive", seatId, alive });
  const setPoisoned = (poisoned: boolean) =>
    sendMove({ kind: "st.setPoisoned", seatId, poisoned });
  const setDrunk = (drunk: boolean) =>
    sendMove({ kind: "st.setDrunk", seatId, drunk });
  const addReminder = (label: string, characterId?: string) =>
    sendMove({
      kind: "st.addReminder",
      seatId,
      label,
      ...(characterId ? { characterId } : {}),
    });
  const removeReminder = (reminderId: string) =>
    sendMove({ kind: "st.removeReminder", seatId, reminderId });

  const submitDraft = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = reminderDraft.trim();
    if (!trimmed) return;
    void addReminder(trimmed.slice(0, 48));
    setReminderDraft("");
  };

  return (
    <div
      className={`surface-ivory p-3 flex flex-col gap-2 transition-opacity ${
        seat.isAlive ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-sm truncate">{playerName}</span>
        {character ? (
          <span
            className={`font-mono text-[11px] uppercase tracking-wider ${
              TEAM_TINT[character.team]
            }`}
          >
            {character.name}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-base-content/40">—</span>
        )}
      </div>

      {character && (
        <p className="text-xs text-base-content/65 leading-snug line-clamp-3">
          {character.ability}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <Pill
          on={!seat.isAlive}
          tint="error"
          onClick={() => void setAlive(!seat.isAlive)}
        >
          {seat.isAlive ? "alive" : "dead"}
        </Pill>
        <Pill
          on={seat.isPoisoned}
          tint="warning"
          onClick={() => void setPoisoned(!seat.isPoisoned)}
        >
          poisoned
        </Pill>
        <Pill
          on={seat.isDrunk}
          tint="warning"
          onClick={() => void setDrunk(!seat.isDrunk)}
        >
          drunk
        </Pill>
        {!seat.isAlive && (
          <Pill
            on={seat.ghostVoteUsed}
            tint="info"
            onClick={() => {
              /* ghost vote tracked in voting flow, read-only here */
            }}
          >
            {seat.ghostVoteUsed ? "ghost vote used" : "ghost vote"}
          </Pill>
        )}
      </div>

      {seat.reminders.length > 0 && (
        <ul className="flex flex-wrap gap-1 text-[11px]">
          {seat.reminders.map((r) => (
            <ReminderChip key={r.id} reminder={r} onRemove={removeReminder} />
          ))}
        </ul>
      )}

      {character && character.reminders.length > 0 && (
        <div className="flex flex-wrap gap-1 text-[11px]">
          {character.reminders.map((label) => (
            <button
              key={label}
              type="button"
              className="px-1.5 py-0.5 rounded-full border border-base-content/15 text-base-content/60 hover:bg-base-content/5"
              onClick={() => void addReminder(label, character.id)}
            >
              + {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submitDraft} className="flex items-center gap-1.5">
        <input
          type="text"
          value={reminderDraft}
          onChange={(e) => setReminderDraft(e.target.value)}
          placeholder="add reminder…"
          maxLength={48}
          className="flex-1 min-w-0 bg-transparent border-b border-base-content/15 text-xs px-1 py-0.5 outline-none focus:border-base-content/40"
        />
        {reminderDraft.trim() && (
          <button
            type="submit"
            className="text-[11px] px-2 py-0.5 rounded-full bg-base-content/10 hover:bg-base-content/15"
          >
            add
          </button>
        )}
      </form>
    </div>
  );
}

function ReminderChip({
  reminder,
  onRemove,
}: {
  reminder: ReminderToken;
  onRemove: (id: string) => Promise<void> | void;
}) {
  return (
    <li className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-200/30 text-amber-900 dark:text-amber-200">
      <span>{reminder.label}</span>
      <button
        type="button"
        className="text-amber-900/55 dark:text-amber-200/55 hover:text-amber-900 dark:hover:text-amber-200"
        aria-label={`Remove ${reminder.label}`}
        onClick={() => void onRemove(reminder.id)}
      >
        ×
      </button>
    </li>
  );
}

function Pill({
  on,
  tint,
  onClick,
  children,
}: {
  on: boolean;
  tint: "error" | "warning" | "info";
  onClick: () => void;
  children: ReactNode;
}) {
  const onClass = {
    error: "bg-error/15 text-error border-error/30",
    warning: "bg-warning/15 text-warning border-warning/35",
    info: "bg-info/15 text-info border-info/30",
  }[tint];
  const offClass = "border-base-content/15 text-base-content/55 hover:bg-base-content/5";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
        on ? onClass : offClass
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Count seats eligible to vote on an open nomination: every living
 * seat, plus every dead seat whose ghost vote hasn't been spent. This
 * is what gets shown on the player UI as the denominator of the
 * "x of y voted" running progress.
 */
function countEligibleVoters(
  seats: Record<string, { isAlive: boolean; ghostVoteUsed: boolean }>,
): number {
  let n = 0;
  for (const s of Object.values(seats)) {
    if (s.isAlive || !s.ghostVoteUsed) n++;
  }
  return n;
}

function phaseLabel(phase: BotCPhase, dayNumber: number): string {
  switch (phase) {
    case "setup":
      return "setup";
    case "firstNight":
      return "first night";
    case "day":
      return `day ${dayNumber}`;
    case "night":
      return `night ${dayNumber}`;
    case "finished":
      return "match ended";
  }
}

function phaseAdvanceLabel(phase: BotCPhase, dayNumber: number): string | null {
  switch (phase) {
    case "setup":
      return null; // setup uses its own "Start the first night" button
    case "firstNight":
      return "Advance to day 1 →";
    case "day":
      return `Advance to night ${dayNumber} →`;
    case "night":
      return `Advance to day ${dayNumber + 1} →`;
    case "finished":
      return null;
  }
}

// ============================================================================
// Player
// ============================================================================

function PlayerSurface({
  view,
  players,
  sendMove,
  onEvent,
}: {
  view: Extract<BotCView, { viewer: "player" }>;
  players: SeatPlayer[];
  sendMove: Send;
  onEvent: OnEvent;
}) {
  const character = view.me?.characterId
    ? TROUBLE_BREWING_BY_ID[view.me.characterId]
    : null;

  const playerById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );

  const [pending, setPending] = useState<SendInfoPayload | null>(null);

  useEffect(() => {
    return onEvent((e) => {
      if (e.kind !== "botc.privateInfo") return;
      const payload = e.payload as { info?: SendInfoPayload } | undefined;
      if (payload?.info) setPending(payload.info);
    });
  }, [onEvent]);

  const dismissPending = () => {
    setPending(null);
    void sendMove({ kind: "p.acknowledgeWake" });
  };

  return (
    <div className="surface-ivory p-6 max-w-md w-full flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          {view.phase === "setup"
            ? "Town square · setup"
            : `Town square · ${phaseLabel(view.phase, view.dayNumber)}`}
        </span>
        <h2 className="font-display text-2xl tracking-tight">
          {view.me ? "Your seat" : "Watching"}
        </h2>
      </header>
      {view.phase === "setup" && !character && (
        <p className="text-sm text-base-content/65 leading-relaxed">
          The Storyteller is distributing characters. Sit tight — your role
          will appear here when setup is done.
        </p>
      )}
      {character && (
        <div className="flex flex-col gap-2 border-l-2 border-primary/60 pl-4">
          <span
            className={`text-xs uppercase tracking-[0.22em] ${TEAM_TINT[character.team]}`}
          >
            {TEAM_LABEL[character.team].slice(0, -1)}
          </span>
          <div className="font-display text-3xl tracking-tight">
            {character.name}
          </div>
          <p className="text-sm text-base-content/75 leading-relaxed">
            {character.ability}
          </p>
        </div>
      )}
      {view.phase !== "setup" && (
        <p className="text-xs text-base-content/55">
          Phase:{" "}
          <span className="font-mono">
            {phaseLabel(view.phase, view.dayNumber)}
          </span>
          {view.me && !view.me.isAlive ? " · you are a ghost" : ""}
        </p>
      )}
      {view.phase === "day" && view.me && (
        <DayActions
          me={view.me}
          seatOrder={view.seatOrder}
          seats={view.seats}
          nominations={view.nominations}
          openVote={view.openVote}
          playerById={playerById}
          sendMove={sendMove}
        />
      )}
      {view.phase === "finished" && view.winner && (
        <FinishedBanner winner={view.winner} reason={view.endReason} />
      )}
      {pending && (
        <PrivateInfoModal
          info={pending}
          playerById={playerById}
          onDismiss={dismissPending}
        />
      )}
    </div>
  );
}

function DayActions({
  me,
  seatOrder,
  seats,
  nominations,
  openVote,
  playerById,
  sendMove,
}: {
  me: NonNullable<Extract<BotCView, { viewer: "player" }>["me"]>;
  seatOrder: Extract<BotCView, { viewer: "player" }>["seatOrder"];
  seats: Extract<BotCView, { viewer: "player" }>["seats"];
  nominations: Extract<BotCView, { viewer: "player" }>["nominations"];
  openVote: Extract<BotCView, { viewer: "player" }>["openVote"];
  playerById: Record<string, SeatPlayer>;
  sendMove: Send;
}) {
  const [nominee, setNominee] = useState("");
  const alreadyNominated = nominations.some((n) => n.nominator === me.seatId);
  const myVote = openVote?.votes[me.seatId];
  const canVote = me.isAlive || !me.ghostVoteUsed;
  const openNominee = openVote
    ? nominations.find((n) => n.id === openVote.nominationId)?.nominee
    : undefined;

  const eligibleNominees = seatOrder.filter(
    (id) =>
      id !== me.seatId &&
      !nominations.some((n) => n.nominee === id) &&
      seats[id]?.isAlive,
  );

  const submitNominate = () => {
    if (!nominee) return;
    void sendMove({ kind: "p.nominate", nominee });
    setNominee("");
  };

  const cast = (vote: "yes" | "no") => {
    if (!openVote) return;
    void sendMove({
      kind: "p.castVote",
      nominationId: openVote.nominationId,
      vote,
    });
  };

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-base-content/10">
      {openVote && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Vote on{" "}
            {openNominee
              ? (playerById[openNominee]?.name ?? openNominee)
              : "—"}
            <span className="ml-2 font-mono text-base-content/45 normal-case tracking-normal">
              {openVote.votedCount} / {countEligibleVoters(seats)} voted
            </span>
          </span>
          {myVote ? (
            <span className="text-sm">
              You voted{" "}
              <strong className="font-display">{myVote}</strong>
            </span>
          ) : canVote ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-sm rounded-full px-4 bg-success/20 text-success border border-success/40"
                onClick={() => cast("yes")}
              >
                Yes
              </button>
              <button
                type="button"
                className="btn btn-sm rounded-full px-4 bg-base-content/10 text-base-content/70 border border-base-content/20"
                onClick={() => cast("no")}
              >
                No
              </button>
            </div>
          ) : (
            <span className="text-xs text-base-content/55 italic">
              Your ghost vote is spent.
            </span>
          )}
        </div>
      )}

      {!openVote && me.isAlive && !alreadyNominated && (
        <div className="flex items-center gap-2">
          <select
            value={nominee}
            onChange={(e) => setNominee(e.target.value)}
            className="flex-1 bg-transparent border-b border-base-content/15 text-sm px-1 py-0.5"
          >
            <option value="">— nominate someone —</option>
            {eligibleNominees.map((id) => (
              <option key={id} value={id}>
                {playerById[id]?.name ?? id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!nominee}
            onClick={submitNominate}
            className="text-xs px-3 py-1 rounded-full bg-primary/15 text-primary disabled:opacity-40"
          >
            Nominate
          </button>
        </div>
      )}

      {!openVote && me.isAlive && alreadyNominated && (
        <span className="text-xs text-base-content/55 italic">
          You've already nominated today.
        </span>
      )}

      {nominations.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Today's nominations
          </span>
          <ul className="flex flex-col gap-0.5 text-xs">
            {nominations.map((n) => (
              <li key={n.id} className="flex items-baseline gap-1.5">
                <span className="font-display">
                  {playerById[n.nominator]?.name ?? n.nominator}
                </span>
                <span className="text-base-content/55">→</span>
                <span className="font-display">
                  {playerById[n.nominee]?.name ?? n.nominee}
                </span>
                {n.result && (
                  <span className="text-base-content/55">
                    · {n.result.yesCount} yes
                    {n.result.onTheBlock && " (block)"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PrivateInfoModal({
  info,
  playerById,
  onDismiss,
}: {
  info: SendInfoPayload;
  playerById: Record<string, SeatPlayer>;
  onDismiss: () => void;
}) {
  const character = info.character
    ? TROUBLE_BREWING_BY_ID[info.character] ?? null
    : null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
      onClick={onDismiss}
    >
      <div
        className="surface-ivory p-6 max-w-md w-full flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
            The Storyteller wakes you…
          </span>
          <h3 className="font-display text-xl">A whisper in the night</h3>
        </header>
        {info.text && (
          <p className="text-sm text-base-content/85 leading-relaxed whitespace-pre-wrap">
            {info.text}
          </p>
        )}
        {info.seats && info.seats.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
              Players
            </span>
            <ul className="flex flex-wrap gap-1.5">
              {info.seats.map((id) => (
                <li
                  key={id}
                  className="px-2 py-0.5 rounded-full bg-base-content/8 text-sm font-display"
                >
                  {playerById[id]?.name ?? id}
                </li>
              ))}
            </ul>
          </div>
        )}
        {character && (
          <div className="flex flex-col gap-1 border-l-2 border-primary/60 pl-3">
            <span
              className={`text-[10px] uppercase tracking-[0.18em] ${TEAM_TINT[character.team]}`}
            >
              {TEAM_LABEL[character.team].slice(0, -1)}
            </span>
            <span className="font-display text-lg">{character.name}</span>
          </div>
        )}
        {info.yesNo !== undefined && (
          <div className="text-sm">
            Answer:{" "}
            <strong className="font-display text-lg">
              {info.yesNo ? "Yes" : "No"}
            </strong>
          </div>
        )}
        {info.number !== undefined && (
          <div className="text-sm">
            Number:{" "}
            <strong className="font-display text-lg">{info.number}</strong>
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary self-end rounded-full px-5"
          onClick={onDismiss}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Spectator
// ============================================================================

function SpectatorPlaceholder({
  view,
  players,
}: {
  view: Extract<BotCView, { viewer: "spectator" }>;
  players: SeatPlayer[];
}) {
  const playerById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );
  const isFinished = view.phase === "finished";
  return (
    <div className="surface-ivory p-6 max-w-2xl w-full flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          Spectating · {phaseLabel(view.phase, view.dayNumber)}
        </span>
        <h2 className="font-display text-2xl tracking-tight">Town square</h2>
      </header>
      {!isFinished && (
        <p className="text-sm text-base-content/65 leading-relaxed">
          Roles and Grimoire reveal at the end of the match.
        </p>
      )}
      {isFinished && view.winner && (
        <FinishedBanner winner={view.winner} reason={view.endReason} />
      )}
      {isFinished && view.finalGrimoire && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
          {view.seatOrder.map((id) => {
            const seat = view.finalGrimoire?.[id];
            const c = seat?.characterId
              ? (TROUBLE_BREWING_BY_ID[seat.characterId] ?? null)
              : null;
            return (
              <li
                key={id}
                className={`flex items-baseline justify-between gap-3 px-2 py-1 rounded ${
                  seat?.isAlive ? "" : "opacity-50"
                }`}
              >
                <span className="font-display truncate">
                  {playerById[id]?.name ?? id}
                </span>
                <span
                  className={`font-mono text-xs ${
                    c ? TEAM_TINT[c.team] : "text-base-content/40"
                  }`}
                >
                  {c?.name ?? "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function countByTeam(
  assignments: Record<string, string | null>,
  scriptCharacters: Character[],
): Record<CharacterTeam, number> {
  const counts: Record<CharacterTeam, number> = {
    townsfolk: 0,
    outsider: 0,
    minion: 0,
    demon: 0,
    traveller: 0,
    fabled: 0,
  };
  const byId = Object.fromEntries(scriptCharacters.map((c) => [c.id, c]));
  for (const cid of Object.values(assignments)) {
    if (!cid) continue;
    const c = byId[cid];
    if (!c) continue;
    counts[c.team]++;
  }
  return counts;
}

function countAssigned(d: Record<string, string | null>): number {
  return Object.values(d).filter(Boolean).length;
}

function filterAssignments(
  d: Record<string, string | null>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(d).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}

/**
 * Pick a balanced character distribution for the given player count, using
 * the official Trouble Brewing recommendation. Returns null if the player
 * count is outside the script's range.
 *
 * If the chosen Minion set includes the Baron, swap 2 Townsfolk for 2
 * Outsiders to honour the Baron's setup-modifying ability.
 */
function pickBalancedTB(
  scriptCharacters: Character[],
  playerCount: number,
): Character[] | null {
  const recommended = TB_DISTRIBUTION[playerCount];
  if (!recommended) return null;
  let [t, o, m, d] = recommended;
  const byTeam = (team: CharacterTeam) =>
    scriptCharacters.filter((c) => c.team === team);
  const minions = pickRandom(byTeam("minion"), m);
  if (minions.some((c) => c.id === "baron")) {
    t = Math.max(0, t - 2);
    o += 2;
  }
  const townsfolk = pickRandom(byTeam("townsfolk"), t);
  const outsiders = pickRandom(byTeam("outsider"), o);
  const demons = pickRandom(byTeam("demon"), d);
  return [...townsfolk, ...outsiders, ...minions, ...demons];
}

function pickRandom<T>(arr: T[], n: number): T[] {
  if (n <= 0 || arr.length === 0) return [];
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]!);
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const bloodClocktowerClientModule: ClientGameModule<
  BotCView,
  BotCMove,
  unknown
> = {
  type: BOTC_TYPE,
  Board: BotCBoard,
};
