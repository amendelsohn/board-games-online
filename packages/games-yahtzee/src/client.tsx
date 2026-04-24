import { useEffect, useRef, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  DICE_COUNT,
  MAX_ROLLS_PER_TURN,
  UPPER_BONUS,
  UPPER_BONUS_THRESHOLD,
  YAHTZEE_TYPE,
  cardFilled,
  grandTotal,
  scoreFor,
  upperSubtotal,
  type Category,
  type YahtzeeMove,
  type YahtzeeView,
} from "./shared";

const CATEGORY_LABELS: Record<Category, string> = {
  ones: "Ones",
  twos: "Twos",
  threes: "Threes",
  fours: "Fours",
  fives: "Fives",
  sixes: "Sixes",
  threeKind: "Three of a Kind",
  fourKind: "Four of a Kind",
  fullHouse: "Full House",
  smallStraight: "Small Straight",
  largeStraight: "Large Straight",
  yahtzee: "Yahtzee",
  chance: "Chance",
};

const UPPER: Category[] = ["ones", "twos", "threes", "fours", "fives", "sixes"];
const LOWER: Category[] = [
  "threeKind",
  "fourKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
];

const PIPS: Record<number, [number, number][]> = {
  1: [[10, 10]],
  2: [[6, 6], [14, 14]],
  3: [[6, 6], [10, 10], [14, 14]],
  4: [[6, 6], [14, 6], [6, 14], [14, 14]],
  5: [[6, 6], [14, 6], [10, 10], [6, 14], [14, 14]],
  6: [[6, 6], [14, 6], [6, 10], [14, 10], [6, 14], [14, 14]],
};

function Die({
  face,
  held,
  onClick,
  disabled,
  rolled,
  rolling,
}: {
  face: number;
  held: boolean;
  onClick?: () => void;
  disabled?: boolean;
  rolled: boolean;
  rolling?: boolean;
}) {
  const empty = !rolled || face < 1 || face > 6;
  const pips = empty ? [] : (PIPS[face] ?? []);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "relative rounded-xl transition-all duration-200",
        "h-14 w-14 md:h-16 md:w-16",
        held && !empty ? "ring-2 ring-warning -translate-y-1" : "",
        !disabled ? "hover:scale-[1.05] cursor-pointer" : "cursor-default",
        rolling ? "yahtzee-tumble" : "",
      ].join(" ")}
      style={{
        background: empty
          ? "color-mix(in oklch, var(--color-base-300) 60%, transparent)"
          : held
            ? "color-mix(in oklch, var(--color-warning) 20%, var(--color-base-100))"
            : "var(--color-base-100)",
        boxShadow: empty
          ? "inset 0 0 0 1px oklch(0% 0 0 / 0.08)"
          : "inset 0 1px 0 oklch(100% 0 0 / 0.25), inset 0 -2px 0 oklch(0% 0 0 / 0.15), 0 4px 10px oklch(0% 0 0 / 0.12)",
      }}
      aria-label={empty ? "unrolled die" : `die showing ${face}${held ? ", held" : ""}`}
    >
      <svg viewBox="0 0 20 20" className="absolute inset-0 h-full w-full">
        {pips.map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={1.7}
            fill="var(--color-base-content)"
          />
        ))}
      </svg>
    </button>
  );
}

function YahtzeeBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<YahtzeeView, YahtzeeMove>) {
  const [holdMask, setHoldMask] = useState<boolean[]>(() =>
    new Array(DICE_COUNT).fill(false),
  );

  const rolled = view.turnRollNumber > 0;
  const rollsLeft = MAX_ROLLS_PER_TURN - view.turnRollNumber;
  const isOver = view.phase === "gameOver";
  const myCard = view.scorecards[me] ?? {};
  const myFilled = cardFilled(myCard);
  const myFilledCount = Object.values(myCard).filter(
    (v) => typeof v === "number",
  ).length;

  const canRoll = isMyTurn && !isOver && view.turnRollNumber < MAX_ROLLS_PER_TURN;
  const canAssign = isMyTurn && !isOver && rolled;
  const heldCount = holdMask.filter(Boolean).length;

  // Roll-tumble: detect die-face changes and run a 500ms keyframe.
  const prevDiceRef = useRef<number[]>(view.dice.slice());
  const [rollingIdxs, setRollingIdxs] = useState<Set<number>>(new Set());
  useEffect(() => {
    const prev = prevDiceRef.current;
    const changed = new Set<number>();
    for (let i = 0; i < view.dice.length; i++) {
      if (prev[i] !== view.dice[i]) changed.add(i);
    }
    prevDiceRef.current = view.dice.slice();
    if (changed.size > 0) {
      setRollingIdxs(changed);
      const t = setTimeout(() => setRollingIdxs(new Set()), 500);
      return () => clearTimeout(t);
    }
  }, [view.dice]);

  const toggleHold = (i: number) => {
    if (!isMyTurn || !rolled || isOver) return;
    setHoldMask((prev) => {
      const next = prev.slice();
      next[i] = !next[i];
      return next;
    });
  };

  const handleRoll = async () => {
    if (!canRoll) return;
    await sendMove({ kind: "roll", keepMask: holdMask });
  };

  const handleAssign = async (cat: Category) => {
    if (!canAssign) return;
    if (typeof myCard[cat] === "number") return;
    await sendMove({ kind: "assign", category: cat });
    setHoldMask(new Array(DICE_COUNT).fill(false));
  };

  const displayName = (pid: string): string => {
    const p = players.find((x) => x.id === pid);
    return p?.name ?? pid.slice(0, 6);
  };

  const totals = Object.fromEntries(
    view.players.map((pid) => [pid, grandTotal(view.scorecards[pid] ?? {})]),
  ) as Record<string, number>;

  const winnerName = view.winner ? displayName(view.winner) : null;

  const stickyBg: React.CSSProperties = {
    background: "var(--color-base-100)",
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl">
      <style>{`
        @keyframes yahtzee-tumble {
          0%   { transform: rotate(0deg) scale(1); }
          30%  { transform: rotate(-20deg) scale(0.9); }
          60%  { transform: rotate(15deg) scale(1.08); }
          100% { transform: rotate(0deg) scale(1); }
        }
        .yahtzee-tumble { animation: yahtzee-tumble 500ms cubic-bezier(0.22, 1, 0.36, 1); }
      `}</style>

      {/* Turn banner */}
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-0.5"
      >
        <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
          {isOver ? (
            view.isDraw ? (
              <span className="text-base-content">Draw</span>
            ) : (
              <span>
                Winner:{" "}
                <span className="text-success font-bold">{winnerName}</span>
              </span>
            )
          ) : isMyTurn ? (
            <>
              Your turn ·{" "}
              <span className="text-primary font-bold">
                {rollsLeft} roll{rollsLeft === 1 ? "" : "s"} left
              </span>
            </>
          ) : (
            <>
              <span className="text-secondary font-bold">
                {displayName(view.current)}
              </span>{" "}
              is rolling
            </>
          )}
        </div>
        {!isOver && (
          <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/45 font-mono tabular-nums">
            Round {Math.min(myFilledCount + 1, 13)}/13
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Dice column */}
        <div className="flex flex-col items-center gap-4 flex-1">
          <div
            className="relative rounded-2xl p-4"
            style={{
              background:
                "color-mix(in oklch, var(--color-base-300) 75%, color-mix(in oklch, var(--color-warning) 8%, transparent))",
              boxShadow:
                "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
            }}
          >
            <div className="flex gap-2 md:gap-3">
              {view.dice.map((face, i) => (
                <Die
                  key={i}
                  face={face}
                  held={holdMask[i] === true}
                  rolled={rolled}
                  disabled={!isMyTurn || !rolled || isOver}
                  onClick={() => toggleHold(i)}
                  rolling={rollingIdxs.has(i)}
                />
              ))}
            </div>
            {isMyTurn && rolled && !isOver && (
              <div className="mt-2 flex items-center justify-center gap-3 text-[0.7rem] uppercase tracking-[0.18em] text-base-content/45">
                <span>Tap dice to hold before your next roll</span>
                {heldCount > 0 && (
                  <span className="text-warning font-semibold font-mono tabular-nums">
                    {heldCount} held
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!canRoll}
            onClick={handleRoll}
            className={[
              "btn btn-primary px-6 font-display",
              !canRoll ? "btn-disabled opacity-60" : "",
            ].join(" ")}
          >
            {view.turnRollNumber === 0 ? "Roll" : `Reroll (${rollsLeft} left)`}
          </button>
        </div>

        {/* Scorecard column */}
        <div className="flex-1 w-full">
          <div
            className="overflow-x-auto rounded-2xl"
            style={{
              background:
                "color-mix(in oklch, var(--color-base-300) 60%, transparent)",
              boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.1)",
            }}
          >
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-[0.65rem] uppercase tracking-[0.16em] text-base-content/55">
                  <th
                    className="text-left px-3 py-2 sticky left-0 z-10"
                    style={stickyBg}
                  >
                    Category
                  </th>
                  {view.players.map((pid) => (
                    <th
                      key={pid}
                      className={[
                        "px-3 py-2 text-center",
                        pid === view.current && !isOver
                          ? "text-primary font-bold"
                          : "",
                      ].join(" ")}
                    >
                      {displayName(pid)}
                      {pid === me && (
                        <span className="ml-1 text-base-content/45">(you)</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {UPPER.map((cat) => (
                  <ScoreRow
                    key={cat}
                    cat={cat}
                    view={view}
                    me={me}
                    canAssign={canAssign}
                    dice={view.dice}
                    rolled={rolled}
                    onAssign={handleAssign}
                    isOver={isOver}
                  />
                ))}
                <tr className="bg-base-100/30">
                  <td
                    className="px-3 py-1.5 text-xs text-base-content/60 italic sticky left-0 z-10"
                    style={stickyBg}
                  >
                    Upper (≥ {UPPER_BONUS_THRESHOLD} → +{UPPER_BONUS})
                  </td>
                  {view.players.map((pid) => {
                    const sub = upperSubtotal(view.scorecards[pid] ?? {});
                    const isCurrent = pid === view.current && !isOver;
                    return (
                      <td
                        key={pid}
                        className={[
                          "px-3 py-1.5 text-center text-xs",
                          isCurrent ? "bg-primary/5" : "",
                        ].join(" ")}
                      >
                        <span
                          className={
                            sub >= UPPER_BONUS_THRESHOLD
                              ? "text-success font-semibold font-mono tabular-nums"
                              : "text-base-content/70 font-mono tabular-nums"
                          }
                        >
                          {sub} / {UPPER_BONUS_THRESHOLD}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                {LOWER.map((cat) => (
                  <ScoreRow
                    key={cat}
                    cat={cat}
                    view={view}
                    me={me}
                    canAssign={canAssign}
                    dice={view.dice}
                    rolled={rolled}
                    onAssign={handleAssign}
                    isOver={isOver}
                  />
                ))}
                <tr className="bg-base-100/60 font-display">
                  <td
                    className="px-3 py-2 text-sm font-bold sticky left-0 z-10"
                    style={stickyBg}
                  >
                    Total
                  </td>
                  {view.players.map((pid) => {
                    const total = totals[pid] ?? 0;
                    const anyScored = Object.values(
                      view.scorecards[pid] ?? {},
                    ).some((v) => typeof v === "number");
                    const isTopScore =
                      isOver && view.winner === pid && !view.isDraw;
                    const isCurrent = pid === view.current && !isOver;
                    return (
                      <td
                        key={pid}
                        className={[
                          "px-3 py-2 text-center text-base font-mono tabular-nums",
                          isTopScore ? "text-success font-bold" : "",
                          isCurrent ? "bg-primary/5" : "",
                        ].join(" ")}
                      >
                        {anyScored ? total : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          {isOver && (
            <div
              className="mt-3 rounded-2xl p-5 flex flex-col gap-1 parlor-fade"
              style={{
                background: view.isDraw
                  ? "color-mix(in oklch, var(--color-warning) 14%, var(--color-base-100))"
                  : view.winner === me
                    ? "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))"
                    : "color-mix(in oklch, var(--color-base-content) 8%, var(--color-base-100))",
                border: view.isDraw
                  ? "1px solid color-mix(in oklch, var(--color-warning) 40%, transparent)"
                  : view.winner === me
                    ? "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)"
                    : "1px solid color-mix(in oklch, var(--color-base-content) 20%, transparent)",
              }}
            >
              <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
                ◆ {view.isDraw ? "Draw" : "Final"} ◆
              </div>
              <div
                className="font-display tracking-tight"
                style={{ fontSize: "var(--text-display-sm)" }}
              >
                {view.isDraw
                  ? "All scorecards tied."
                  : view.winner === me
                    ? "You win."
                    : `${winnerName} wins.`}
              </div>
              {view.winner && !view.isDraw && (
                <div className="text-sm text-base-content/65 font-mono tabular-nums">
                  {totals[view.winner]} points
                </div>
              )}
            </div>
          )}
          {!isOver && myFilled && (
            <div className="mt-3 text-center text-xs uppercase tracking-[0.2em] text-base-content/50">
              Your card is full — waiting on the others.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreRow({
  cat,
  view,
  me,
  canAssign,
  dice,
  rolled,
  onAssign,
  isOver,
}: {
  cat: Category;
  view: YahtzeeView;
  me: string;
  canAssign: boolean;
  dice: number[];
  rolled: boolean;
  onAssign: (cat: Category) => void;
  isOver: boolean;
}) {
  const stickyBg: React.CSSProperties = {
    background: "var(--color-base-100)",
  };
  return (
    <tr className="border-t border-base-300/40">
      <td
        className="px-3 py-1.5 text-base-content/80 sticky left-0 z-10"
        style={stickyBg}
      >
        {CATEGORY_LABELS[cat]}
      </td>
      {view.players.map((pid) => {
        const card = view.scorecards[pid] ?? {};
        const value = card[cat];
        const filled = typeof value === "number";
        const isMine = pid === me;
        const isCurrent = pid === view.current && !isOver;
        const preview =
          !filled && isMine && canAssign && rolled
            ? scoreFor(cat, dice)
            : null;
        const cellTint = isCurrent ? "bg-primary/5" : "";

        if (filled) {
          return (
            <td
              key={pid}
              className={[
                "px-3 py-1.5 text-center text-base-content/80 font-mono tabular-nums",
                cellTint,
              ].join(" ")}
            >
              {value}
            </td>
          );
        }

        if (isMine && canAssign) {
          return (
            <td
              key={pid}
              className={["px-1 py-0.5 text-center", cellTint].join(" ")}
            >
              <button
                type="button"
                onClick={() => onAssign(cat)}
                className={[
                  "w-full rounded-md px-2 py-1 text-sm transition-colors",
                  "hover:bg-primary/15 cursor-pointer font-mono tabular-nums",
                  preview !== null && preview > 0
                    ? "text-primary font-semibold"
                    : "text-base-content/40",
                ].join(" ")}
                aria-label={`Assign ${CATEGORY_LABELS[cat]} for ${preview ?? 0}`}
              >
                {preview ?? "—"}
              </button>
            </td>
          );
        }

        return (
          <td
            key={pid}
            className={[
              "px-3 py-1.5 text-center text-base-content/30",
              cellTint,
            ].join(" ")}
          >
            —
          </td>
        );
      })}
    </tr>
  );
}

export const yahtzeeClientModule: ClientGameModule<
  YahtzeeView,
  YahtzeeMove,
  Record<string, never>
> = {
  type: YAHTZEE_TYPE,
  Board: YahtzeeBoard,
};
