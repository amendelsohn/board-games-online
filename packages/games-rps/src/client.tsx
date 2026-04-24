import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BEATS,
  RPS_TYPE,
  THROWS,
  type RpsMove,
  type RpsRoundRecord,
  type RpsView,
  type Throw,
} from "./shared";

const THROW_LABEL: Record<Throw, string> = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors",
  lizard: "Lizard",
  spock: "Spock",
};

const THROW_TINT: Record<Throw, string> = {
  rock: "var(--color-base-content)",
  paper: "var(--color-warning)",
  scissors: "var(--color-info)",
  lizard: "var(--color-success)",
  spock: "var(--color-secondary)",
};

/**
 * Inline SVG glyphs for each throw. currentColor is the stroke so callers
 * can tint via a wrapper with `color`. Parlor-toned rather than emoji —
 * consistent across every browser and within the editorial tone.
 */
function ThrowSvg({ t, size = 48 }: { t: Throw; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 64 64" as const,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (t) {
    case "rock":
      return (
        <svg {...common} role="img" aria-label="rock">
          <circle cx="32" cy="34" r="18" />
          <path d="M22 28 q10 -6 20 0" />
          <path d="M22 34 q10 -6 20 0" opacity="0.5" />
          <path d="M22 40 q10 -6 20 0" opacity="0.3" />
        </svg>
      );
    case "paper":
      return (
        <svg {...common} role="img" aria-label="paper">
          <rect x="14" y="18" width="36" height="30" rx="4" />
          <line x1="22" y1="22" x2="22" y2="44" opacity="0.4" />
          <line x1="30" y1="22" x2="30" y2="44" opacity="0.4" />
          <line x1="38" y1="22" x2="38" y2="44" opacity="0.4" />
        </svg>
      );
    case "scissors":
      return (
        <svg {...common} role="img" aria-label="scissors">
          <circle cx="22" cy="44" r="6" />
          <circle cx="42" cy="44" r="6" />
          <path d="M26 40 L50 16" />
          <path d="M38 40 L14 16" />
        </svg>
      );
    case "lizard":
      return (
        <svg {...common} role="img" aria-label="lizard">
          <path d="M12 40 Q18 28 28 30 T48 22 L54 18" />
          <circle cx="52" cy="20" r="2.2" fill="currentColor" />
          <path d="M18 44 L22 50" />
          <path d="M28 40 L32 48" />
          <path d="M40 32 L44 40" />
        </svg>
      );
    case "spock":
      return (
        <svg {...common} role="img" aria-label="spock">
          <path d="M20 46 V28 L24 18 L26 28 L30 22 L32 32 L36 22 L38 32 L42 18 L46 28 V46 Z" />
        </svg>
      );
  }
}

function RpsBoard({
  view,
  me,
  players,
  sendMove,
}: BoardProps<RpsView, RpsMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const iAmInMatch = view.order.includes(me);
  const opponentId = view.order.find((id) => id !== me);
  const myScore = view.scores[me] ?? 0;
  const oppScore = (opponentId && view.scores[opponentId]) || 0;
  const opponentSubmitted = opponentId ? view.submitted[opponentId] === true : false;
  const mySubmitted = view.myThrow !== null;

  const isOver = view.phase === "gameOver";
  const didIWin = view.winner === me;

  const [showRules, setShowRules] = useState(false);
  const [reveal, setReveal] = useState<RpsRoundRecord | null>(null);
  const prevHistLenRef = useRef(view.roundHistory.length);

  useEffect(() => {
    if (view.roundHistory.length > prevHistLenRef.current) {
      const latest = view.roundHistory[view.roundHistory.length - 1] ?? null;
      prevHistLenRef.current = view.roundHistory.length;
      if (latest) {
        setReveal(latest);
        const t = setTimeout(() => setReveal(null), 2000);
        return () => clearTimeout(t);
      }
    } else {
      prevHistLenRef.current = view.roundHistory.length;
    }
  }, [view.roundHistory.length, view.roundHistory]);

  const submit = async (t: Throw) => {
    if (isOver || !iAmInMatch) return;
    await sendMove({ kind: "throw", throw: t });
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <style>{`
        @keyframes rps-pulse {
          0%, 100% { box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-success) 28%, transparent); }
          50%      { box-shadow: 0 0 0 5px color-mix(in oklch, var(--color-success) 14%, transparent); }
        }
        .rps-pulse-on { animation: rps-pulse 1.4s ease-in-out infinite; }
        @keyframes rps-reveal-in {
          0%   { transform: translateY(10px) scale(0.95); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .rps-reveal-in { animation: rps-reveal-in 260ms cubic-bezier(0.22, 1, 0.36, 1); }
      `}</style>

      <Scoreboard
        meName={playersById[me]?.name ?? "You"}
        oppName={(opponentId && playersById[opponentId]?.name) || "Opponent"}
        myScore={myScore}
        oppScore={oppScore}
        round={view.round}
        winsToClinch={view.winsToClinch}
        isOver={isOver}
        didIWin={didIWin}
      />

      {reveal && (
        <RevealOverlay
          reveal={reveal}
          me={me}
          opponentId={opponentId ?? null}
          meName={playersById[me]?.name ?? "You"}
          oppName={(opponentId && playersById[opponentId]?.name) || "Opponent"}
        />
      )}

      {!isOver && iAmInMatch && (
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold flex items-center gap-2">
            <span>
              {mySubmitted ? "Locked in — waiting on opponent" : "Choose your throw"}
            </span>
            <button
              type="button"
              onClick={() => setShowRules((v) => !v)}
              className="h-5 w-5 rounded-full ring-1 ring-base-300 text-[10px] font-bold text-base-content/60 hover:bg-base-200 normal-case tracking-normal"
              aria-label={showRules ? "Hide rules" : "Show rules"}
              aria-expanded={showRules}
            >
              ?
            </button>
          </div>

          {showRules && (
            <div className="rounded-xl bg-base-100 ring-1 ring-base-300 px-3 py-2 text-[11px] text-base-content/70 flex flex-col gap-0.5">
              {THROWS.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <span style={{ color: THROW_TINT[t] }}>
                    <ThrowSvg t={t} size={18} />
                  </span>
                  <span className="font-semibold uppercase tracking-wider text-[10px] w-16">
                    {THROW_LABEL[t]}
                  </span>
                  <span className="text-base-content/55">
                    beats {BEATS[t].map((x) => THROW_LABEL[x]).join(" & ")}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {THROWS.map((t) => {
              const selected = view.myThrow === t;
              const tint = THROW_TINT[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => submit(t)}
                  className={[
                    "group relative flex flex-col items-center justify-center",
                    "h-20 w-20 md:h-24 md:w-24 rounded-2xl",
                    "transition-all duration-200 cursor-pointer",
                    selected ? "scale-[1.04]" : "hover:scale-[1.04]",
                  ].join(" ")}
                  style={{
                    background: selected
                      ? `color-mix(in oklch, ${tint} 14%, var(--color-base-100))`
                      : "var(--color-base-100)",
                    boxShadow: selected
                      ? `0 0 0 2px ${tint}, 0 10px 24px color-mix(in oklch, ${tint} 25%, transparent)`
                      : "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.05)",
                  }}
                  aria-label={THROW_LABEL[t]}
                  aria-pressed={selected}
                >
                  <span style={{ color: tint, display: "inline-block" }}>
                    <ThrowSvg t={t} size={48} />
                  </span>
                  <span
                    className="mt-1 text-[10px] uppercase tracking-[0.14em] font-semibold"
                    style={{
                      color: selected
                        ? tint
                        : "color-mix(in oklch, var(--color-base-content) 60%, transparent)",
                    }}
                  >
                    {THROW_LABEL[t]}
                  </span>
                </button>
              );
            })}
          </div>

          <LockStatus
            mySubmitted={mySubmitted}
            oppSubmitted={opponentSubmitted}
            myThrow={view.myThrow}
          />
        </div>
      )}

      {!isOver && !iAmInMatch && (
        <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
          Spectating — both throws reveal when the round resolves.
        </div>
      )}

      <RoundHistory
        history={view.roundHistory}
        me={me}
        opponentId={opponentId ?? null}
        meName={playersById[me]?.name ?? "You"}
        oppName={(opponentId && playersById[opponentId]?.name) || "Opponent"}
      />

      {isOver && (
        <div
          className="max-w-lg w-full rounded-2xl p-5 flex flex-col gap-2 parlor-fade"
          style={{
            background: didIWin
              ? "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))"
              : iAmInMatch
                ? "color-mix(in oklch, var(--color-error) 12%, var(--color-base-100))"
                : "color-mix(in oklch, var(--color-base-content) 6%, var(--color-base-100))",
            border: didIWin
              ? "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)"
              : iAmInMatch
                ? "1px solid color-mix(in oklch, var(--color-error) 30%, transparent)"
                : "1px solid color-mix(in oklch, var(--color-base-content) 20%, transparent)",
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
            ◆ Match over ◆
          </div>
          <div
            className="font-display tracking-tight"
            style={{ fontSize: "var(--text-display-sm)" }}
          >
            {didIWin
              ? "You win the match."
              : iAmInMatch
                ? "You lose the match."
                : `${(view.winner && playersById[view.winner]?.name) || "A player"} wins the match.`}
          </div>
          <div className="text-sm text-base-content/60 font-mono tabular-nums">
            {myScore}–{oppScore} · {view.roundHistory.length} round
            {view.roundHistory.length === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}

function RevealOverlay({
  reveal,
  me,
  opponentId,
  meName,
  oppName,
}: {
  reveal: RpsRoundRecord;
  me: string;
  opponentId: string | null;
  meName: string;
  oppName: string;
}) {
  const myThrow = reveal.throws[me];
  const oppThrow = opponentId ? reveal.throws[opponentId] : undefined;
  const iAmInRound = me in reveal.throws;
  const verdict =
    reveal.winner === null
      ? { label: "Tie", cls: "bg-warning/20 text-warning" }
      : reveal.winner === me
        ? { label: "You win", cls: "bg-success/20 text-success" }
        : iAmInRound
          ? { label: "You lose", cls: "bg-error/20 text-error" }
          : {
              label: `${oppName} wins`,
              cls: "bg-base-200 text-base-content",
            };

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl px-5 py-3 ring-1 ring-primary/40 bg-base-100/95 rps-reveal-in flex items-center gap-4"
      style={{
        boxShadow: "0 12px 32px color-mix(in oklch, var(--color-primary) 25%, transparent)",
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] uppercase tracking-[0.2em] text-base-content/55">
          {meName}
        </span>
        {myThrow ? (
          <div style={{ color: THROW_TINT[myThrow] }}>
            <ThrowSvg t={myThrow} size={40} />
          </div>
        ) : (
          <div className="h-10 w-10" aria-hidden />
        )}
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/50">
          vs
        </span>
        <span
          className={`mt-1 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold ${verdict.cls}`}
        >
          {verdict.label}
        </span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] uppercase tracking-[0.2em] text-base-content/55">
          {oppName}
        </span>
        {oppThrow ? (
          <div style={{ color: THROW_TINT[oppThrow] }}>
            <ThrowSvg t={oppThrow} size={40} />
          </div>
        ) : (
          <div className="h-10 w-10" aria-hidden />
        )}
      </div>
    </div>
  );
}

function Scoreboard({
  meName,
  oppName,
  myScore,
  oppScore,
  round,
  winsToClinch,
  isOver,
  didIWin,
}: {
  meName: string;
  oppName: string;
  myScore: number;
  oppScore: number;
  round: number;
  winsToClinch: number;
  isOver: boolean;
  didIWin: boolean;
}) {
  return (
    <div
      className="flex items-stretch gap-3 rounded-2xl px-4 py-3"
      style={{
        background: "color-mix(in oklch, var(--color-base-300) 70%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
      }}
    >
      <ScoreSide
        name={meName}
        score={myScore}
        winsToClinch={winsToClinch}
        highlight={isOver && didIWin}
        accent="primary"
      />
      <div className="flex flex-col items-center justify-center px-3 text-center min-w-[96px]">
        <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/55 font-semibold font-mono tabular-nums">
          {isOver ? "Final" : `Round ${round}`}
        </div>
        <div className="font-display text-3xl md:text-4xl leading-none mt-1 flex items-baseline">
          <span
            className={[
              "tabular-nums font-mono min-w-[1.5ch] text-right",
              myScore > oppScore ? "text-primary" : "",
            ].join(" ")}
          >
            {myScore}
          </span>
          <span className="text-base-content/40 mx-1.5">:</span>
          <span
            className={[
              "tabular-nums font-mono min-w-[1.5ch] text-left",
              oppScore > myScore ? "text-secondary" : "",
            ].join(" ")}
          >
            {oppScore}
          </span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-base-content/45 mt-1">
          First to {winsToClinch}
        </div>
      </div>
      <ScoreSide
        name={oppName}
        score={oppScore}
        winsToClinch={winsToClinch}
        highlight={isOver && !didIWin && oppScore >= winsToClinch}
        accent="secondary"
        alignEnd
      />
    </div>
  );
}

function ScoreSide({
  name,
  score,
  winsToClinch,
  highlight,
  accent,
  alignEnd = false,
}: {
  name: string;
  score: number;
  winsToClinch: number;
  highlight: boolean;
  accent: "primary" | "secondary";
  alignEnd?: boolean;
}) {
  const accentClass =
    accent === "primary" ? "text-primary" : "text-secondary";
  return (
    <div
      className={[
        "flex flex-col justify-center min-w-[96px]",
        alignEnd ? "items-end text-right" : "items-start text-left",
        highlight ? "parlor-win" : "",
      ].join(" ")}
    >
      <div
        className={[
          "text-xs uppercase tracking-[0.18em] font-semibold truncate max-w-[140px]",
          accentClass,
        ].join(" ")}
      >
        {name}
      </div>
      <div className="flex items-center gap-1 mt-1">
        {Array.from({ length: winsToClinch }).map((_, i) => {
          const filled = i < score;
          return (
            <span
              key={i}
              className="h-2.5 w-5 rounded-full"
              style={{
                background: filled
                  ? `var(--color-${accent})`
                  : "color-mix(in oklch, var(--color-base-content) 12%, transparent)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function LockStatus({
  mySubmitted,
  oppSubmitted,
  myThrow,
}: {
  mySubmitted: boolean;
  oppSubmitted: boolean;
  myThrow: Throw | null;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-5 text-xs text-base-content/60 tracking-wide mt-1"
    >
      <div className="flex items-center gap-1.5">
        <Pulse on={mySubmitted} />
        <span>You</span>
        {mySubmitted && myThrow && (
          <span style={{ color: THROW_TINT[myThrow] }}>
            <ThrowSvg t={myThrow} size={14} />
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Pulse on={oppSubmitted} />
        <span>Opp</span>
        <span
          className={
            oppSubmitted
              ? "font-semibold text-secondary"
              : "text-base-content/50"
          }
        >
          {oppSubmitted ? "locked" : "picking…"}
        </span>
      </div>
    </div>
  );
}

function Pulse({ on }: { on: boolean }) {
  return (
    <span
      className={[
        "h-2 w-2 rounded-full inline-block",
        on ? "rps-pulse-on" : "",
      ].join(" ")}
      style={{
        background: on ? "var(--color-success)" : "var(--color-base-content)",
        opacity: on ? 1 : 0.4,
      }}
    />
  );
}

function RoundHistory({
  history,
  me,
  opponentId,
  meName,
  oppName,
}: {
  history: RpsView["roundHistory"];
  me: string;
  opponentId: string | null;
  meName: string;
  oppName: string;
}) {
  if (history.length === 0) return null;
  // Latest-first ordering; most relevant row sits at the top.
  const ordered = [...history].map((r, i) => ({ r, originalIdx: i })).reverse();
  return (
    <div className="w-full max-w-md">
      <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/50 font-semibold mb-2 font-mono">
        Rounds <span className="normal-case tracking-normal text-base-content/40">(newest first)</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {ordered.map(({ r, originalIdx }) => {
          const myThrow = r.throws[me];
          const oppThrow = opponentId ? r.throws[opponentId] : undefined;
          const tied = r.winner === null;
          const iWon = !tied && r.winner === me;
          const isLatest = originalIdx === history.length - 1;
          return (
            <li
              key={originalIdx}
              className={[
                "flex items-center justify-between gap-3 rounded-xl px-3 py-2",
                "bg-base-100 ring-1 transition-shadow",
                tied
                  ? "ring-base-300"
                  : iWon
                    ? "ring-success/50"
                    : "ring-error/40",
                isLatest
                  ? "shadow-[0_0_0_2px_color-mix(in_oklch,var(--color-primary)_35%,transparent)]"
                  : "",
              ].join(" ")}
            >
              <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/50 font-semibold font-mono tabular-nums w-12">
                R{originalIdx + 1}
              </span>
              <div className="flex items-center gap-2 flex-1 justify-center">
                <span className="text-xs text-base-content/70 truncate max-w-[80px]">
                  {meName}
                </span>
                {myThrow && (
                  <span style={{ color: THROW_TINT[myThrow] }}>
                    <ThrowSvg t={myThrow} size={20} />
                  </span>
                )}
                <span className="text-[10px] text-base-content/40 mx-1">vs</span>
                {oppThrow && (
                  <span style={{ color: THROW_TINT[oppThrow] }}>
                    <ThrowSvg t={oppThrow} size={20} />
                  </span>
                )}
                <span className="text-xs text-base-content/70 truncate max-w-[80px]">
                  {oppName}
                </span>
              </div>
              <span
                className={[
                  "text-[10px] uppercase tracking-[0.18em] font-semibold w-14 text-right",
                  tied
                    ? "text-base-content/50"
                    : iWon
                      ? "text-success"
                      : "text-error",
                ].join(" ")}
              >
                {tied ? "tie" : iWon ? "won" : "lost"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const rpsClientModule: ClientGameModule<
  RpsView,
  RpsMove,
  Record<string, never>
> = {
  type: RPS_TYPE,
  Board: RpsBoard,
};
