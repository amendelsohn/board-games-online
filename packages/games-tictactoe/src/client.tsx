import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import type { TicTacToeMove, TicTacToeView } from "./shared";
import { TIC_TAC_TOE_TYPE } from "./shared";

function TicTacToeBoard({
  view,
  me,
  isMyTurn,
  sendMove,
}: BoardProps<TicTacToeView, TicTacToeMove>) {
  const mySymbol = view.symbols[me];
  const isOver = view.winner !== null || view.isDraw;

  const handleClick = (i: number) => {
    if (!isMyTurn || isOver || view.cells[i] !== null) return;
    void sendMove({ kind: "place", cellIndex: i });
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        You play as{" "}
        <span
          className={
            mySymbol === "X"
              ? "text-primary font-bold"
              : "text-secondary font-bold"
          }
          style={{ letterSpacing: "0" }}
        >
          {mySymbol ?? "?"}
        </span>
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
                  isWinning
                    ? "bg-success/15 ring-2 ring-success parlor-win"
                    : "",
                ].join(" ")}
                style={{
                  boxShadow: isWinning
                    ? "0 0 0 2px var(--color-success), 0 10px 24px color-mix(in oklch, var(--color-success) 25%, transparent)"
                    : "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.05)",
                }}
                aria-label={`cell ${i}`}
              >
                {cell && (
                  <span
                    className={[
                      "absolute inset-0 flex items-center justify-center",
                      "font-display leading-none parlor-fade",
                      "text-6xl md:text-7xl",
                      cell === "X" ? "text-primary" : "text-secondary",
                    ].join(" ")}
                    style={{ fontVariationSettings: "'wght' 700" }}
                  >
                    {cell}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
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
