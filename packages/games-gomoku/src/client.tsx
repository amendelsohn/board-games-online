import type { CSSProperties } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BOARD_SIZE,
  GOMOKU_TYPE,
  cellAt,
  type GomokuMove,
  type GomokuView,
} from "./shared";

// Traditional Go/Gomoku column labels: a-h, then j-o (skip "i" to avoid
// confusion with "1"). This yields 15 distinct letters for a 15-wide board.
const COLUMN_LABELS: readonly string[] = (() => {
  const letters: string[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    // Offset past "i" (char index 8 in the alphabet).
    const base = i < 8 ? i : i + 1;
    letters.push(String.fromCharCode("a".charCodeAt(0) + base));
  }
  return letters;
})();

// Hoshi (star points) — traditional 15x15 layout.
const STAR_POINTS = new Set<number>([
  3 * BOARD_SIZE + 3,
  3 * BOARD_SIZE + 11,
  7 * BOARD_SIZE + 7,
  11 * BOARD_SIZE + 3,
  11 * BOARD_SIZE + 11,
]);

// Stone palette is pinned so two-player contrast survives both themes.
// Theme tokens (--color-base-100, --color-neutral) collapse to similar
// dark teals in parlor-night, which destroys black-vs-white legibility.
const STONE_BLACK_BG =
  "radial-gradient(circle at 35% 30%, oklch(38% 0.014 60) 0%, oklch(20% 0.012 60) 55%, oklch(10% 0.008 60) 100%)";
const STONE_WHITE_BG =
  "radial-gradient(circle at 35% 30%, oklch(99% 0.005 80) 0%, oklch(94% 0.012 80) 55%, oklch(82% 0.018 75) 100%)";
const STONE_BLACK_SOLID = "oklch(20% 0.012 60)";
const STONE_WHITE_SOLID = "oklch(94% 0.012 80)";

function GomokuBoard({
  view,
  me,
  isMyTurn,
  players,
  sendMove,
}: BoardProps<GomokuView, GomokuMove>) {
  const myStone = view.colors[me];
  const oppStone: "B" | "W" | null =
    myStone === "B" ? "W" : myStone === "W" ? "B" : null;
  const isOver = view.winner !== null || view.isDraw;
  const winningSet = new Set(view.winningLine ?? []);
  const lastIdx =
    view.lastMove !== null
      ? view.lastMove.row * BOARD_SIZE + view.lastMove.col
      : -1;

  const nameFor = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Player";

  const handleClick = (row: number, col: number) => {
    if (!isMyTurn || isOver) return;
    if (cellAt(view.cells, row, col) !== null) return;
    void sendMove({ kind: "place", row, col });
  };

  // Draw the winning line on top of the board if the game is decided. Use
  // the grid geometry derived from --gomoku-cell so the line lands exactly
  // on the stones at any size.
  const winningLineCoords = (() => {
    const line = view.winningLine;
    if (!line || line.length < 2) return null;
    const first = line[0]!;
    const last = line[line.length - 1]!;
    return {
      x1Col: first % BOARD_SIZE,
      y1Row: Math.floor(first / BOARD_SIZE),
      x2Col: last % BOARD_SIZE,
      y2Row: Math.floor(last / BOARD_SIZE),
    };
  })();

  // Whose-move status. Show a tiny inline stone in the other side's color
  // when waiting, or "Your move" / "{name} wins" / "Draw" otherwise.
  const statusBlock = (() => {
    if (isOver) {
      if (view.isDraw) {
        return <StatusLabel tint="base-content" text="Draw." />;
      }
      if (view.winner === me) {
        return <StatusLabel tint="success" text="You connected five." />;
      }
      if (view.winner) {
        return (
          <StatusLabel tint="success" text={`${nameFor(view.winner)} connected five.`} />
        );
      }
      return <StatusLabel tint="base-content" text="Game over." />;
    }
    if (isMyTurn) {
      return <StatusLabel tint="primary" text="Your move." />;
    }
    return (
      <StatusLabel
        tint="base-content"
        text={`Waiting for ${nameFor(view.current)}`}
        trailingStone={oppStone ?? undefined}
      />
    );
  })();

  // Responsive cell size, capped at 28px on desktop. `clamp` computes the
  // largest value that keeps the full board + gutter labels inside the
  // current viewport. The 72px budget accounts for the board's 14px padding
  // on each side, the ~18px rank-label gutter, and a small breathing margin.
  const gomokuCellStyle: CSSProperties = {
    // CSSProperties typing doesn't know about arbitrary CSS variables, so we
    // cast through `as Record<string, string>` below.
  };
  (gomokuCellStyle as Record<string, string>)["--gomoku-cell"] =
    "clamp(20px, calc((100vw - 72px) / 15), 28px)";

  return (
    <div className="flex flex-col items-center gap-4" style={gomokuCellStyle}>
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold flex items-center gap-2">
        <span>
          You play{" "}
          <span className="font-bold text-base-content">
            {myStone === "B" ? "Black" : myStone === "W" ? "White" : "?"}
          </span>
        </span>
        <span className="text-base-content/35" aria-hidden>·</span>
        {statusBlock}
      </div>

      <div
        // Gutter layout: an 18px rank column on the left, the board in the
        // middle, and an 18px file row below. Matches Go/Gomoku editorial
        // convention (numbers climbing from the bottom, letters across
        // underneath).
        className="grid"
        style={{
          gridTemplateColumns: "18px auto",
          gridTemplateRows: "auto 18px",
          rowGap: "4px",
          columnGap: "4px",
        }}
      >
        {/* Rank labels: 15 on top down to 1 on bottom. */}
        <div
          className="flex flex-col-reverse justify-between items-end pr-1 py-[14px] font-mono text-[9px] tabular-nums leading-none text-base-content/45"
          style={{ gridColumn: "1", gridRow: "1" }}
        >
          {Array.from({ length: BOARD_SIZE }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-end"
              style={{
                height: "var(--gomoku-cell)",
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            gridColumn: "2",
            gridRow: "1",
            background:
              "color-mix(in oklch, var(--color-warning) 28%, var(--color-base-300) 72%)",
            padding: "14px",
            boxShadow:
              "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -2px 0 oklch(0% 0 0 / 0.14), 0 18px 42px color-mix(in oklch, var(--color-neutral) 35%, transparent)",
          }}
        >
          <div
            className="relative"
            style={{
              width: `calc(var(--gomoku-cell) * ${BOARD_SIZE})`,
              height: `calc(var(--gomoku-cell) * ${BOARD_SIZE})`,
            }}
          >
            {/* Grid lines + star points — drawn behind the cells. */}
            <svg
              viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
              preserveAspectRatio="none"
              className="absolute inset-0 pointer-events-none"
              width="100%"
              height="100%"
            >
              <g
                stroke="color-mix(in oklch, var(--color-neutral) 65%, transparent)"
                strokeWidth={1 / 28}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              >
                {Array.from({ length: BOARD_SIZE }).map((_, i) => {
                  const pos = i + 0.5;
                  const start = 0.5;
                  const end = BOARD_SIZE - 0.5;
                  return (
                    <g key={i}>
                      <line x1={start} y1={pos} x2={end} y2={pos} />
                      <line x1={pos} y1={start} x2={pos} y2={end} />
                    </g>
                  );
                })}
              </g>
              <g fill="oklch(20% 0 0 / 0.65)">
                {Array.from(STAR_POINTS).map((idx) => {
                  const r = Math.floor(idx / BOARD_SIZE);
                  const c = idx % BOARD_SIZE;
                  return (
                    <circle
                      key={idx}
                      cx={c + 0.5}
                      cy={r + 0.5}
                      r={0.11}
                    />
                  );
                })}
              </g>
            </svg>

            <div
              className="relative grid"
              style={{
                gridTemplateColumns: `repeat(${BOARD_SIZE}, var(--gomoku-cell))`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, var(--gomoku-cell))`,
              }}
            >
              {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
                const row = Math.floor(i / BOARD_SIZE);
                const col = i % BOARD_SIZE;
                const cell = view.cells[i] ?? null;
                const isWinning = winningSet.has(i);
                const isLast = i === lastIdx;
                const clickable = !isOver && isMyTurn && cell === null;

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!clickable}
                    onClick={() => handleClick(row, col)}
                    aria-label={`place stone at ${COLUMN_LABELS[col]}${row + 1}`}
                    className={[
                      "relative flex items-center justify-center",
                      "bg-transparent p-0",
                      "border border-transparent",
                      "transition-colors",
                      clickable
                        ? "cursor-pointer hover:border-primary/45 hover:border-dashed"
                        : "cursor-default",
                      "group",
                    ].join(" ")}
                    style={{
                      width: "var(--gomoku-cell)",
                      height: "var(--gomoku-cell)",
                    }}
                  >
                    {cell !== null ? (
                      <Stone
                        color={cell}
                        winning={isWinning}
                        last={isLast}
                      />
                    ) : clickable && myStone ? (
                      <span
                        className="rounded-full opacity-0 group-hover:opacity-65 group-hover:scale-[1.05] transition-all"
                        style={{
                          width: "calc(var(--gomoku-cell) * 0.78)",
                          height: "calc(var(--gomoku-cell) * 0.78)",
                          background:
                            myStone === "B"
                              ? STONE_BLACK_SOLID
                              : STONE_WHITE_SOLID,
                        }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Winning-line overlay — drawn ABOVE the stones. Placed here
                inside the board's padded area so its coordinate system
                matches the grid. Uses viewBox units = cell units. */}
            {winningLineCoords && (
              <svg
                viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
                preserveAspectRatio="none"
                className="absolute inset-0 pointer-events-none"
                width="100%"
                height="100%"
              >
                <line
                  x1={winningLineCoords.x1Col + 0.5}
                  y1={winningLineCoords.y1Row + 0.5}
                  x2={winningLineCoords.x2Col + 0.5}
                  y2={winningLineCoords.y2Row + 0.5}
                  stroke="var(--color-success)"
                  strokeWidth={0.18}
                  strokeLinecap="round"
                  strokeOpacity={0.85}
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter:
                      "drop-shadow(0 0 6px color-mix(in oklch, var(--color-success) 60%, transparent))",
                  }}
                />
              </svg>
            )}
          </div>
        </div>

        {/* File labels across the bottom. */}
        <div
          className="flex justify-between items-start px-[14px] pt-1 font-mono text-[9px] leading-none uppercase text-base-content/45"
          style={{ gridColumn: "2", gridRow: "2" }}
        >
          {COLUMN_LABELS.map((ch, i) => (
            <div
              key={i}
              className="flex items-center justify-center"
              style={{ width: "var(--gomoku-cell)" }}
            >
              {ch}
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-base-content/55 tracking-wide">
        Five or more in a row — any direction.
      </div>
    </div>
  );
}

function Stone({
  color,
  winning,
  last,
}: {
  color: "B" | "W";
  winning: boolean;
  last: boolean;
}) {
  const isBlack = color === "B";
  const bg = isBlack ? STONE_BLACK_BG : STONE_WHITE_BG;
  const innerShadow = isBlack
    ? "oklch(100% 0 0 / 0.18)"
    : "oklch(0% 0 0 / 0.18)";
  // The last-move dot: a small contrasting pip in the stone's center, the
  // Go-book convention. Warmer than the old primary ring, which on black
  // stones read as a chip.
  const lastPipColor = isBlack
    ? "color-mix(in oklch, var(--color-warning) 85%, white 15%)"
    : "color-mix(in oklch, var(--color-warning) 80%, black 20%)";
  return (
    <span
      className="relative rounded-full parlor-fade flex items-center justify-center"
      style={{
        width: "calc(var(--gomoku-cell) * 0.78)",
        height: "calc(var(--gomoku-cell) * 0.78)",
        background: bg,
        boxShadow: winning
          ? `0 0 0 2px color-mix(in oklch, var(--color-success) 75%, transparent), inset 0 -2px 0 ${innerShadow}, inset 0 1px 0 oklch(100% 0 0 / 0.3)`
          : `inset 0 -2px 0 ${innerShadow}, inset 0 1px 0 oklch(100% 0 0 / 0.3), 0 2px 4px oklch(0% 0 0 / 0.25)`,
      }}
    >
      {last && !winning && (
        <span
          aria-hidden
          className="rounded-full"
          style={{
            width: "28%",
            height: "28%",
            background: lastPipColor,
          }}
        />
      )}
    </span>
  );
}

function StatusLabel({
  text,
  tint,
  trailingStone,
}: {
  text: string;
  tint: "primary" | "success" | "base-content";
  trailingStone?: "B" | "W";
}) {
  const tintColor =
    tint === "primary"
      ? "var(--color-primary)"
      : tint === "success"
        ? "var(--color-success)"
        : "var(--color-base-content)";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        color: tintColor,
        opacity: tint === "base-content" ? 0.8 : 1,
      }}
    >
      {text}
      {trailingStone && (
        <span
          aria-hidden
          className="inline-block rounded-full"
          style={{
            width: "10px",
            height: "10px",
            background:
              trailingStone === "B"
                ? STONE_BLACK_SOLID
                : STONE_WHITE_SOLID,
            boxShadow: "inset 0 -1px 0 oklch(0% 0 0 / 0.25)",
          }}
        />
      )}
    </span>
  );
}

export const gomokuClientModule: ClientGameModule<
  GomokuView,
  GomokuMove,
  Record<string, never>
> = {
  type: GOMOKU_TYPE,
  Board: GomokuBoard,
};
