import { useEffect, useRef, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  CONNECT_FOUR_TYPE,
  COLS,
  ROWS,
  dropRow,
  type ConnectFourMove,
  type ConnectFourView,
  type Cell,
} from "./shared";

const CONNECT_FOUR_KEYFRAMES = `
@keyframes connectfour-start-pulse {
  0%, 100% {
    opacity: 0.55;
    transform: translateY(-6px) scale(0.96);
  }
  50% {
    opacity: 0.85;
    transform: translateY(-10px) scale(1.02);
  }
}
.connectfour-start-pulse {
  animation: connectfour-start-pulse 1400ms ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .connectfour-start-pulse { animation: none; opacity: 0.7; }
}
@keyframes connectfour-win-glow {
  0%, 100% {
    box-shadow:
      0 0 0 3px color-mix(in oklch, var(--color-warning) 80%, transparent),
      0 0 14px color-mix(in oklch, var(--color-warning) 55%, transparent);
  }
  50% {
    box-shadow:
      0 0 0 4px color-mix(in oklch, var(--color-warning) 55%, transparent),
      0 0 22px color-mix(in oklch, var(--color-warning) 30%, transparent);
  }
}
.connectfour-win-glow {
  animation: connectfour-win-glow 1400ms ease-in-out infinite;
  border-radius: 9999px;
}
@media (prefers-reduced-motion: reduce) {
  .connectfour-win-glow {
    animation: none;
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-warning) 75%, transparent);
  }
}
`;

function ConnectFourBoard({
  view,
  me,
  isMyTurn,
  sendMove,
  players,
}: BoardProps<ConnectFourView, ConnectFourMove>) {
  const myColor = view.colors[me];
  const isOver = view.winner !== null || view.isDraw;
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const oppName = (() => {
    const opp = players.find((p) => p.id !== me);
    return opp?.name ?? "Opponent";
  })();

  const boardIsEmpty = view.cells.every((c) => c === null);
  const showStartCue =
    boardIsEmpty && isMyTurn && !isOver && hoverCol === null;

  const statusLine = (() => {
    if (view.isDraw) return "Draw — the board is full.";
    if (view.winner) {
      return view.winner === me
        ? "You connected four."
        : `${oppName} connected four.`;
    }
    if (!myColor) return "Spectating.";
    if (isMyTurn) return "Your turn — tap a column.";
    return `${oppName} is thinking.`;
  })();

  const [droppedIndex, setDroppedIndex] = useState<number | null>(null);
  const prevCellsRef = useRef<readonly Cell[]>(view.cells);
  useEffect(() => {
    const prev = prevCellsRef.current;
    for (let i = 0; i < view.cells.length; i++) {
      if (prev[i] === null && view.cells[i] !== null) {
        setDroppedIndex(i);
        setTimeout(() => setDroppedIndex(null), 420);
        break;
      }
    }
    prevCellsRef.current = view.cells;
  }, [view.cells]);

  const handleDrop = (col: number) => {
    if (!isMyTurn || isOver) return;
    if (dropRow(view.cells, col) < 0) return;
    void sendMove({ kind: "drop", col });
  };

  const nextRowForCol = (col: number) => dropRow(view.cells, col);
  const previewRow =
    hoverCol !== null && !isOver && isMyTurn ? nextRowForCol(hoverCol) : -1;

  const pieceColor = (c: Cell): string => {
    if (c === "R") return "var(--color-error)";
    if (c === "Y") return "var(--color-warning)";
    return "transparent";
  };

  // Zero-indexed middle column — Connect Four is 7 wide so the center is 3.
  const startCueCol = Math.floor(COLS / 2);

  return (
    <div className="flex flex-col items-center gap-5">
      <style>{CONNECT_FOUR_KEYFRAMES}</style>

      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        You are{" "}
        <span
          className={
            myColor === "R" ? "text-error font-bold" : "text-warning font-bold"
          }
        >
          {myColor === "R" ? "Red" : "Gold"}
        </span>
      </div>

      <div
        className="relative rounded-2xl p-3 md:p-4"
        style={{
          // Walnut frame instead of the full-primary flood. The former looked
          // like a UI accent panel; this reads like a wooden Connect Four box.
          background: "oklch(28% 0.02 40)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.10), inset 0 -2px 0 oklch(0% 0 0 / 0.28), 0 16px 40px color-mix(in oklch, oklch(15% 0.01 40) 40%, transparent)",
        }}
      >
        {/* Floating start cue: a ghost disc in my color, bobbing above the
            center column. Only shows on an untouched board when it's my turn
            and the pointer isn't already over a column. */}
        {showStartCue && (
          <div
            aria-hidden
            className="absolute left-0 right-0 pointer-events-none"
            style={{ top: "-1.25rem" }}
          >
            <div
              className="grid gap-1.5 px-3 md:px-4"
              style={{
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: COLS }).map((_, col) => (
                <div key={col} className="h-9 w-9 md:h-12 md:w-12 relative">
                  {col === startCueCol && (
                    <span
                      className="absolute inset-0 rounded-full connectfour-start-pulse"
                      style={{
                        background: `color-mix(in oklch, ${pieceColor(myColor ?? "R")} 55%, transparent)`,
                        boxShadow:
                          "inset 0 1px 0 oklch(100% 0 0 / 0.3), inset 0 -2px 0 oklch(0% 0 0 / 0.2)",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className="grid gap-1.5 relative"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: ROWS * COLS }).map((_, i) => {
            const row = Math.floor(i / COLS);
            const col = i % COLS;
            const cell = view.cells[i] ?? null;
            const isLast =
              view.lastMove &&
              view.lastMove.row * COLS + view.lastMove.col === i;
            const isWinning = view.winningCells?.includes(i) ?? false;
            const isPreview = row === previewRow && col === hoverCol;
            const justDropped = droppedIndex === i;
            const clickable = !isOver && isMyTurn && nextRowForCol(col) >= 0;

            const pieceBg =
              cell !== null
                ? pieceColor(cell)
                : isPreview
                  ? `color-mix(in oklch, ${pieceColor(myColor ?? "R")} 35%, transparent)`
                  : "oklch(100% 0 0 / 0.06)";

            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onMouseEnter={() => setHoverCol(col)}
                onMouseLeave={() => setHoverCol(null)}
                onClick={() => handleDrop(col)}
                className="h-9 w-9 md:h-12 md:w-12 rounded-full flex items-center justify-center relative"
                style={{
                  background:
                    "color-mix(in oklch, var(--color-base-100) 12%, transparent)",
                  boxShadow:
                    "inset 0 2px 5px oklch(0% 0 0 / 0.45), inset 0 -1px 0 oklch(100% 0 0 / 0.08)",
                }}
                aria-label={`drop in column ${col}`}
              >
                {isWinning && (
                  <span
                    aria-hidden
                    className="absolute inset-[-4px] connectfour-win-glow pointer-events-none"
                  />
                )}
                <span
                  className={[
                    "h-full w-full rounded-full transition-all relative",
                    cell !== null
                      ? "shadow-[inset_0_-2px_0_oklch(0%_0_0_/_0.25),inset_0_1px_0_oklch(100%_0_0_/_0.28)]"
                      : "",
                    isLast && !isWinning
                      ? "ring-2 ring-base-100/70"
                      : "",
                    justDropped ? "parlor-drop" : "",
                  ].join(" ")}
                  style={{
                    background: pieceBg,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-base-content/55 tracking-wide">
        {statusLine}
      </div>
    </div>
  );
}

export const connectFourClientModule: ClientGameModule<
  ConnectFourView,
  ConnectFourMove,
  Record<string, never>
> = {
  type: CONNECT_FOUR_TYPE,
  Board: ConnectFourBoard,
};
