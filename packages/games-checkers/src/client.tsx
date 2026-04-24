import { useMemo, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BOARD_SIZE,
  CHECKERS_TYPE,
  anyColorHasJump,
  idx,
  isKing,
  isPlayable,
  jumpsFrom,
  pieceColor,
  simpleMovesFrom,
  type CheckersMove,
  type CheckersView,
  type Piece,
  type Square,
  type StepOption,
} from "./shared";

interface Highlight {
  destIndex: number;
  isCapture: boolean;
}

const CHECKERS_KEYFRAMES = `
@keyframes checkers-capture-pulse-ring {
  0%, 100% {
    opacity: 0.85;
    transform: scale(1);
    box-shadow:
      0 0 0 2px color-mix(in oklch, var(--color-warning) 70%, transparent),
      0 0 10px color-mix(in oklch, var(--color-warning) 50%, transparent);
  }
  50% {
    opacity: 0.45;
    transform: scale(1.08);
    box-shadow:
      0 0 0 2px color-mix(in oklch, var(--color-warning) 35%, transparent),
      0 0 14px color-mix(in oklch, var(--color-warning) 20%, transparent);
  }
}
.checkers-capture-pulse-ring {
  position: absolute;
  inset: -3px;
  border-radius: 9999px;
  pointer-events: none;
  animation: checkers-capture-pulse-ring 1600ms ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .checkers-capture-pulse-ring { animation: none; opacity: 0.7; }
}
`;

function CheckersBoard({
  view,
  me,
  isMyTurn,
  sendMove,
}: BoardProps<CheckersView, CheckersMove>) {
  const myColor = view.colors[me];
  const isOver = view.winner !== null;
  const [selected, setSelected] = useState<Square | null>(null);

  // If the server says "keep jumping with this piece", lock selection to it.
  const forcedSelection = view.mustContinueFrom;
  const effectiveSelected: Square | null = forcedSelection ?? selected;

  const mustCapture = useMemo(() => {
    if (!myColor || !isMyTurn || isOver) return false;
    if (forcedSelection) return true;
    return anyColorHasJump(view.cells, myColor);
  }, [view.cells, myColor, isMyTurn, isOver, forcedSelection]);

  const legalFromSelected: StepOption[] = useMemo(() => {
    if (!effectiveSelected || !myColor || !isMyTurn || isOver) return [];
    const piece = view.cells[idx(effectiveSelected.row, effectiveSelected.col)];
    if (!piece || pieceColor(piece) !== myColor) return [];
    const jumps = jumpsFrom(view.cells, effectiveSelected);
    if (mustCapture) return jumps;
    return [...jumps, ...simpleMovesFrom(view.cells, effectiveSelected)];
  }, [effectiveSelected, view.cells, myColor, isMyTurn, isOver, mustCapture]);

  const highlights: Highlight[] = useMemo(
    () =>
      legalFromSelected.map((s) => ({
        destIndex: idx(s.to.row, s.to.col),
        isCapture: s.captured !== null,
      })),
    [legalFromSelected],
  );

  // When the player must capture but hasn't picked the capturing piece yet,
  // highlight each of their own pieces that has a legal jump. Once they've
  // selected one, that highlight goes away (their destination ring takes over).
  const captureCandidateIndices = useMemo(() => {
    if (!mustCapture || !myColor || !isMyTurn || isOver) return new Set<number>();
    if (effectiveSelected) return new Set<number>();
    const set = new Set<number>();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (!isPlayable(row, col)) continue;
        const i = idx(row, col);
        const cell = view.cells[i];
        if (!cell || pieceColor(cell) !== myColor) continue;
        if (jumpsFrom(view.cells, { row, col }).length > 0) {
          set.add(i);
        }
      }
    }
    return set;
  }, [mustCapture, myColor, isMyTurn, isOver, effectiveSelected, view.cells]);

  const selectedIndex = effectiveSelected
    ? idx(effectiveSelected.row, effectiveSelected.col)
    : -1;

  const handleSquareClick = (row: number, col: number) => {
    if (isOver || !isMyTurn || !myColor) return;
    if (!isPlayable(row, col)) return;
    const cell = view.cells[idx(row, col)];
    const clicked: Square = { row, col };

    // If a destination among current legal moves is clicked, send the move.
    if (effectiveSelected) {
      const move = legalFromSelected.find(
        (s) => s.to.row === row && s.to.col === col,
      );
      if (move) {
        void sendMove({
          kind: "step",
          from: { row: move.from.row, col: move.from.col },
          to: { row: move.to.row, col: move.to.col },
        });
        // Clear local selection — server will lock to the landing square via mustContinueFrom.
        setSelected(null);
        return;
      }
    }

    if (forcedSelection) return; // can't change selection mid-multi-jump

    // (Re-)select one of our own pieces.
    if (cell && pieceColor(cell) === myColor) {
      setSelected(clicked);
      return;
    }

    setSelected(null);
  };

  const statusLine = (() => {
    if (isOver) {
      if (view.winner === me) return "You win.";
      return "You lose.";
    }
    if (!myColor) return "Spectating.";
    if (forcedSelection) return "Continue the jump.";
    if (isMyTurn) {
      return mustCapture ? "You must capture." : "Your move.";
    }
    return "Opponent is thinking.";
  })();

  return (
    <div className="flex flex-col items-center gap-5">
      <style>{CHECKERS_KEYFRAMES}</style>
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        You are{" "}
        <span
          className={
            myColor === "r"
              ? "text-error font-bold"
              : "font-bold"
          }
          style={
            myColor === "b"
              ? { color: "var(--color-neutral)" }
              : undefined
          }
        >
          {myColor === "r" ? "Red" : myColor === "b" ? "Black" : "Spectator"}
        </span>
      </div>

      <div
        className="relative rounded-2xl p-3 md:p-4"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 85%, transparent)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.12), 0 14px 36px color-mix(in oklch, var(--color-neutral) 18%, transparent)",
        }}
      >
        <div
          className="grid gap-0 rounded-lg overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
            boxShadow: "inset 0 0 0 2px oklch(0% 0 0 / 0.25)",
          }}
        >
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
            const row = Math.floor(i / BOARD_SIZE);
            const col = i % BOARD_SIZE;
            const playable = isPlayable(row, col);
            const cell = view.cells[i] ?? null;
            const isSelected = i === selectedIndex;
            const highlight = highlights.find((h) => h.destIndex === i);
            const isLastFrom =
              view.lastMove &&
              view.lastMove.from.row === row &&
              view.lastMove.from.col === col;
            const isLastTo =
              view.lastMove &&
              view.lastMove.to.row === row &&
              view.lastMove.to.col === col;

            const interactive =
              !isOver &&
              isMyTurn &&
              playable &&
              (cell || highlight || isSelected);

            const squareBg = playable
              ? "color-mix(in oklch, var(--color-neutral) 55%, var(--color-base-300))"
              : "color-mix(in oklch, var(--color-base-100) 85%, var(--color-base-200))";

            return (
              <button
                key={i}
                type="button"
                disabled={!interactive}
                onClick={() => handleSquareClick(row, col)}
                className={[
                  "relative aspect-square",
                  "h-10 w-10 md:h-14 md:w-14",
                  "flex items-center justify-center",
                  "transition-colors",
                  interactive ? "cursor-pointer" : "cursor-default",
                ].join(" ")}
                style={{
                  background: squareBg,
                }}
                aria-label={`square ${row},${col}`}
              >
                {(isLastFrom || isLastTo) && !isSelected && !highlight && (
                  <span
                    aria-hidden
                    className="absolute inset-1 rounded-md"
                    style={{
                      boxShadow:
                        "inset 0 0 0 2px color-mix(in oklch, var(--color-primary) 40%, transparent)",
                      background:
                        "color-mix(in oklch, var(--color-primary) 8%, transparent)",
                    }}
                  />
                )}

                {highlight && (
                  <span
                    aria-hidden
                    className="absolute inset-1 rounded-md parlor-fade"
                    style={{
                      background: highlight.isCapture
                        ? "color-mix(in oklch, var(--color-warning) 35%, transparent)"
                        : "color-mix(in oklch, var(--color-success) 28%, transparent)",
                      boxShadow: highlight.isCapture
                        ? "inset 0 0 0 2px var(--color-warning)"
                        : "inset 0 0 0 2px var(--color-success)",
                    }}
                  />
                )}

                {isSelected && (
                  <span
                    aria-hidden
                    className="absolute inset-1 rounded-md"
                    style={{
                      boxShadow: "inset 0 0 0 2px var(--color-primary)",
                      background:
                        "color-mix(in oklch, var(--color-primary) 15%, transparent)",
                    }}
                  />
                )}

                {cell && (
                  <PieceGlyph
                    piece={cell}
                    mustPlay={captureCandidateIndices.has(i)}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-base-content/55 tracking-wide">
        {statusLine}
      </div>
    </div>
  );
}

function PieceGlyph({
  piece,
  mustPlay,
}: {
  piece: Piece;
  mustPlay?: boolean;
}) {
  const color = pieceColor(piece);
  const isRed = color === "r";
  const isCrown = isKing(piece);

  const bg = isRed
    ? "var(--color-error)"
    : "var(--color-neutral)";

  // Tighten contrast: red pieces keep a warm dark ring, black pieces get a
  // near-ink ring so they separate cleanly from the graphite dark square in
  // both light and dark mode. Also darken the gradient tail for blacks.
  const ring = isRed
    ? "color-mix(in oklch, var(--color-error) 55%, black)"
    : "oklch(20% 0 0 / 0.85)";

  const gradientTail = isRed
    ? `color-mix(in oklch, ${bg} 70%, black)`
    : `color-mix(in oklch, ${bg} 40%, black)`;

  return (
    <span
      className="relative flex items-center justify-center parlor-rise"
      style={{
        width: "78%",
        height: "78%",
        borderRadius: "9999px",
        background: `radial-gradient(circle at 35% 30%, color-mix(in oklch, ${bg} 85%, white) 0%, ${bg} 55%, ${gradientTail} 100%)`,
        boxShadow: `inset 0 -2px 0 oklch(0% 0 0 / 0.28), inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 2px 4px oklch(0% 0 0 / 0.25), 0 0 0 2px ${ring}`,
      }}
    >
      {mustPlay && <span aria-hidden className="checkers-capture-pulse-ring" />}
      {isCrown && (
        <span
          aria-hidden
          className="font-display font-bold leading-none"
          style={{
            fontSize: "82%",
            // Cream on red reads like a coin stamp; warm amber on the near-
            // black disc glows like filament. Both are legible.
            color: isRed
              ? "color-mix(in oklch, var(--color-warning) 50%, white)"
              : "var(--color-warning)",
            textShadow:
              "0 1px 2px oklch(0% 0 0 / 0.55), 0 0 6px color-mix(in oklch, var(--color-warning) 40%, transparent)",
          }}
        >
          ★
        </span>
      )}
    </span>
  );
}

export const checkersClientModule: ClientGameModule<
  CheckersView,
  CheckersMove,
  Record<string, never>
> = {
  type: CHECKERS_TYPE,
  Board: CheckersBoard,
};
