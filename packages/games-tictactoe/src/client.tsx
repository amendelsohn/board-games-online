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
    <div className="flex flex-col items-center gap-6">
      <div className="text-sm text-base-content/70">
        You are{" "}
        <span
          className={mySymbol === "X" ? "text-primary font-bold" : "text-secondary font-bold"}
        >
          {mySymbol ?? "?"}
        </span>
      </div>

      <div className="bg-base-300 p-3 rounded-2xl shadow-xl">
        <div className="grid grid-cols-3 gap-2">
          {view.cells.map((cell, i) => {
            const isWinning = view.winningLine?.includes(i) ?? false;
            const disabled = !isMyTurn || isOver || cell !== null;
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => handleClick(i)}
                className={[
                  "relative w-24 h-24 md:w-28 md:h-28 rounded-xl",
                  "bg-base-100 transition-all duration-150",
                  !disabled && !isOver
                    ? "hover:bg-base-200 hover:scale-[1.02] cursor-pointer"
                    : "cursor-not-allowed",
                  isWinning ? "bg-success/20 ring-2 ring-success bgo-win" : "",
                ].join(" ")}
                aria-label={`cell ${i}`}
              >
                {cell && (
                  <span
                    className={[
                      "absolute inset-0 flex items-center justify-center",
                      "text-6xl md:text-7xl font-black bgo-fade",
                      cell === "X" ? "text-primary" : "text-secondary",
                    ].join(" ")}
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
