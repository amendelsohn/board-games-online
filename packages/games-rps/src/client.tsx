import { useMemo } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import { PlayerUILayout } from "@bgo/sdk-client";
import {
  RPS_TYPE,
  THROWS,
  type RpsMove,
  type RpsView,
  type Throw,
} from "./shared";

const THROW_GLYPH: Record<Throw, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
  lizard: "🦎",
  spock: "🖖",
};

const THROW_LABEL: Record<Throw, string> = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors",
  lizard: "Lizard",
  spock: "Spock",
};

function ThrowGlyph({ t, size = "md" }: { t: Throw; size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "lg"
      ? "text-5xl md:text-6xl"
      : size === "sm"
        ? "text-xl"
        : "text-3xl md:text-4xl";
  return (
    <span className={`${cls} leading-none select-none`} aria-label={THROW_LABEL[t]}>
      {THROW_GLYPH[t]}
    </span>
  );
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

  const submit = async (t: Throw) => {
    if (isOver || !iAmInMatch) return;
    await sendMove({ kind: "throw", throw: t });
  };

  const meName = playersById[me]?.name ?? "You";
  const oppName = (opponentId && playersById[opponentId]?.name) || "Opponent";

  const scoreboard = (
    <Scoreboard
      meName={meName}
      oppName={oppName}
      myScore={myScore}
      oppScore={oppScore}
      round={view.round}
      winsToClinch={view.winsToClinch}
      isOver={isOver}
      didIWin={didIWin}
    />
  );

  const action = (
    <div className="flex flex-col items-center gap-5 w-full">
      {!isOver && iAmInMatch && (
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
            {mySubmitted ? "Locked in — waiting on opponent" : "Choose your throw"}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            {THROWS.map((t) => {
              const selected = view.myThrow === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => submit(t)}
                  className={[
                    "group relative flex flex-col items-center justify-center",
                    "h-20 w-20 md:h-24 md:w-24 rounded-2xl",
                    "bg-base-100 transition-all duration-200 cursor-pointer",
                    selected
                      ? "ring-2 ring-primary scale-[1.04]"
                      : "hover:scale-[1.04] hover:bg-base-200",
                  ].join(" ")}
                  style={{
                    boxShadow: selected
                      ? "0 0 0 2px var(--color-primary), 0 10px 24px color-mix(in oklch, var(--color-primary) 25%, transparent)"
                      : "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.05)",
                  }}
                  aria-label={THROW_LABEL[t]}
                  aria-pressed={selected}
                >
                  <ThrowGlyph t={t} size="lg" />
                  <span
                    className="mt-1 text-[10px] uppercase tracking-[0.14em] text-base-content/60 font-semibold"
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
          Spectating — throws stay hidden until each round resolves
        </div>
      )}

      {isOver && (
        <div
          className={[
            "rounded-2xl px-5 py-3 parlor-rise",
            didIWin
              ? "bg-success/15 ring-1 ring-success text-success"
              : iAmInMatch
                ? "bg-error/10 ring-1 ring-error/60 text-error"
                : "bg-base-200 ring-1 ring-base-300 text-base-content",
          ].join(" ")}
        >
          <div className="text-xs uppercase tracking-[0.22em] font-semibold">
            {didIWin
              ? "You win the match"
              : iAmInMatch
                ? "You lose the match"
                : `${(view.winner && playersById[view.winner]?.name) || "A player"} wins the match`}
          </div>
        </div>
      )}
    </div>
  );

  const history = view.roundHistory.length > 0 ? (
    <div className="flex justify-center">
      <RoundHistory
        history={view.roundHistory}
        me={me}
        opponentId={opponentId ?? null}
        meName={meName}
        oppName={oppName}
      />
    </div>
  ) : undefined;

  return (
    <PlayerUILayout
      topStrip={<div className="flex justify-center">{scoreboard}</div>}
      main={action}
      bottomStrip={history}
      containerMaxWidth={900}
      mainMaxWidth={640}
      gap={1.25}
    />
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
        <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/55 font-semibold">
          {isOver ? "Final" : `Round ${round}`}
        </div>
        <div className="font-display text-2xl md:text-3xl leading-none mt-1">
          <span className={myScore > oppScore ? "text-primary" : undefined}>{myScore}</span>
          <span className="text-base-content/40 mx-1.5">:</span>
          <span className={oppScore > myScore ? "text-secondary" : undefined}>{oppScore}</span>
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
    <div className="flex items-center gap-4 text-xs text-base-content/60 tracking-wide mt-1">
      <div className="flex items-center gap-1.5">
        <Pulse on={mySubmitted} />
        <span>
          You:{" "}
          {mySubmitted && myThrow ? (
            <>
              <span className="font-semibold text-primary">{THROW_LABEL[myThrow]}</span>
              <span className="ml-1 text-base-content/45">(tap another to change)</span>
            </>
          ) : (
            <span className="text-base-content/50">picking…</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Pulse on={oppSubmitted} />
        <span>
          Opponent:{" "}
          <span
            className={
              oppSubmitted ? "font-semibold text-secondary" : "text-base-content/50"
            }
          >
            {oppSubmitted ? "locked in" : "picking…"}
          </span>
        </span>
      </div>
    </div>
  );
}

function Pulse({ on }: { on: boolean }) {
  return (
    <span
      className="h-2 w-2 rounded-full"
      style={{
        background: on ? "var(--color-success)" : "var(--color-base-content)",
        opacity: on ? 1 : 0.25,
        boxShadow: on
          ? "0 0 0 3px color-mix(in oklch, var(--color-success) 25%, transparent)"
          : undefined,
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
  return (
    <div className="w-full max-w-md">
      <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/50 font-semibold mb-2">
        Rounds
      </div>
      <ol className="flex flex-col gap-1.5">
        {history.map((r, i) => {
          const myThrow = r.throws[me];
          const oppThrow = opponentId ? r.throws[opponentId] : undefined;
          const tied = r.winner === null;
          const iWon = !tied && r.winner === me;
          return (
            <li
              key={i}
              className={[
                "flex items-center justify-between gap-3 rounded-xl px-3 py-2",
                "bg-base-100 ring-1",
                tied
                  ? "ring-base-300"
                  : iWon
                    ? "ring-success/50"
                    : "ring-error/40",
              ].join(" ")}
            >
              <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/50 font-semibold w-12">
                R{i + 1}
              </span>
              <div className="flex items-center gap-2 flex-1 justify-center">
                <span className="text-xs text-base-content/70 truncate max-w-[80px]">
                  {meName}
                </span>
                {myThrow && <ThrowGlyph t={myThrow} size="sm" />}
                <span className="text-[10px] text-base-content/40 mx-1">vs</span>
                {oppThrow && <ThrowGlyph t={oppThrow} size="sm" />}
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
