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

function ConnectFourBoard({
  view,
  me,
  isMyTurn,
  sendMove,
}: BoardProps<ConnectFourView, ConnectFourMove>) {
  const myColor = view.colors[me];
  const isOver = view.winner !== null || view.isDraw;
  const [hoverCol, setHoverCol] = useState<number | null>(null);

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

  return (
    <div className="flex flex-col items-center gap-5">
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
          background: "var(--color-primary)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -2px 0 oklch(0% 0 0 / 0.12), 0 16px 40px color-mix(in oklch, var(--color-primary) 30%, transparent)",
        }}
      >
        <div
          className="grid gap-1.5"
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
                  : "oklch(100% 0 0 / 0.08)";

            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onMouseEnter={() => setHoverCol(col)}
                onMouseLeave={() => setHoverCol(null)}
                onClick={() => handleDrop(col)}
                className="h-9 w-9 md:h-12 md:w-12 rounded-full flex items-center justify-center"
                style={{
                  background:
                    "color-mix(in oklch, var(--color-primary-content) 12%, transparent)",
                  boxShadow: "inset 0 2px 4px oklch(0% 0 0 / 0.25)",
                }}
                aria-label={`drop in column ${col}`}
              >
                <span
                  className={[
                    "h-full w-full rounded-full transition-all",
                    cell !== null
                      ? "shadow-[inset_0_-2px_0_oklch(0%_0_0_/_0.15),inset_0_1px_0_oklch(100%_0_0_/_0.25)]"
                      : "",
                    isWinning ? "ring-[3px] ring-success parlor-win" : "",
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

      <div className="text-xs text-base-content/50 tracking-wide">
        Tap a column to drop a piece.
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
