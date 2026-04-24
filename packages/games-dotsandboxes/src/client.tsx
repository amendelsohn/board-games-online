import type * as React from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
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

function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

const DAB_KEYFRAMES = `
@keyframes dab-edge-pop {
  0%   { opacity: 0; transform: scale(0.7); }
  55%  { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}
.dab-edge-pop { animation: dab-edge-pop 480ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .dab-edge-pop { animation: none; } }
`;

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

  // Insertion order of Object.keys is implementation-order of the colors
  // record, which can flip between renders. Sort by the assigned symbol (A
  // then B) to make the score-chip order stable across reconnects.
  const playerIds = Object.keys(view.colors).sort((a, b) => {
    const sa = view.colors[a] ?? "Z";
    const sb = view.colors[b] ?? "Z";
    return sa.localeCompare(sb);
  });
  const [p1, p2] = playerIds;

  // Ghost-edge affordance: on mobile there's no hover, so an untouched board
  // looks empty and non-interactive. We persist a low-opacity preview of
  // every draw-able edge until the first edge is drawn, then let it fade.
  const anyEdgeDrawn =
    view.hEdges.some(Boolean) || view.vEdges.some(Boolean);
  const showGhostEdges = isMyTurn && !isOver && !anyEdgeDrawn;

  // Dynamic status copy. "complete a box to go again" reads as a misleading
  // tutorial on turn 1 (no 3-sided box can exist yet). Derive whether the
  // reward path is actually reachable.
  const anyThreeSidedBox = (() => {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (view.boxes[row * COLS + col] != null) continue;
        const top = view.hEdges[row * COLS + col] ? 1 : 0;
        const bot = view.hEdges[(row + 1) * COLS + col] ? 1 : 0;
        const left = view.vEdges[row * (COLS + 1) + col] ? 1 : 0;
        const right = view.vEdges[row * (COLS + 1) + col + 1] ? 1 : 0;
        if (top + bot + left + right === 3) return true;
      }
    }
    return false;
  })();

  const boxesRemaining = view.boxes.filter((b) => b === null).length;

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
            {/* Persistent ghost on an untouched board so mobile players see
                the edges exist; fades after any edge is drawn. Hover bumps
                to the full 60% preview. */}
            {clickable && (
              <span
                className={[
                  "absolute left-1 right-1 rounded-full transition-opacity",
                  showGhostEdges
                    ? "opacity-[0.14] group-hover:opacity-60"
                    : "opacity-0 group-hover:opacity-60",
                ].join(" ")}
                style={{
                  height: 4,
                  background: colorVarFor(mySymbol),
                  transitionDuration: showGhostEdges ? "220ms" : "2000ms",
                }}
              />
            )}
            <span
              className={[
                "absolute left-1 right-1 rounded-full transition-all",
                drawn ? "parlor-fade" : "",
                last ? "dab-edge-pop" : "",
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
                className={[
                  "absolute top-1 bottom-1 rounded-full transition-opacity",
                  showGhostEdges
                    ? "opacity-[0.14] group-hover:opacity-60"
                    : "opacity-0 group-hover:opacity-60",
                ].join(" ")}
                style={{
                  width: 4,
                  background: colorVarFor(mySymbol),
                  transitionDuration: showGhostEdges ? "220ms" : "2000ms",
                }}
              />
            )}
            <span
              className={[
                "absolute top-1 bottom-1 rounded-full transition-all",
                drawn ? "parlor-fade" : "",
                last ? "dab-edge-pop" : "",
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
        const ownerName = owner
          ? owner === me
            ? "You"
            : nameOf(owner)
          : "";
        const ownerInitials = owner
          ? owner === me
            ? "ME"
            : initialsFor(ownerName)
          : "";
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
              // Bumped flood opacity from 24% → 32% so the color signal is
              // legible on its own (color alone fails WCAG; initials below
              // back it up textually).
              background: filled
                ? `color-mix(in oklch, ${colorVarFor(ownerSymbol)} 32%, transparent)`
                : "transparent",
              color: filled ? colorVarFor(ownerSymbol) : undefined,
              fontSize: "13px",
              letterSpacing: "0.06em",
              lineHeight: 1,
            }}
            aria-label={
              filled
                ? `box row ${row} col ${col} owned by ${ownerName}`
                : `box row ${row} col ${col} empty`
            }
          >
            {ownerInitials}
          </div>,
        );
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <style>{DAB_KEYFRAMES}</style>
      <div className="flex items-center gap-6">
        {[p1, p2].map((pid) =>
          pid ? (
            <div
              key={pid}
              className={[
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl",
                view.current === pid && !isOver
                  ? "ring-2 ring-offset-2 ring-offset-base-100"
                  : "opacity-75",
              ].join(" ")}
              style={{
                background: `color-mix(in oklch, ${colorVarFor(view.colors[pid])} 14%, transparent)`,
                boxShadow:
                  view.current === pid && !isOver
                    ? `0 0 0 2px ${colorVarFor(view.colors[pid])}`
                    : undefined,
              }}
            >
              <span
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: colorVarFor(view.colors[pid]) }}
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: colorVarFor(view.colors[pid]) }}
                />
                {pid === me ? "You" : nameOf(pid)}
              </span>
              <span
                className="text-2xl font-display font-bold leading-none tabular-nums"
                style={{ color: colorVarFor(view.colors[pid]) }}
              >
                {view.scores[pid] ?? 0}
              </span>
            </div>
          ) : null,
        )}
      </div>

      {!isOver && (
        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 tabular-nums">
          {boxesRemaining === 1
            ? "Final box"
            : `${boxesRemaining} boxes remaining`}
        </div>
      )}

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
          className="grid"
          style={{
            gridTemplateColumns: gridCols,
            gridTemplateRows: gridRows,
          }}
        >
          {cells}
        </div>
      </div>

      <div className="text-xs text-base-content/55 tracking-wide text-center">
        {isOver
          ? "Game over."
          : isMyTurn
            ? anyThreeSidedBox
              ? "Your turn — close a box to draw again."
              : "Your turn — draw a line between two dots."
            : `Waiting on ${nameOf(view.current)}.`}
      </div>
    </div>
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
