import { useMemo } from "react";
import {
  BoardLayout,
  SeatChip,
  SeatStrip,
  type BoardProps,
  type ClientGameModule,
} from "@bgo/sdk-client";
import type { TicTacToeMove, TicTacToeView } from "./shared";
import { TIC_TAC_TOE_TYPE } from "./shared";

function TicTacToeBoard({
  view,
  me,
  isMyTurn,
  players,
  sendMove,
}: BoardProps<TicTacToeView, TicTacToeMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const mySymbol = view.symbols[me];
  const isOver = view.winner !== null || view.isDraw;

  const opponentId =
    Object.keys(view.symbols).find((id) => id !== me) ?? null;
  const opponentSymbol = opponentId ? view.symbols[opponentId] : null;
  const opponentName = opponentId
    ? playersById[opponentId]?.name ?? opponentId
    : "Opponent";
  const myName = playersById[me]?.name ?? "You";

  const handleClick = (i: number) => {
    if (!isMyTurn || isOver || view.cells[i] !== null) return;
    void sendMove({ kind: "place", cellIndex: i });
  };

  const status = (() => {
    if (view.winner === me) return { label: "You win", tone: "success" };
    if (view.winner && view.winner !== me)
      return { label: `${opponentName} wins`, tone: "error" };
    if (view.isDraw) return { label: "Draw", tone: "neutral" };
    if (isMyTurn) return { label: "Your move", tone: "primary" };
    return { label: `${opponentName}'s move`, tone: "muted" };
  })();

  const symbolColor = (s: "X" | "O" | undefined) =>
    s === "X"
      ? "var(--color-primary)"
      : s === "O"
        ? "var(--color-secondary)"
        : "var(--color-base-content)";

  const seatChipFor = (
    name: string,
    symbol: "X" | "O" | undefined,
    isYou: boolean,
    isTheirTurn: boolean,
    align: "start" | "end",
  ) => (
    <SeatChip
      swatch={
        <span
          className="font-display leading-none"
          style={{ fontSize: "1.75rem", color: symbolColor(symbol) }}
        >
          {symbol ?? "?"}
        </span>
      }
      label={isTheirTurn ? "to move" : "waiting"}
      name={name}
      isYou={isYou}
      active={isTheirTurn}
      accent={symbolColor(symbol)}
      align={align}
    />
  );

  const board = (
    <div
      className="relative rounded-2xl p-3 md:p-4 mx-auto"
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
  );

  return (
    <BoardLayout
      statusBar={
        <SeatStrip
          left={seatChipFor(
            opponentName,
            opponentSymbol ?? undefined,
            false,
            !isOver && !isMyTurn,
            "start",
          )}
          center={
            <span
              style={{
                color:
                  status.tone === "primary"
                    ? "var(--color-primary)"
                    : status.tone === "success"
                      ? "var(--color-success)"
                      : status.tone === "error"
                        ? "var(--color-error)"
                        : "var(--color-base-content)",
              }}
            >
              {status.label}
            </span>
          }
          right={seatChipFor(myName, mySymbol, true, isMyTurn && !isOver, "end")}
        />
      }
      board={board}
      // 3x3 doesn't need much room even with full play area — cap so it
      // doesn't inflate to absurdity, but lets it grow on mobile.
      boardMaxSize="min(60vh, 480px)"
    />
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
