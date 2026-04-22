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

  // Animate the most recent drop — remember which cell was just filled so
  // we apply the drop-in animation on mount of this cell change.
  const [droppedIndex, setDroppedIndex] = useState<number | null>(null);
  const prevCellsRef = useRef<readonly Cell[]>(view.cells);
  useEffect(() => {
    const prev = prevCellsRef.current;
    for (let i = 0; i < view.cells.length; i++) {
      if (prev[i] === null && view.cells[i] !== null) {
        setDroppedIndex(i);
        setTimeout(() => setDroppedIndex(null), 400);
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

  const cellColor = (c: Cell): string => {
    if (c === "R") return "bg-error";
    if (c === "Y") return "bg-warning";
    return "bg-primary-content/20";
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-sm text-base-content/70">
        You are{" "}
        <span
          className={
            myColor === "R"
              ? "text-error font-bold"
              : "text-warning font-bold"
          }
        >
          {myColor === "R" ? "Red" : "Yellow"}
        </span>
      </div>

      <div className="bg-primary rounded-2xl shadow-xl p-3">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          }}
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

            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onMouseEnter={() => setHoverCol(col)}
                onMouseLeave={() => setHoverCol(null)}
                onClick={() => handleDrop(col)}
                className="w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center bg-primary-focus/30"
                aria-label={`drop in column ${col}`}
              >
                <span
                  className={[
                    "w-full h-full rounded-full transition-all",
                    cell !== null ? cellColor(cell) : "bg-base-100",
                    cell !== null ? "shadow-inner" : "",
                    isLast ? "ring-2 ring-white" : "",
                    isWinning ? "ring-4 ring-success bgo-win" : "",
                    isPreview && cell === null
                      ? myColor === "R"
                        ? "bg-error/40"
                        : "bg-warning/40"
                      : "",
                    justDropped ? "bgo-drop" : "",
                    clickable && cell === null
                      ? "cursor-pointer"
                      : "cursor-default",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-base-content/50">
        Click a column to drop your piece.
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
