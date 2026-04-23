"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BOTC_TYPE,
  TB_DISTRIBUTION,
  TROUBLE_BREWING_BY_ID,
  type BotCMove,
  type BotCPhase,
  type BotCView,
  type Character,
  type CharacterTeam,
  type ReminderToken,
  type SeatGrimoire,
} from "./shared";

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

function BotCBoard({ view, players, sendMove }: BoardProps<BotCView, BotCMove>) {
  if (view.viewer === "storyteller") {
    return <StorytellerSurface view={view} players={players} sendMove={sendMove} />;
  }
  if (view.viewer === "spectator") {
    return <SpectatorPlaceholder view={view} />;
  }
  return <PlayerSurface view={view} />;
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
        {advanceLabel && (
          <button
            type="button"
            className="btn btn-primary rounded-full px-5"
            onClick={advance}
          >
            {advanceLabel}
          </button>
        )}
      </header>

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
}: {
  view: Extract<BotCView, { viewer: "player" }>;
}) {
  const character = view.me?.characterId
    ? TROUBLE_BREWING_BY_ID[view.me.characterId]
    : null;
  return (
    <div className="surface-ivory p-6 max-w-md w-full flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          {view.phase === "setup" ? "Town square · setup" : `Town square · ${view.phase} ${view.dayNumber}`}
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
          <span className={`text-xs uppercase tracking-[0.22em] ${TEAM_TINT[character.team]}`}>
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
          Phase: <span className="font-mono">{view.phase}</span>
          {view.me && !view.me.isAlive ? " · you are a ghost" : ""}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Spectator
// ============================================================================

function SpectatorPlaceholder({
  view,
}: {
  view: Extract<BotCView, { viewer: "spectator" }>;
}) {
  return (
    <div className="surface-ivory p-6 max-w-md w-full flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          Spectating
        </span>
        <h2 className="font-display text-2xl tracking-tight">Town square</h2>
      </header>
      <p className="text-sm text-base-content/65 leading-relaxed">
        Phase:{" "}
        <span className="font-mono text-base-content/85">{view.phase}</span>.
        Roles and Grimoire reveal at the end of the match.
      </p>
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
