import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoardLayout,
  type BoardProps,
  type ClientGameModule,
} from "@bgo/sdk-client";
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
  players,
  sendMove,
}: BoardProps<ConnectFourView, ConnectFourMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const myColor = view.colors[me];
  const isOver = view.winner !== null || view.isDraw;
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const opponentId =
    Object.keys(view.colors).find((id) => id !== me) ?? null;
  const opponentColor = opponentId ? view.colors[opponentId] : null;
  const opponentName = opponentId
    ? playersById[opponentId]?.name ?? opponentId
    : "Opponent";
  const myName = playersById[me]?.name ?? "You";

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

  const colorLabel = (c: "R" | "Y" | undefined | null): string =>
    c === "R" ? "Red" : c === "Y" ? "Gold" : "—";
  const colorVar = (c: "R" | "Y" | undefined | null): string =>
    c === "R"
      ? "var(--color-error)"
      : c === "Y"
        ? "var(--color-warning)"
        : "var(--color-base-content)";

  const lastFrom: string | null = view.lastMove
    ? Object.keys(view.colors).find(
        (id) => view.colors[id] !== view.colors[view.current],
      ) ?? null
    : null;

  const seatChip = (
    name: string,
    color: "R" | "Y" | undefined | null,
    isYou: boolean,
    isTheirTurn: boolean,
    showLastMoveCol: number | null,
    align: "start" | "end",
  ) => (
    <div
      className={[
        "rounded-2xl px-3 py-2 flex items-center gap-3 min-w-0 max-w-full",
        align === "end" ? "flex-row-reverse text-right" : "flex-row",
      ].join(" ")}
      style={{
        background:
          "color-mix(in oklch, var(--color-base-100) 85%, transparent)",
        boxShadow: isTheirTurn
          ? `inset 0 0 0 2px ${colorVar(color)}, 0 6px 16px color-mix(in oklch, ${colorVar(color)} 22%, transparent)`
          : "inset 0 1px 0 oklch(100% 0 0 / 0.1), inset 0 -1px 0 oklch(0% 0 0 / 0.05)",
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: 22,
          height: 22,
          background: colorVar(color),
          boxShadow:
            "inset 0 -2px 0 oklch(0% 0 0 / 0.18), inset 0 1px 0 oklch(100% 0 0 / 0.18)",
        }}
      />
      <div className="flex flex-col min-w-0">
        <span
          className="text-[10px] uppercase tracking-[0.22em] font-semibold leading-tight"
          style={{ color: colorVar(color) }}
        >
          {colorLabel(color)}
          {isTheirTurn ? " · to drop" : ""}
        </span>
        <span
          className="font-display tracking-tight truncate leading-tight"
          style={{ fontSize: "1rem" }}
        >
          {name}
          {isYou && (
            <span className="text-base-content/55 font-sans text-xs ml-1">
              (you)
            </span>
          )}
          {showLastMoveCol != null && (
            <span className="ml-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-base-content/55 tabular-nums">
              col {showLastMoveCol + 1}
            </span>
          )}
        </span>
      </div>
    </div>
  );

  const status = (() => {
    if (view.winner === me) return { label: "You win", tone: "success" };
    if (view.winner && view.winner !== me)
      return { label: `${opponentName} wins`, tone: "error" };
    if (view.isDraw) return { label: "Draw", tone: "neutral" };
    if (isMyTurn) return { label: "Drop a piece", tone: "primary" };
    return { label: `${opponentName} is choosing`, tone: "muted" };
  })();

  const board = (
    <div
      className="relative rounded-2xl p-3 md:p-4 w-full"
      style={{
        background: "var(--color-primary)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -2px 0 oklch(0% 0 0 / 0.12), 0 16px 40px color-mix(in oklch, var(--color-primary) 30%, transparent)",
      }}
    >
      <div
        className="grid gap-1.5 w-full"
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
              className="aspect-square rounded-full flex items-center justify-center"
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
  );

  return (
    <BoardLayout
      statusBar={
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-stretch sm:items-center gap-2 sm:gap-3 w-full">
          {seatChip(
            opponentName,
            opponentColor,
            false,
            !isOver && !isMyTurn,
            opponentId === lastFrom ? view.lastMove?.col ?? null : null,
            "start",
          )}
          <div
            className="text-[10px] sm:text-xs uppercase tracking-[0.22em] font-semibold text-center px-2"
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
          </div>
          {seatChip(
            myName,
            myColor,
            true,
            isMyTurn && !isOver,
            me === lastFrom ? view.lastMove?.col ?? null : null,
            "end",
          )}
        </div>
      }
      board={board}
      // Lets the board fill the play area, capped on widescreen so cells
      // don't end up unreasonably large.
      boardMaxSize="min(75vh, 100%)"
      toolbar={
        !isOver ? (
          <div className="text-xs text-base-content/50 tracking-wide text-center">
            Tap a column to drop a piece.
          </div>
        ) : undefined
      }
    />
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
