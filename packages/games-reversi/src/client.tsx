import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoardLayout,
  type BoardProps,
  type ClientGameModule,
} from "@bgo/sdk-client";
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
  players,
  sendMove,
}: BoardProps<ReversiView, ReversiMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const myDisc = view.colors[me];
  const isOver = view.winner !== null || view.isDraw;
  const legal = new Set(view.legalMoves);

  const opponentId =
    Object.keys(view.colors).find((id) => id !== me) ?? null;
  const opponentDisc = opponentId ? view.colors[opponentId] : null;
  const opponentName = opponentId
    ? playersById[opponentId]?.name ?? opponentId
    : "Opponent";
  const myName = playersById[me]?.name ?? "You";

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
  const oppScore = opponentDisc ? view.scores[opponentDisc] : 0;

  const seatChip = (
    name: string,
    disc: "B" | "W" | null | undefined,
    score: number,
    isYou: boolean,
    isTheirTurn: boolean,
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
          ? "inset 0 0 0 2px var(--color-primary), 0 6px 16px color-mix(in oklch, var(--color-primary) 18%, transparent)"
          : "inset 0 1px 0 oklch(100% 0 0 / 0.1), inset 0 -1px 0 oklch(0% 0 0 / 0.05)",
      }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: 22,
          height: 22,
          background: disc ? discColor(disc) : "var(--color-base-300)",
          boxShadow:
            "inset 0 -2px 0 oklch(0% 0 0 / 0.25), inset 0 1px 0 oklch(100% 0 0 / 0.22)",
        }}
      />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 leading-tight">
          {disc === "B" ? "Black" : disc === "W" ? "White" : "—"}
          {isTheirTurn ? " · to move" : ""}
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
          <span className="ml-2 font-mono tabular-nums text-sm font-semibold text-base-content/80">
            {score}
          </span>
        </span>
      </div>
    </div>
  );

  const status = (() => {
    if (isOver) {
      if (view.isDraw) return { label: "Draw — even count", tone: "neutral" };
      if (view.winner === me) return { label: "You win", tone: "success" };
      return { label: `${opponentName} wins`, tone: "error" };
    }
    if (isMyTurn) {
      return view.legalMoves.length > 0
        ? { label: "Your move — dots mark legal squares", tone: "primary" }
        : { label: "No legal moves — passing…", tone: "muted" };
    }
    return { label: `${opponentName} thinking…`, tone: "muted" };
  })();

  const board = (
    <div
      className="relative rounded-2xl p-3 md:p-4 w-full"
      style={{
        background:
          "color-mix(in oklch, var(--color-success) 55%, var(--color-base-300))",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -2px 0 oklch(0% 0 0 / 0.18), 0 16px 40px color-mix(in oklch, var(--color-success) 20%, transparent)",
      }}
    >
      <div
        className="grid gap-1 w-full"
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
                "relative aspect-square rounded-md",
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
  );

  return (
    <BoardLayout
      statusBar={
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-stretch sm:items-center gap-2 sm:gap-3 w-full">
          {seatChip(
            opponentName,
            opponentDisc,
            oppScore,
            false,
            !isOver && !isMyTurn,
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
            myDisc,
            myScore,
            true,
            isMyTurn && !isOver,
            "end",
          )}
        </div>
      }
      board={board}
      boardMaxSize="min(75vh, 100%)"
    />
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
