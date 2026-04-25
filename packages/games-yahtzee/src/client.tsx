import { useState } from "react";
import {
  PlayerUILayout,
  type BoardProps,
  type ClientGameModule,
} from "@bgo/sdk-client";
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

/** Pip arrangement for each face 1..6. Coords in a 20×20 box. */
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
}: {
  face: number;
  held: boolean;
  onClick?: () => void;
  disabled?: boolean;
  rolled: boolean;
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
        held && !empty ? "ring-2 ring-warning" : "",
        !disabled ? "hover:scale-[1.05] cursor-pointer" : "cursor-default",
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

  const canRoll = isMyTurn && !isOver && view.turnRollNumber < MAX_ROLLS_PER_TURN;
  const canAssign = isMyTurn && !isOver && rolled;

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
    // First roll of the turn: server ignores keepMask. Afterwards, kept dice
    // are the ones we've flagged.
    await sendMove({ kind: "roll", keepMask: holdMask });
  };

  const handleAssign = async (cat: Category) => {
    if (!canAssign) return;
    if (typeof myCard[cat] === "number") return;
    await sendMove({ kind: "assign", category: cat });
    // Clear local holds for the next turn.
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

  // Top strip: tight horizontal — turn status, dice, roll button. Cuts the
  // old "dice column == half the screen" pattern; the scorecard is the
  // thinking surface and earns the main slot.
  const topStrip = (
    <div
      className="rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-5"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 85%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
      }}
    >
      <div className="flex flex-col gap-0.5 min-w-0 sm:min-w-[180px]">
        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
          {isOver ? "Result" : isMyTurn ? "Your turn" : "Rolling"}
        </div>
        <div
          className="font-display tracking-tight"
          style={{ fontSize: "1.125rem", lineHeight: 1.1 }}
        >
          {isOver ? (
            view.isDraw ? (
              "Draw"
            ) : (
              <>
                <span className="text-success">{winnerName}</span> wins
              </>
            )
          ) : isMyTurn ? (
            <>
              <span className="text-primary">{rollsLeft}</span> roll
              {rollsLeft === 1 ? "" : "s"} left
            </>
          ) : (
            <>{displayName(view.current)} rolling</>
          )}
        </div>
      </div>
      <div className="flex gap-2 md:gap-3 flex-1 justify-center">
        {view.dice.map((face, i) => (
          <Die
            key={i}
            face={face}
            held={holdMask[i] === true}
            rolled={rolled}
            disabled={!isMyTurn || !rolled || isOver}
            onClick={() => toggleHold(i)}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={!canRoll}
        onClick={handleRoll}
        className={[
          "btn btn-primary px-5 font-display rounded-full",
          !canRoll ? "btn-disabled opacity-60" : "",
        ].join(" ")}
      >
        {view.turnRollNumber === 0 ? "Roll" : `Reroll (${rollsLeft})`}
      </button>
    </div>
  );

  const scorecard = (
    <div className="w-full">
      <div
        className="rounded-2xl overflow-x-auto"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 60%, transparent)",
          boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.1)",
        }}
      >
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-[0.65rem] uppercase tracking-[0.16em] text-base-content/55">
              <th className="text-left px-3 py-2">Category</th>
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
              />
            ))}
            <tr className="bg-base-100/30">
              <td className="px-3 py-1.5 text-xs text-base-content/60 italic">
                Upper (≥ {UPPER_BONUS_THRESHOLD} → +{UPPER_BONUS})
              </td>
              {view.players.map((pid) => {
                const sub = upperSubtotal(view.scorecards[pid] ?? {});
                return (
                  <td
                    key={pid}
                    className="px-3 py-1.5 text-center text-xs"
                  >
                    <span
                      className={
                        sub >= UPPER_BONUS_THRESHOLD
                          ? "text-success font-semibold"
                          : "text-base-content/70"
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
              />
            ))}
            <tr className="bg-base-100/60 font-display">
              <td className="px-3 py-2 text-sm font-bold">Total</td>
              {view.players.map((pid) => {
                const total = totals[pid] ?? 0;
                const isTopScore =
                  isOver && view.winner === pid && !view.isDraw;
                return (
                  <td
                    key={pid}
                    className={[
                      "px-3 py-2 text-center text-base",
                      isTopScore ? "text-success font-bold" : "",
                    ].join(" ")}
                  >
                    {total}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const banner = (() => {
    if (isOver) {
      return (
        <div className="text-center text-xs uppercase tracking-[0.22em] text-base-content/55">
          {view.isDraw
            ? "All scorecards filled — tied at the top."
            : `${winnerName} wins with ${view.winner ? totals[view.winner] : 0} points.`}
        </div>
      );
    }
    if (myFilled) {
      return (
        <div className="text-center text-xs uppercase tracking-[0.2em] text-base-content/50">
          Your card is full — waiting on the others.
        </div>
      );
    }
    if (isMyTurn && rolled) {
      return (
        <div className="text-center text-[0.7rem] uppercase tracking-[0.18em] text-base-content/45">
          Tap dice to hold before your next roll · or assign a category above
        </div>
      );
    }
    return null;
  })();

  return (
    <PlayerUILayout
      topStrip={topStrip}
      main={scorecard}
      bottomStrip={banner}
      mainMaxWidth={780}
      containerMaxWidth={1100}
    />
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
}: {
  cat: Category;
  view: YahtzeeView;
  me: string;
  canAssign: boolean;
  dice: number[];
  rolled: boolean;
  onAssign: (cat: Category) => void;
}) {
  return (
    <tr className="border-t border-base-300/40">
      <td className="px-3 py-1.5 text-base-content/80">
        {CATEGORY_LABELS[cat]}
      </td>
      {view.players.map((pid) => {
        const card = view.scorecards[pid] ?? {};
        const value = card[cat];
        const filled = typeof value === "number";
        const isMine = pid === me;
        const preview =
          !filled && isMine && canAssign && rolled
            ? scoreFor(cat, dice)
            : null;

        if (filled) {
          return (
            <td
              key={pid}
              className="px-3 py-1.5 text-center text-base-content/80"
            >
              {value}
            </td>
          );
        }

        if (isMine && canAssign) {
          return (
            <td key={pid} className="px-1 py-0.5 text-center">
              <button
                type="button"
                onClick={() => onAssign(cat)}
                className={[
                  "w-full rounded-md px-2 py-1 text-sm transition-colors",
                  "hover:bg-primary/15 cursor-pointer",
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
            className="px-3 py-1.5 text-center text-base-content/30"
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
