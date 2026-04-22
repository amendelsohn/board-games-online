import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BOARD_SIZE,
  GOMOKU_TYPE,
  cellAt,
  type GomokuMove,
  type GomokuView,
} from "./shared";

function GomokuBoard({
  view,
  me,
  isMyTurn,
  sendMove,
}: BoardProps<GomokuView, GomokuMove>) {
  const myStone = view.colors[me];
  const isOver = view.winner !== null || view.isDraw;
  const winningSet = new Set(view.winningLine ?? []);
  const lastIdx =
    view.lastMove !== null
      ? view.lastMove.row * BOARD_SIZE + view.lastMove.col
      : -1;

  const handleClick = (row: number, col: number) => {
    if (!isMyTurn || isOver) return;
    if (cellAt(view.cells, row, col) !== null) return;
    void sendMove({ kind: "place", row, col });
  };

  // Star points (hoshi) traditional for 15x15
  const starPoints = new Set<number>([
    3 * BOARD_SIZE + 3,
    3 * BOARD_SIZE + 11,
    7 * BOARD_SIZE + 7,
    11 * BOARD_SIZE + 3,
    11 * BOARD_SIZE + 11,
  ]);

  const stoneColor = (s: "B" | "W"): string =>
    s === "B" ? "var(--color-neutral)" : "var(--color-base-100)";

  const stoneInk = (s: "B" | "W"): string =>
    s === "B"
      ? "oklch(100% 0 0 / 0.18)"
      : "oklch(0% 0 0 / 0.18)";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        You play{" "}
        <span
          className={
            myStone === "B"
              ? "text-base-content font-bold"
              : "text-base-content/90 font-bold"
          }
        >
          {myStone === "B" ? "Black" : myStone === "W" ? "White" : "?"}
        </span>
      </div>

      <div
        className="relative rounded-2xl overflow-auto max-w-full"
        style={{
          background:
            "color-mix(in oklch, var(--color-warning) 28%, var(--color-base-300) 72%)",
          padding: "14px",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -2px 0 oklch(0% 0 0 / 0.14), 0 18px 42px color-mix(in oklch, var(--color-neutral) 35%, transparent)",
        }}
      >
        <div
          className="relative"
          style={{
            width: `${BOARD_SIZE * 28}px`,
            height: `${BOARD_SIZE * 28}px`,
          }}
        >
          {/* Grid lines + star points — drawn behind the cells */}
          <svg
            viewBox={`0 0 ${BOARD_SIZE * 28} ${BOARD_SIZE * 28}`}
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height="100%"
          >
            <g
              stroke="color-mix(in oklch, var(--color-neutral) 60%, transparent)"
              strokeWidth="1"
              strokeLinecap="round"
            >
              {Array.from({ length: BOARD_SIZE }).map((_, i) => {
                // Lines run between cell CENTERS: center = i*28 + 14
                const pos = i * 28 + 14;
                const start = 14;
                const end = (BOARD_SIZE - 1) * 28 + 14;
                return (
                  <g key={i}>
                    <line x1={start} y1={pos} x2={end} y2={pos} />
                    <line x1={pos} y1={start} x2={pos} y2={end} />
                  </g>
                );
              })}
            </g>
            <g fill="color-mix(in oklch, var(--color-neutral) 80%, transparent)">
              {Array.from(starPoints).map((idx) => {
                const r = Math.floor(idx / BOARD_SIZE);
                const c = idx % BOARD_SIZE;
                return (
                  <circle
                    key={idx}
                    cx={c * 28 + 14}
                    cy={r * 28 + 14}
                    r={2.75}
                  />
                );
              })}
            </g>
          </svg>

          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `repeat(${BOARD_SIZE}, 28px)`,
              gridTemplateRows: `repeat(${BOARD_SIZE}, 28px)`,
            }}
          >
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
              const row = Math.floor(i / BOARD_SIZE);
              const col = i % BOARD_SIZE;
              const cell = view.cells[i] ?? null;
              const isWinning = winningSet.has(i);
              const isLast = i === lastIdx;
              const clickable = !isOver && isMyTurn && cell === null;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!clickable}
                  onClick={() => handleClick(row, col)}
                  aria-label={`place stone at row ${row + 1} column ${col + 1}`}
                  className={[
                    "relative flex items-center justify-center",
                    "bg-transparent border-0 p-0",
                    clickable ? "cursor-pointer" : "cursor-default",
                    "group",
                  ].join(" ")}
                  style={{ width: "28px", height: "28px" }}
                >
                  {cell !== null ? (
                    <span
                      className={[
                        "rounded-full parlor-fade",
                        isWinning ? "parlor-win" : "",
                      ].join(" ")}
                      style={{
                        width: "22px",
                        height: "22px",
                        background: stoneColor(cell),
                        boxShadow: isWinning
                          ? `0 0 0 2px var(--color-success), inset 0 -2px 0 ${stoneInk(cell)}, inset 0 1px 0 oklch(100% 0 0 / 0.3)`
                          : isLast
                            ? `0 0 0 2px var(--color-primary), inset 0 -2px 0 ${stoneInk(cell)}, inset 0 1px 0 oklch(100% 0 0 / 0.3)`
                            : `inset 0 -2px 0 ${stoneInk(cell)}, inset 0 1px 0 oklch(100% 0 0 / 0.3), 0 2px 4px oklch(0% 0 0 / 0.25)`,
                      }}
                    />
                  ) : clickable && myStone ? (
                    <span
                      className="rounded-full opacity-0 group-hover:opacity-60 transition-opacity"
                      style={{
                        width: "22px",
                        height: "22px",
                        background: stoneColor(myStone),
                      }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-xs text-base-content/50 tracking-wide">
        Five or more in a row — any direction.
      </div>
    </div>
  );
}

export const gomokuClientModule: ClientGameModule<
  GomokuView,
  GomokuMove,
  Record<string, never>
> = {
  type: GOMOKU_TYPE,
  Board: GomokuBoard,
};
