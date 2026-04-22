import { useEffect, useRef, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  REVERSI_TYPE,
  SIZE,
  type Cell,
  type ReversiMove,
  type ReversiView,
} from "./shared";

function discColor(disc: "B" | "W"): string {
  return disc === "B" ? "var(--color-primary)" : "var(--color-secondary)";
}

function ReversiBoard({
  view,
  me,
  isMyTurn,
  sendMove,
}: BoardProps<ReversiView, ReversiMove>) {
  const myDisc = view.colors[me];
  const isOver = view.winner !== null || view.isDraw;
  const legal = new Set(view.legalMoves);

  // Track cells that changed this turn to animate flips.
  const prevCellsRef = useRef<readonly Cell[]>(view.cells);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  useEffect(() => {
    const prev = prevCellsRef.current;
    const changed = new Set<number>();
    for (let i = 0; i < view.cells.length; i++) {
      if (prev[i] !== view.cells[i]) changed.add(i);
    }
    if (changed.size > 0) {
      setFlipped(changed);
      const t = setTimeout(() => setFlipped(new Set()), 450);
      prevCellsRef.current = view.cells;
      return () => clearTimeout(t);
    }
    prevCellsRef.current = view.cells;
  }, [view.cells]);

  const handleClick = (row: number, col: number) => {
    if (!isMyTurn || isOver) return;
    const idx = row * SIZE + col;
    if (!legal.has(idx)) return;
    void sendMove({ kind: "place", row, col });
  };

  const myScore = myDisc ? view.scores[myDisc] : 0;
  const oppDisc: "B" | "W" | null = myDisc ? (myDisc === "B" ? "W" : "B") : null;
  const oppScore = oppDisc ? view.scores[oppDisc] : 0;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-6 text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-4 w-4 rounded-full"
            style={{
              background: myDisc ? discColor(myDisc) : "var(--color-base-300)",
              boxShadow:
                "inset 0 -1px 0 oklch(0% 0 0 / 0.25), inset 0 1px 0 oklch(100% 0 0 / 0.25)",
            }}
          />
          <span>
            You <span className="text-base-content/80 font-bold">{myScore}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-4 w-4 rounded-full"
            style={{
              background: oppDisc
                ? discColor(oppDisc)
                : "var(--color-base-300)",
              boxShadow:
                "inset 0 -1px 0 oklch(0% 0 0 / 0.25), inset 0 1px 0 oklch(100% 0 0 / 0.25)",
            }}
          />
          <span>
            Opp <span className="text-base-content/80 font-bold">{oppScore}</span>
          </span>
        </div>
      </div>

      <div
        className="relative rounded-2xl p-3 md:p-4"
        style={{
          background:
            "color-mix(in oklch, var(--color-success) 55%, var(--color-base-300))",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -2px 0 oklch(0% 0 0 / 0.18), 0 16px 40px color-mix(in oklch, var(--color-success) 20%, transparent)",
        }}
      >
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: SIZE * SIZE }).map((_, i) => {
            const row = Math.floor(i / SIZE);
            const col = i % SIZE;
            const cell = view.cells[i] ?? null;
            const isLegal = !isOver && isMyTurn && legal.has(i);
            const isLast =
              view.lastMove &&
              view.lastMove.row === row &&
              view.lastMove.col === col;
            const justFlipped = flipped.has(i) && cell !== null;
            const clickable = isLegal;

            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onClick={() => handleClick(row, col)}
                className={[
                  "relative h-9 w-9 md:h-11 md:w-11 rounded-md",
                  "flex items-center justify-center",
                  clickable ? "cursor-pointer" : "cursor-default",
                  "transition-transform duration-150",
                  clickable ? "hover:scale-[1.04]" : "",
                ].join(" ")}
                style={{
                  background:
                    "color-mix(in oklch, oklch(0% 0 0) 12%, transparent)",
                  boxShadow:
                    "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.22)",
                }}
                aria-label={`cell ${row},${col}`}
              >
                {cell !== null && (
                  <span
                    className={[
                      "block h-[82%] w-[82%] rounded-full",
                      justFlipped ? "parlor-drop" : "parlor-fade",
                      isLast ? "ring-2 ring-base-100/80" : "",
                    ].join(" ")}
                    style={{
                      background: discColor(cell),
                      boxShadow:
                        "inset 0 -2px 0 oklch(0% 0 0 / 0.25), inset 0 2px 0 oklch(100% 0 0 / 0.22), 0 2px 4px oklch(0% 0 0 / 0.25)",
                    }}
                  />
                )}
                {cell === null && isLegal && (
                  <span
                    className="block h-[28%] w-[28%] rounded-full parlor-fade"
                    style={{
                      background: myDisc
                        ? `color-mix(in oklch, ${discColor(myDisc)} 55%, transparent)`
                        : "oklch(100% 0 0 / 0.4)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-base-content/55 tracking-wide min-h-[1.2em]">
        {isOver
          ? view.isDraw
            ? "Draw — even count."
            : view.winner === me
              ? "You win."
              : "Opponent wins."
          : isMyTurn
            ? view.legalMoves.length > 0
              ? "Your move — dots mark legal squares."
              : "No legal moves — passing…"
            : "Waiting for opponent…"}
      </div>
    </div>
  );
}

export const reversiClientModule: ClientGameModule<
  ReversiView,
  ReversiMove,
  Record<string, never>
> = {
  type: REVERSI_TYPE,
  Board: ReversiBoard,
};
