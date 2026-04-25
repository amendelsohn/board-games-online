import type * as React from "react";
import {
  BoardLayout,
  SeatChip,
  SeatStrip,
  type BoardProps,
  type ClientGameModule,
} from "@bgo/sdk-client";
import {
  COLS,
  DOTS_AND_BOXES_TYPE,
  ROWS,
  type DotsAndBoxesMove,
  type DotsAndBoxesView,
  type PlayerSymbol,
} from "./shared";

const colorVarFor = (s: PlayerSymbol | undefined): string =>
  s === "A"
    ? "var(--color-primary)"
    : s === "B"
      ? "var(--color-secondary)"
      : "var(--color-base-content)";

function DotsAndBoxesBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<DotsAndBoxesView, DotsAndBoxesMove>) {
  const mySymbol = view.colors[me];
  const isOver = view.winner !== null || view.isDraw;

  // Cell sizing for the interleaved grid. Dots/edges get a short track, boxes a long one.
  const dotTrack = "14px";
  const boxTrack = "44px";

  // The interleaved grid has (2*ROWS + 1) rows and (2*COLS + 1) columns.
  // Even-indexed rows are dot/h-edge rows; odd-indexed rows are v-edge/box rows.
  const gridCols = Array.from({ length: 2 * COLS + 1 }, (_, i) =>
    i % 2 === 0 ? dotTrack : boxTrack,
  ).join(" ");
  const gridRows = Array.from({ length: 2 * ROWS + 1 }, (_, i) =>
    i % 2 === 0 ? dotTrack : boxTrack,
  ).join(" ");

  const drawEdge = (orient: "h" | "v", row: number, col: number) => {
    if (!isMyTurn || isOver) return;
    const drawn =
      orient === "h"
        ? view.hEdges[row * COLS + col]
        : view.vEdges[row * (COLS + 1) + col];
    if (drawn) return;
    void sendMove({ kind: "draw", orient, row, col });
  };

  const isLastEdge = (orient: "h" | "v", row: number, col: number) =>
    view.lastEdge !== null &&
    view.lastEdge.orient === orient &&
    view.lastEdge.row === row &&
    view.lastEdge.col === col;

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Player";

  const playerIds = Object.keys(view.colors);
  const [p1, p2] = playerIds;

  const cells: Array<React.ReactNode> = [];
  for (let r = 0; r < 2 * ROWS + 1; r++) {
    for (let c = 0; c < 2 * COLS + 1; c++) {
      const key = `${r}-${c}`;
      if (r % 2 === 0 && c % 2 === 0) {
        // Dot
        cells.push(
          <div
            key={key}
            className="flex items-center justify-center"
            aria-hidden
          >
            <span
              className="block rounded-full"
              style={{
                width: 8,
                height: 8,
                background: "var(--color-base-content)",
                opacity: 0.55,
              }}
            />
          </div>,
        );
      } else if (r % 2 === 0 && c % 2 === 1) {
        // Horizontal edge between two dots. row index in hEdges = r/2, col = (c-1)/2.
        const row = r / 2;
        const col = (c - 1) / 2;
        const drawn = view.hEdges[row * COLS + col] ?? false;
        const last = isLastEdge("h", row, col);
        const clickable = !drawn && !isOver && isMyTurn;
        const lineColor = drawn
          ? last
            ? "var(--color-warning)"
            : "color-mix(in oklch, var(--color-base-content) 55%, transparent)"
          : "transparent";
        cells.push(
          <button
            key={key}
            type="button"
            disabled={!clickable}
            onClick={() => drawEdge("h", row, col)}
            className={[
              "group relative flex items-center justify-center",
              clickable ? "cursor-pointer" : "cursor-default",
            ].join(" ")}
            aria-label={`horizontal edge row ${row} col ${col}`}
            style={{ width: "100%", height: "100%" }}
          >
            {/* Hover hint — only when empty and it's your turn */}
            {clickable && (
              <span
                className="absolute left-1 right-1 rounded-full transition-opacity opacity-0 group-hover:opacity-60"
                style={{
                  height: 4,
                  background: colorVarFor(mySymbol),
                }}
              />
            )}
            <span
              className={[
                "absolute left-1 right-1 rounded-full transition-all",
                drawn ? "parlor-fade" : "",
                last ? "parlor-win" : "",
              ].join(" ")}
              style={{
                height: drawn ? 4 : 0,
                background: lineColor,
                boxShadow: last
                  ? "0 0 8px color-mix(in oklch, var(--color-warning) 55%, transparent)"
                  : undefined,
              }}
            />
          </button>,
        );
      } else if (r % 2 === 1 && c % 2 === 0) {
        // Vertical edge. row = (r-1)/2, col = c/2.
        const row = (r - 1) / 2;
        const col = c / 2;
        const drawn = view.vEdges[row * (COLS + 1) + col] ?? false;
        const last = isLastEdge("v", row, col);
        const clickable = !drawn && !isOver && isMyTurn;
        const lineColor = drawn
          ? last
            ? "var(--color-warning)"
            : "color-mix(in oklch, var(--color-base-content) 55%, transparent)"
          : "transparent";
        cells.push(
          <button
            key={key}
            type="button"
            disabled={!clickable}
            onClick={() => drawEdge("v", row, col)}
            className={[
              "group relative flex items-center justify-center",
              clickable ? "cursor-pointer" : "cursor-default",
            ].join(" ")}
            aria-label={`vertical edge row ${row} col ${col}`}
            style={{ width: "100%", height: "100%" }}
          >
            {clickable && (
              <span
                className="absolute top-1 bottom-1 rounded-full transition-opacity opacity-0 group-hover:opacity-60"
                style={{
                  width: 4,
                  background: colorVarFor(mySymbol),
                }}
              />
            )}
            <span
              className={[
                "absolute top-1 bottom-1 rounded-full transition-all",
                drawn ? "parlor-fade" : "",
                last ? "parlor-win" : "",
              ].join(" ")}
              style={{
                width: drawn ? 4 : 0,
                background: lineColor,
                boxShadow: last
                  ? "0 0 8px color-mix(in oklch, var(--color-warning) 55%, transparent)"
                  : undefined,
              }}
            />
          </button>,
        );
      } else {
        // Box cell. row = (r-1)/2, col = (c-1)/2.
        const row = (r - 1) / 2;
        const col = (c - 1) / 2;
        const owner = view.boxes[row * COLS + col] ?? null;
        const ownerSymbol = owner ? view.colors[owner] : undefined;
        const filled = owner !== null;
        cells.push(
          <div
            key={key}
            className={[
              "flex items-center justify-center rounded-[4px]",
              filled ? "parlor-fade font-display font-bold" : "",
            ].join(" ")}
            style={{
              width: "100%",
              height: "100%",
              background: filled
                ? `color-mix(in oklch, ${colorVarFor(ownerSymbol)} 24%, transparent)`
                : "transparent",
              color: filled ? colorVarFor(ownerSymbol) : undefined,
              fontSize: "18px",
              lineHeight: 1,
            }}
            aria-label={
              filled
                ? `box row ${row} col ${col} owned by ${ownerSymbol}`
                : `box row ${row} col ${col} empty`
            }
          >
            {ownerSymbol ?? ""}
          </div>,
        );
      }
    }
  }

  const opponentId = playerIds.find((id) => id !== me) ?? null;
  const myColor = view.colors[me];
  const opponentColor = opponentId ? view.colors[opponentId] : undefined;
  const myScore = view.scores[me] ?? 0;
  const oppScore = opponentId ? view.scores[opponentId] ?? 0 : 0;

  const seatSwatch = (sym: PlayerSymbol | undefined) => (
    <span
      className="rounded-md flex items-center justify-center font-display font-bold"
      style={{
        width: 24,
        height: 24,
        fontSize: "14px",
        background: `color-mix(in oklch, ${colorVarFor(sym)} 22%, transparent)`,
        color: colorVarFor(sym),
      }}
    >
      {sym ?? "—"}
    </span>
  );

  const board = (
    <div
      className="relative rounded-2xl p-4 md:p-5"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 85%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
      }}
    >
      <div
        className="grid mx-auto"
        style={{
          gridTemplateColumns: gridCols,
          gridTemplateRows: gridRows,
        }}
      >
        {cells}
      </div>
    </div>
  );

  return (
    <BoardLayout
      statusBar={
        <SeatStrip
          left={
            <SeatChip
              swatch={seatSwatch(opponentColor)}
              label={
                <>
                  {opponentColor ?? "—"}
                  {!isOver && view.current === opponentId
                    ? " · to draw"
                    : ""}
                </>
              }
              name={opponentId ? nameOf(opponentId) : "Opponent"}
              meta={
                <span className="font-mono tabular-nums text-sm font-semibold text-base-content/80">
                  {oppScore}
                </span>
              }
              active={!isOver && view.current === opponentId}
              accent={colorVarFor(opponentColor)}
              align="start"
            />
          }
          center={
            <span
              style={{
                color: isOver
                  ? "var(--color-success)"
                  : isMyTurn
                    ? "var(--color-primary)"
                    : "var(--color-base-content)",
              }}
            >
              {isOver
                ? view.isDraw
                  ? "Draw"
                  : view.winner === me
                    ? "You win"
                    : `${nameOf(view.winner!)} wins`
                : isMyTurn
                  ? "Draw an edge — close a box to go again"
                  : `${nameOf(view.current)} drawing…`}
            </span>
          }
          right={
            <SeatChip
              swatch={seatSwatch(myColor)}
              label={
                <>
                  {myColor ?? "—"}
                  {!isOver && isMyTurn ? " · to draw" : ""}
                </>
              }
              name={nameOf(me)}
              isYou
              meta={
                <span className="font-mono tabular-nums text-sm font-semibold text-base-content/80">
                  {myScore}
                </span>
              }
              active={!isOver && isMyTurn}
              accent={colorVarFor(myColor)}
              align="end"
            />
          }
        />
      }
      board={board}
      boardMaxSize="min(70vh, 100%)"
    />
  );
}

export const dotsAndBoxesClientModule: ClientGameModule<
  DotsAndBoxesView,
  DotsAndBoxesMove,
  Record<string, never>
> = {
  type: DOTS_AND_BOXES_TYPE,
  Board: DotsAndBoxesBoard,
};
