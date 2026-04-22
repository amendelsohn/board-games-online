import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  CONNECT_FOUR_TYPE,
  COLS,
  ROWS,
  dropRow,
  type ConnectFourMove,
  type ConnectFourView,
} from "./shared";

function ConnectFourBoard({
  view,
  me,
  isMyTurn,
  sendMove,
  players,
}: BoardProps<ConnectFourView, ConnectFourMove>) {
  const myColor = view.colors[me];
  const opponentId = Object.keys(view.colors).find((id) => id !== me);
  const opponent = players.find((p) => p.id === opponentId);
  const isOver = view.winner !== null || view.isDraw;

  const status = (() => {
    if (view.winner) {
      const winnerPlayer = players.find((p) => p.id === view.winner);
      if (view.winner === me) return "You win!";
      return `${winnerPlayer?.name ?? "Opponent"} wins`;
    }
    if (view.isDraw) return "Draw — the board is full";
    if (isMyTurn) return "Your turn";
    return `Waiting on ${opponent?.name ?? "opponent"}`;
  })();

  const colorClass = (c: string | null) => {
    if (c === "R") return "bg-error";
    if (c === "Y") return "bg-warning";
    return "bg-base-100";
  };

  const handleDrop = (col: number) => {
    if (!isMyTurn || isOver) return;
    const row = dropRow(view.cells, col);
    if (row < 0) return;
    void sendMove({ kind: "drop", col });
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-4">
        <div className="badge badge-lg badge-error text-white">
          {myColor === "R" ? "You" : opponent?.name ?? "Opp."}
        </div>
        <div className="text-base-content/80">vs</div>
        <div className="badge badge-lg badge-warning">
          {myColor === "Y" ? "You" : opponent?.name ?? "Opp."}
        </div>
      </div>

      <div className="text-xl font-semibold">{status}</div>

      <div className="bg-primary p-3 rounded-xl shadow-xl">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: ROWS * COLS }).map((_, i) => {
            const col = i % COLS;
            const cell = view.cells[i] ?? null;
            const isLast =
              view.lastMove &&
              view.lastMove.row * COLS + view.lastMove.col === i;
            const isWinning = view.winningCells?.includes(i) ?? false;
            const clickable = !isOver && isMyTurn;
            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onClick={() => handleDrop(col)}
                className={[
                  "w-10 h-10 md:w-14 md:h-14 rounded-full transition-all",
                  colorClass(cell),
                  cell === null ? "shadow-inner" : "shadow-md",
                  isLast ? "ring-2 ring-white" : "",
                  isWinning ? "ring-4 ring-success scale-110" : "",
                  clickable && cell === null ? "cursor-pointer hover:opacity-90" : "",
                  !clickable && cell === null ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
                aria-label={`drop in column ${col}`}
              />
            );
          })}
        </div>
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
