import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import type { TicTacToeMove, TicTacToeView } from "./shared";
import { TIC_TAC_TOE_TYPE } from "./shared";

function TicTacToeBoard({
  view,
  me,
  isMyTurn,
  sendMove,
  players,
}: BoardProps<TicTacToeView, TicTacToeMove>) {
  const mySymbol = view.symbols[me];
  const opponentId = Object.keys(view.symbols).find((id) => id !== me);
  const opponent = players.find((p) => p.id === opponentId);
  const isOver = view.winner !== null || view.isDraw;

  const status = (() => {
    if (view.winner) {
      const winnerPlayer = players.find((p) => p.id === view.winner);
      if (view.winner === me) return "You win!";
      return `${winnerPlayer?.name ?? "Opponent"} wins`;
    }
    if (view.isDraw) return "Draw — no winner";
    if (isMyTurn) return "Your turn";
    return `Waiting on ${opponent?.name ?? "opponent"}`;
  })();

  const handleClick = (i: number) => {
    if (!isMyTurn || isOver || view.cells[i] !== null) return;
    void sendMove({ kind: "place", cellIndex: i });
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-4">
        <div className="badge badge-lg badge-primary">
          You: {mySymbol ?? "?"}
        </div>
        <div className="text-base-content/80">vs</div>
        <div className="badge badge-lg badge-secondary">
          {opponent?.name ?? "Opponent"}: {opponentId ? view.symbols[opponentId] : "?"}
        </div>
      </div>

      <div className="text-xl font-semibold">{status}</div>

      <div className="grid grid-cols-3 gap-2 bg-base-300 p-2 rounded-xl shadow-lg">
        {view.cells.map((cell, i) => {
          const isWinning = view.winningLine?.includes(i) ?? false;
          const disabled =
            !isMyTurn || isOver || cell !== null;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => handleClick(i)}
              className={[
                "w-24 h-24 md:w-28 md:h-28 text-5xl md:text-6xl font-bold rounded-lg",
                "bg-base-100 hover:bg-base-200 transition-colors",
                isWinning ? "ring-4 ring-success bg-success/10" : "",
                cell === "X" ? "text-primary" : "",
                cell === "O" ? "text-secondary" : "",
                disabled && cell === null ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              ].join(" ")}
              aria-label={`cell ${i}`}
            >
              {cell ?? ""}
            </button>
          );
        })}
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
