import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import type { TicTacToeMove, TicTacToeView } from "./shared";
import { TIC_TAC_TOE_TYPE } from "./shared";

function TicTacToeBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<TicTacToeView, TicTacToeMove>) {
  const mySymbol = view.symbols[me];
  const isOver = view.winner !== null || view.isDraw;

  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);
  const nameOf = (id: string | null | undefined) =>
    (id && playersById[id]?.name) ?? "Player";
  const iAmCurrent = view.current === me;

  // Last-move highlight: track the most-recent cell that transitioned
  // null → X/O and amber-ring it until the next move lands.
  const prevCellsRef = useRef<typeof view.cells>(view.cells);
  const [lastMoveIdx, setLastMoveIdx] = useState<number | null>(null);
  useEffect(() => {
    const prev = prevCellsRef.current;
    for (let i = 0; i < view.cells.length; i++) {
      if ((prev[i] ?? null) === null && (view.cells[i] ?? null) !== null) {
        setLastMoveIdx(i);
        break;
      }
    }
    prevCellsRef.current = view.cells.slice();
  }, [view.cells]);

  const handleClick = (i: number) => {
    if (!isMyTurn || isOver || view.cells[i] !== null) return;
    void sendMove({ kind: "place", cellIndex: i });
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-0.5"
      >
        <div className="text-xs uppercase tracking-[0.22em] font-semibold">
          {isOver ? (
            view.isDraw ? (
              <span className="text-base-content">A draw.</span>
            ) : view.winner === me ? (
              <span className="text-success">You win.</span>
            ) : (
              <span className="text-base-content/75">
                {nameOf(view.winner)} wins.
              </span>
            )
          ) : iAmCurrent ? (
            <span className="text-primary">Your turn</span>
          ) : (
            <span>
              Waiting on{" "}
              <span className="font-bold text-base-content">
                {nameOf(view.current)}
              </span>
            </span>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/45">
          You play as{" "}
          <span
            className={
              mySymbol === "X"
                ? "text-primary font-bold"
                : "text-secondary font-bold"
            }
            style={{ letterSpacing: 0 }}
          >
            {mySymbol ?? "?"}
          </span>
        </div>
      </div>

      <div
        className="relative rounded-2xl p-3 md:p-4"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 85%, transparent)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          {view.cells.map((cell, i) => {
            const isWinning = view.winningLine?.includes(i) ?? false;
            const disabled = !isMyTurn || isOver || cell !== null;
            const isLast = lastMoveIdx === i && !isWinning;
            return (
              <button
                key={i}
                type="button"
                data-testid={`ttt-cell-${i}`}
                disabled={disabled}
                onClick={() => handleClick(i)}
                className={[
                  "relative h-24 w-24 md:h-28 md:w-28 rounded-xl",
                  "bg-base-100",
                  "transition-all duration-200",
                  !disabled && !isOver
                    ? "hover:scale-[1.03] hover:bg-base-200 cursor-pointer"
                    : "cursor-default",
                  isWinning ? "bg-success/15 ring-2 ring-success parlor-win" : "",
                ].join(" ")}
                style={{
                  boxShadow: isWinning
                    ? "0 0 0 2px var(--color-success), 0 10px 24px color-mix(in oklch, var(--color-success) 25%, transparent)"
                    : isLast
                      ? "inset 0 0 0 2px color-mix(in oklch, var(--color-primary) 45%, transparent), inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.05)"
                      : "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.05)",
                }}
                aria-label={`cell ${i}${cell ? ` (${cell})` : ""}${isWinning ? " winning" : ""}`}
              >
                {cell && (
                  <span
                    className={[
                      "absolute inset-0 flex items-center justify-center",
                      "font-display leading-none parlor-drop",
                      "text-6xl md:text-7xl",
                      "transition-transform duration-300",
                      cell === "X" ? "text-primary" : "text-secondary",
                      isWinning ? "scale-110" : "",
                    ].join(" ")}
                    style={{ fontWeight: 700 }}
                  >
                    {cell}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isOver && (
        <div
          className="rounded-2xl p-5 max-w-md w-full flex flex-col gap-1 parlor-fade"
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
              ? "A draw."
              : view.winner === me
                ? "You win."
                : `${nameOf(view.winner)} wins.`}
          </div>
        </div>
      )}
    </div>
  );
}

export const ticTacToeClientModule: ClientGameModule<
  TicTacToeView,
  TicTacToeMove,
  Record<string, never>
> = {
  type: TIC_TAC_TOE_TYPE,
  Board: TicTacToeBoard,
};
