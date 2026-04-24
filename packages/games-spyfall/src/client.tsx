import { useEffect, useMemo, useState } from "react";
import type {
  BoardProps,
  ClientGameModule,
  LobbyPanelProps,
  SummaryProps,
} from "@bgo/sdk-client";
import {
  DEFAULT_ROUND_SECONDS,
  MAX_ROUND_SECONDS,
  MIN_ROUND_SECONDS,
  SPYFALL_TYPE,
  type SpyfallConfig,
  type SpyfallMove,
  type SpyfallView,
} from "./shared";

function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function useCountdown(endsAt: number): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (Date.now() >= endsAt) {
      setNow(Date.now());
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return Math.max(0, endsAt - now);
}

function SpyfallBoard({
  view,
  me,
  players,
  sendMove,
}: BoardProps<SpyfallView, SpyfallMove>) {
  const remainingMs = useCountdown(view.endsAt);
  const [guess, setGuess] = useState<string>("");

  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const accusation = view.accusation;
  const isOver = view.phase === "gameOver";
  const isPlaying = view.phase === "playing";
  const isVoting = view.phase === "voting";
  const isSpy = view.viewer.isSpy;

  // Round length fallback: view doesn't expose startedAt, so we use the
  // shared default. Custom lobby lengths will render a slightly-off progress
  // bar; the clock readout itself stays authoritative. Flagged as a follow-up
  // for iteration-2 (add `startedAt` or `roundLengthMs` to SpyfallView).
  const totalMs = DEFAULT_ROUND_SECONDS * 1000;

  const accuse = async (target: string) => {
    if (!isPlaying || isSpy) return;
    await sendMove({ kind: "accuse", target });
  };
  const vote = async (approve: boolean) => {
    if (!isVoting || !accusation?.viewerMustVote) return;
    await sendMove({ kind: "vote", approve });
  };
  const cancelAccusation = async () => {
    if (!isVoting || !accusation || accusation.accuser !== me) return;
    await sendMove({ kind: "cancelAccusation" });
  };
  const submitSpyGuess = async () => {
    if (!isSpy || !guess) return;
    await sendMove({ kind: "spyGuess", location: guess });
    setGuess("");
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <ClockBanner
        remainingMs={remainingMs}
        totalMs={totalMs}
        phase={view.phase}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
        <IdentityCard view={view} />
        <PlayersCard
          view={view}
          players={players}
          playersById={playersById}
          me={me}
          canAccuse={isPlaying && !isSpy && !isOver}
          onAccuse={accuse}
        />
      </div>

      {isVoting && accusation && (
        <VotingPanel
          view={view}
          playersById={playersById}
          me={me}
          onVote={vote}
          onCancel={cancelAccusation}
        />
      )}

      {isSpy && !isOver && (
        <SpyGuessPanel
          locations={view.locationPool}
          guess={guess}
          setGuess={setGuess}
          onSubmit={submitSpyGuess}
        />
      )}

      {!isSpy && !isOver && <LocationPoolHint locations={view.locationPool} />}
    </div>
  );
}

function ClockBanner({
  remainingMs,
  totalMs,
  phase,
}: {
  remainingMs: number;
  totalMs: number;
  phase: SpyfallView["phase"];
}) {
  if (phase === "gameOver") return null;
  const level: "error" | "warning" | "normal" =
    remainingMs < 60_000
      ? "error"
      : remainingMs < 120_000
        ? "warning"
        : "normal";
  const pct =
    totalMs > 0
      ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))
      : 0;
  const pillClass =
    level === "error"
      ? "bg-error text-error-content animate-pulse"
      : level === "warning"
        ? "text-warning"
        : "bg-base-200 text-base-content";
  const pillStyle: React.CSSProperties = {
    boxShadow:
      "inset 0 1px 0 oklch(100% 0 0 / 0.15), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
    letterSpacing: "0.08em",
    ...(level === "warning"
      ? {
          background:
            "color-mix(in oklch, var(--color-warning) 25%, var(--color-base-100))",
        }
      : {}),
  };
  const barFill =
    level === "error"
      ? "var(--color-error)"
      : level === "warning"
        ? "var(--color-warning)"
        : "var(--color-primary)";
  return (
    <div
      role="timer"
      aria-live="off"
      className="flex flex-col items-center gap-2"
    >
      <div
        className={[
          "px-6 py-2.5 rounded-full font-mono tabular-nums text-2xl md:text-3xl font-bold transition-colors",
          pillClass,
        ].join(" ")}
        style={pillStyle}
      >
        {formatClock(remainingMs)}
      </div>
      <div
        className="w-48 h-1 rounded-full bg-base-200/80 overflow-hidden"
        aria-hidden
      >
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barFill }}
        />
      </div>
    </div>
  );
}

function IdentityCard({ view }: { view: SpyfallView }) {
  const isSpy = view.viewer.isSpy;
  return (
    <div
      className={[
        "rounded-2xl p-5 flex flex-col gap-2",
        isSpy ? "bg-neutral text-neutral-content" : "surface-ivory",
      ].join(" ")}
      style={{
        boxShadow: isSpy
          ? "inset 0 1px 0 oklch(100% 0 0 / 0.1), inset 0 -2px 0 oklch(0% 0 0 / 0.3), 0 18px 40px oklch(0% 0 0 / 0.25)"
          : undefined,
      }}
    >
      {isSpy ? (
        <>
          <div className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-70">
            ◆ Your role ◆
          </div>
          <div
            className="font-display tracking-tight"
            style={{ fontSize: "var(--text-display-sm)" }}
          >
            You are the Spy.
          </div>
          <div className="text-sm opacity-80 leading-relaxed mt-1">
            You don't know the location. Listen, ask sharp questions, and play
            along. When you're ready, pick the location from the list below.
          </div>
        </>
      ) : (
        <>
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Location
          </div>
          <div
            className="font-display tracking-tight text-primary"
            style={{ fontSize: "var(--text-display-sm)" }}
          >
            {view.viewer.location}
          </div>
          <div className="text-sm text-base-content/70">
            Your role:{" "}
            <span className="font-semibold">{view.viewer.role}</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-warning/85 pt-1">
            ◆ Private to you
          </div>
          <div className="text-xs text-base-content/55 italic">
            Don't say the location out loud — someone here is a spy.
          </div>
        </>
      )}
    </div>
  );
}

function PlayersCard({
  view,
  players,
  playersById,
  me,
  canAccuse,
  onAccuse,
}: {
  view: SpyfallView;
  players: { id: string; name: string }[];
  playersById: Record<string, { id: string; name: string }>;
  me: string;
  canAccuse: boolean;
  onAccuse: (id: string) => void;
}) {
  const order = view.order;
  const isVoting = view.phase === "voting";
  const accusedId = view.accusation?.target ?? null;
  const accuserId = view.accusation?.accuser ?? null;
  return (
    <div className="surface-ivory p-5 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Players
      </div>
      <ul className="flex flex-col gap-1">
        {order.map((id, i) => {
          const p = playersById[id] ?? { id, name: id };
          const isMe = id === me;
          const isSpy = view.spyId === id;
          const isAccused = isVoting && accusedId === id;
          const isAccuser = isVoting && accuserId === id;
          const dim = isVoting && !isAccused && !isAccuser && !isMe;
          return (
            <li
              key={id}
              className={[
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 border transition-all",
                isAccused
                  ? "border-warning bg-warning/10 shadow-[0_0_0_1px_var(--color-warning)]"
                  : isAccuser
                    ? "border-primary/55 bg-primary/5"
                    : "border-base-300/60",
                dim ? "opacity-55" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono tabular-nums text-base-content/40 w-5">
                  {i + 1}.
                </span>
                <span className="font-semibold truncate">{p.name}</span>
                {isMe && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-base-content/50">
                    you
                  </span>
                )}
                {isSpy && (
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-primary">
                    spy
                  </span>
                )}
                {isAccused && (
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-warning">
                    accused
                  </span>
                )}
                {isAccuser && !isAccused && (
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-primary/85">
                    accuser
                  </span>
                )}
              </div>
              {canAccuse && !isMe && (
                <button
                  type="button"
                  onClick={() => onAccuse(id)}
                  className="text-[10px] uppercase tracking-[0.2em] font-semibold px-2.5 py-1 rounded-full ring-1 ring-base-300 text-base-content/60 hover:ring-error hover:text-error hover:bg-error/5 active:scale-95 transition-all"
                  aria-label={`Accuse ${p.name}`}
                >
                  Accuse
                </button>
              )}
            </li>
          );
        })}
        {players.length === 0 && (
          <li className="text-sm text-base-content/50">No players.</li>
        )}
      </ul>
    </div>
  );
}

function VotingPanel({
  view,
  playersById,
  me,
  onVote,
  onCancel,
}: {
  view: SpyfallView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
  onVote: (approve: boolean) => void;
  onCancel: () => void;
}) {
  const acc = view.accusation!;
  const accuserName = playersById[acc.accuser]?.name ?? acc.accuser;
  const targetName = playersById[acc.target]?.name ?? acc.target;
  const iAmAccuser = acc.accuser === me;
  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-xl w-full rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-warning) 20%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-warning) 50%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-warning-content">
        ◆ Accusation in progress ◆
      </div>
      <div className="text-lg">
        <span className="font-display tracking-tight">{accuserName}</span>{" "}
        accuses{" "}
        <span className="font-display tracking-tight">{targetName}</span>.
      </div>
      <div className="text-xs text-base-content/65">
        All others must vote to approve. Any rejection cancels it.
      </div>
      <div className="flex items-center gap-2 text-sm font-mono tabular-nums flex-wrap">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{
            background: "var(--color-success)",
            color: "var(--color-success-content)",
          }}
        >
          ✓ {acc.approvals}
        </span>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{
            background: "var(--color-error)",
            color: "var(--color-error-content)",
          }}
        >
          ✗ {acc.rejections}
        </span>
        {acc.pending.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[10px] uppercase tracking-wider text-base-content/45 ml-1 normal-case tracking-normal">
              Waiting
            </span>
            {acc.pending.map((id) => (
              <span
                key={id}
                className="text-[10px] px-2 py-0.5 rounded-full bg-base-100 ring-1 ring-base-300 text-base-content/65 font-semibold normal-case tracking-normal"
              >
                {playersById[id]?.name ?? id}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {acc.viewerMustVote && (
          <>
            <button
              type="button"
              className="btn btn-success rounded-full px-5 font-semibold"
              onClick={() => onVote(true)}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-error rounded-full px-5 font-semibold"
              onClick={() => onVote(false)}
            >
              Reject
            </button>
          </>
        )}
        {iAmAccuser && (
          <button
            type="button"
            className="text-[10px] uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full ring-1 ring-base-300 text-base-content/55 hover:ring-base-content/40 hover:text-base-content ml-auto self-center transition-all"
            onClick={onCancel}
          >
            Cancel accusation
          </button>
        )}
      </div>
    </div>
  );
}

function SpyGuessPanel({
  locations,
  guess,
  setGuess,
  onSubmit,
}: {
  locations: string[];
  guess: string;
  setGuess: (s: string) => void;
  onSubmit: () => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(
    () =>
      locations.filter((l) =>
        l.toLowerCase().includes(filter.trim().toLowerCase()),
      ),
    [locations, filter],
  );
  return (
    <div className="surface-ivory max-w-xl w-full p-5 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Spy — guess the location
      </div>
      <input
        type="text"
        placeholder="Filter locations…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="input input-bordered rounded-lg"
        aria-label="Filter locations"
      />
      <div
        className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto pr-1"
        role="listbox"
      >
        {filtered.map((l) => (
          <button
            key={l}
            type="button"
            role="option"
            aria-selected={guess === l}
            onClick={() => setGuess(l)}
            className={[
              "text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer",
              guess === l
                ? "border-primary bg-primary/15 text-primary font-semibold"
                : "border-base-300 bg-base-100 text-base-content/70 hover:border-primary/50",
            ].join(" ")}
          >
            {l}
          </button>
        ))}
        {filtered.length === 0 && (
          <span className="text-xs italic text-base-content/50">
            No matches.
          </span>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <button
          type="button"
          className="btn btn-primary rounded-full px-5 font-semibold"
          onClick={onSubmit}
          disabled={!guess}
        >
          Guess{guess ? ` — ${guess}` : ""}
        </button>
        {guess && (
          <button
            type="button"
            className="text-[10px] uppercase tracking-wider text-base-content/50 hover:text-base-content"
            onClick={() => setGuess("")}
          >
            Clear
          </button>
        )}
      </div>
      <div className="text-xs text-base-content/55">
        Guess correctly and you win. Guess wrong and the non-spies win
        immediately.
      </div>
    </div>
  );
}

function LocationPoolHint({ locations }: { locations: string[] }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="max-w-3xl w-full">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/50 hover:text-base-content flex items-center gap-1 cursor-pointer"
        aria-expanded={expanded}
      >
        Possible locations ({locations.length}){" "}
        <span className="text-[9px]">{expanded ? "▴" : "▾"}</span>
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {locations.map((l) => (
            <span
              key={l}
              className="text-[11px] px-2 py-0.5 rounded-full bg-base-100 ring-1 ring-base-300/60 text-base-content/65"
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SpyfallLobbyPanel({
  config,
  onChange,
  isHost,
}: LobbyPanelProps<SpyfallConfig>) {
  const seconds = config.roundSeconds ?? DEFAULT_ROUND_SECONDS;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-base-content/65">
        {isHost
          ? "Pick a round length. The spy wins if the clock runs out."
          : "The host chooses the round length."}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label
          className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55"
          htmlFor="spyfall-seconds"
        >
          Round length
        </label>
        <input
          id="spyfall-seconds"
          type="range"
          className="range range-primary flex-1 min-w-[200px]"
          min={MIN_ROUND_SECONDS}
          max={MAX_ROUND_SECONDS}
          step={30}
          value={seconds}
          disabled={!isHost}
          onChange={(e) =>
            onChange({ ...config, roundSeconds: parseInt(e.target.value, 10) })
          }
        />
        <span className="font-mono tabular-nums font-bold text-lg">
          {Math.floor(seconds / 60)}:
          {String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function SpyfallSummary({ view }: SummaryProps<SpyfallView>) {
  if (view.phase !== "gameOver" || !view.winner) return null;
  const headline =
    view.winner === "spy" ? "The Spy wins." : "The Non-Spies win.";
  const reasonLabel: Record<NonNullable<SpyfallView["winReason"]>, string> = {
    timeUp: "The clock ran out before the spy was caught.",
    spyGuessedRight: "The spy guessed the location.",
    spyGuessedWrong: "The spy guessed wrong.",
    accusedSpy: "The spy was caught by vote.",
    accusedNonSpy: "The non-spies accused the wrong player.",
  };
  const reason = view.winReason ? reasonLabel[view.winReason] : "";

  return (
    <div
      role="status"
      aria-live="polite"
      className="surface-ivory max-w-xl mx-auto px-6 py-5 text-center"
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary mb-1">
        ◆ Result ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        {headline}
      </div>
      <div className="text-sm text-base-content/65 mt-1">{reason}</div>
      <div className="text-sm mt-3">
        Location was{" "}
        <span className="font-display text-primary tracking-tight">
          {view.location ?? "?"}
        </span>
      </div>
      {view.spyGuess && (
        <div className="text-xs text-base-content/55 mt-0.5">
          Spy's guess: {view.spyGuess}
        </div>
      )}
    </div>
  );
}

export const spyfallClientModule: ClientGameModule<
  SpyfallView,
  SpyfallMove,
  SpyfallConfig
> = {
  type: SPYFALL_TYPE,
  Board: SpyfallBoard,
  LobbyPanel: SpyfallLobbyPanel,
  Summary: SpyfallSummary,
};
