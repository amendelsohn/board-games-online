import { useMemo, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BOARD_SIZE,
  CHESS_TYPE,
  idx,
  legalMovesFrom,
  pieceColor,
  pieceKind,
  type ChessCandidate,
  type ChessMove,
  type ChessView,
  type Color,
  type Piece,
  type PromotionKind,
  type Square,
} from "./shared";

interface PendingPromotion {
  from: Square;
  to: Square;
}

// Both sides render with the FILLED codepoints (U+265A-265F). We discriminate
// by CSS fill + stroke, not by Unicode, so white pieces don't collapse into
// their outlined cousins against cream squares. Filled silhouettes are also
// what chess.com / lichess ship.
const PIECE_GLYPH: Record<Piece, string> = {
  K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

// Standard starting piece counts, for deriving captured material from the
// current board. Mapped by piece-kind (lowercase), one entry per color.
const STARTING_COUNTS: Record<string, number> = {
  p: 8, n: 2, b: 2, r: 2, q: 1, k: 1,
};
// Roughly-standard point values (kings excluded).
const PIECE_VALUE: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};
// Render order inside the captured strip: pawns → knights → bishops → rooks → queens.
const CAPTURED_ORDER: ReadonlyArray<string> = ["p", "n", "b", "r", "q"];

function ChessBoard({
  view,
  me,
  isMyTurn,
  sendMove,
}: BoardProps<ChessView, ChessMove>) {
  const myColor = view.colors[me] as Color | undefined;
  const isOver = view.winner !== null || view.draw !== null;
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromo, setPendingPromo] = useState<PendingPromotion | null>(null);

  const legalFromSelected: ChessCandidate[] = useMemo(() => {
    if (!selected || !myColor || !isMyTurn || isOver) return [];
    const piece = view.cells[idx(selected.row, selected.col)];
    if (!piece || pieceColor(piece) !== myColor) return [];
    return legalMovesFrom(
      {
        cells: view.cells,
        castling: view.castling,
        enPassant: view.enPassant,
      },
      selected,
    );
  }, [selected, view.cells, view.castling, view.enPassant, myColor, isMyTurn, isOver]);

  // Collapse promotion candidates onto their destination so a single square
  // highlight represents "you can move here (and then pick a promotion piece)".
  const destinations = useMemo(() => {
    const map = new Map<number, { isCapture: boolean; isPromotion: boolean }>();
    for (const c of legalFromSelected) {
      const k = idx(c.to.row, c.to.col);
      const existing = map.get(k);
      const isCap = c.isCapture;
      const isProm = c.promotion !== undefined;
      if (!existing) map.set(k, { isCapture: isCap, isPromotion: isProm });
      else map.set(k, {
        isCapture: existing.isCapture || isCap,
        isPromotion: existing.isPromotion || isProm,
      });
    }
    return map;
  }, [legalFromSelected]);

  const selectedIndex = selected ? idx(selected.row, selected.col) : -1;

  const handleSquareClick = (row: number, col: number) => {
    if (isOver || !isMyTurn || !myColor) return;
    if (pendingPromo) return; // must resolve the picker first
    const clicked: Square = { row, col };
    const cell = view.cells[idx(row, col)];

    if (selected) {
      const promoCands = legalFromSelected.filter(
        (c) =>
          c.to.row === row &&
          c.to.col === col &&
          c.promotion !== undefined,
      );
      if (promoCands.length > 0) {
        setPendingPromo({ from: selected, to: clicked });
        return;
      }
      const normal = legalFromSelected.find(
        (c) => c.to.row === row && c.to.col === col,
      );
      if (normal) {
        void sendMove({ kind: "move", from: selected, to: clicked });
        setSelected(null);
        return;
      }
    }

    if (cell && pieceColor(cell) === myColor) {
      setSelected(clicked);
      return;
    }
    setSelected(null);
  };

  const submitPromotion = (choice: PromotionKind) => {
    if (!pendingPromo) return;
    const { from, to } = pendingPromo;
    setPendingPromo(null);
    setSelected(null);
    void sendMove({ kind: "move", from, to, promotion: choice });
  };

  const statusLine = (() => {
    if (view.winner) {
      return view.winner === me ? "Checkmate — you win." : "Checkmate — you lose.";
    }
    if (view.draw) {
      const label: Record<NonNullable<ChessView["draw"]>, string> = {
        stalemate: "Stalemate — draw.",
        fiftyMove: "Draw by 50-move rule.",
        threefold: "Draw by threefold repetition.",
        insufficientMaterial: "Draw — insufficient material.",
      };
      return label[view.draw];
    }
    if (!myColor) return "Spectating.";
    if (isMyTurn) {
      if (view.inCheck) return "Check — defend your king.";
      return "Your move.";
    }
    return view.inCheck ? "Opponent is in check." : "Opponent is thinking.";
  })();

  // Flip the board when playing Black so my pieces sit on the near rank.
  const flipped = myColor === "b";
  const displayRow = (row: number) => (flipped ? BOARD_SIZE - 1 - row : row);
  const displayCol = (col: number) => (flipped ? BOARD_SIZE - 1 - col : col);

  // Derive captured material from the current board. "captured[color]" is the
  // set of pieces of `color` that have been captured (i.e. are missing from
  // the board relative to the starting count). We render each side's captured
  // pieces ABOVE that side's back rank — so the white player sees all the
  // black pieces they've captured just below the enemy half (or above, if
  // flipped).
  const captured = useMemo(() => {
    const tally = { w: {} as Record<string, number>, b: {} as Record<string, number> };
    for (const c of view.cells) {
      if (!c) continue;
      const col = pieceColor(c);
      const kind = pieceKind(c);
      tally[col][kind] = (tally[col][kind] ?? 0) + 1;
    }
    const missing = (col: "w" | "b") => {
      const out: Record<string, number> = {};
      for (const kind of Object.keys(STARTING_COUNTS)) {
        const seen = tally[col][kind] ?? 0;
        const delta = STARTING_COUNTS[kind]! - seen;
        if (delta > 0) out[kind] = delta;
      }
      return out;
    };
    return { w: missing("w"), b: missing("b") };
  }, [view.cells]);

  // Signed material diff (positive → white is ahead).
  const materialDiff = useMemo(() => {
    const valueOf = (tally: Record<string, number>) =>
      Object.entries(tally).reduce(
        (s, [k, n]) => s + (PIECE_VALUE[k] ?? 0) * n,
        0,
      );
    // White's advantage = value of black pieces captured - value of white pieces captured.
    return valueOf(captured.b) - valueOf(captured.w);
  }, [captured]);

  // "Top" and "bottom" refer to the on-screen orientation (after flipping).
  // Top strip shows the pieces captured from the player sitting at the top;
  // bottom mirrors. The player (`myColor`) is always at the bottom.
  const topSide: "w" | "b" = flipped ? "w" : "b";
  const bottomSide: "w" | "b" = flipped ? "b" : "w";

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        You are{" "}
        <span
          className="font-bold"
          style={{
            color:
              myColor === "w"
                ? "var(--color-base-content)"
                : myColor === "b"
                  ? "var(--color-neutral)"
                  : undefined,
          }}
        >
          {myColor === "w" ? "White" : myColor === "b" ? "Black" : "Spectator"}
        </span>
      </div>

      <div
        className="relative rounded-2xl p-3 md:p-4 flex flex-col gap-2"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 85%, transparent)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.12), 0 14px 36px color-mix(in oklch, var(--color-neutral) 18%, transparent)",
        }}
      >
        <CapturedStrip
          side={topSide}
          tally={captured[topSide]}
          // Material diff shown on the side whose opponent is ahead — i.e.
          // if materialDiff > 0 white is up, which means the BLACK strip shows
          // "+N" from white's perspective, and vice versa.
          materialDelta={
            topSide === "b"
              ? materialDiff > 0
                ? materialDiff
                : 0
              : materialDiff < 0
                ? -materialDiff
                : 0
          }
        />

        <div
          className="grid gap-0 rounded-lg overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
            boxShadow: "inset 0 0 0 2px oklch(0% 0 0 / 0.25)",
          }}
        >
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => {
            const dispRow = Math.floor(i / BOARD_SIZE);
            const dispCol = i % BOARD_SIZE;
            const row = displayRow(dispRow);
            const col = displayCol(dispCol);
            const realIdx = idx(row, col);
            const cell = view.cells[realIdx] ?? null;
            const isLightSquare = (row + col) % 2 === 0;
            const isSelected = realIdx === selectedIndex;
            const dest = destinations.get(realIdx);
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
              !pendingPromo &&
              isMyTurn &&
              !!myColor &&
              (cell || dest || isSelected);

            const squareBg = isLightSquare
              ? "color-mix(in oklch, var(--color-base-100) 78%, var(--color-warning) 8%)"
              : "color-mix(in oklch, var(--color-neutral) 45%, var(--color-base-300))";

            const isKingInCheck =
              view.inCheck &&
              cell &&
              pieceKind(cell) === "k" &&
              pieceColor(cell) === view.colors[view.current];

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
                style={{ background: squareBg }}
                aria-label={`square ${"abcdefgh"[col]}${8 - row}`}
              >
                {(isLastFrom || isLastTo) && !isSelected && !dest && (
                  <span
                    aria-hidden
                    className="absolute inset-1 rounded-md"
                    style={{
                      background:
                        "color-mix(in oklch, var(--color-warning) 35%, transparent)",
                      boxShadow:
                        "inset 0 0 0 2px color-mix(in oklch, var(--color-warning) 55%, transparent)",
                    }}
                  />
                )}

                {/* Rank/file labels: file in the bottom row, rank in the
                    leftmost column. Tinted to the opposite square color so
                    they never clash. */}
                {dispRow === BOARD_SIZE - 1 && (
                  <span
                    aria-hidden
                    className="absolute bottom-0.5 right-1 font-mono text-[9px] leading-none uppercase tracking-wider"
                    style={{
                      color: isLightSquare
                        ? "color-mix(in oklch, var(--color-neutral) 60%, transparent)"
                        : "color-mix(in oklch, var(--color-base-100) 70%, transparent)",
                    }}
                  >
                    {"abcdefgh"[col]}
                  </span>
                )}
                {dispCol === 0 && (
                  <span
                    aria-hidden
                    className="absolute top-0.5 left-1 font-mono text-[9px] leading-none tabular-nums"
                    style={{
                      color: isLightSquare
                        ? "color-mix(in oklch, var(--color-neutral) 60%, transparent)"
                        : "color-mix(in oklch, var(--color-base-100) 70%, transparent)",
                    }}
                  >
                    {8 - row}
                  </span>
                )}

                {isKingInCheck && (
                  <span
                    aria-hidden
                    className="absolute inset-1 rounded-md parlor-fade"
                    style={{
                      background:
                        "color-mix(in oklch, var(--color-error) 35%, transparent)",
                      boxShadow: "inset 0 0 0 2px var(--color-error)",
                    }}
                  />
                )}

                {dest && (
                  <span
                    aria-hidden
                    className="absolute inset-1 rounded-md parlor-fade pointer-events-none"
                    style={{
                      background: dest.isCapture
                        ? "color-mix(in oklch, var(--color-warning) 30%, transparent)"
                        : "color-mix(in oklch, var(--color-success) 24%, transparent)",
                      boxShadow: dest.isCapture
                        ? "inset 0 0 0 2px var(--color-warning)"
                        : "inset 0 0 0 2px var(--color-success)",
                    }}
                  />
                )}

                {isSelected && (
                  <span
                    aria-hidden
                    className="absolute inset-1 rounded-md pointer-events-none"
                    style={{
                      boxShadow: "inset 0 0 0 2px var(--color-primary)",
                      background:
                        "color-mix(in oklch, var(--color-primary) 15%, transparent)",
                    }}
                  />
                )}

                {dest && !cell && (
                  <span
                    aria-hidden
                    className="relative rounded-full pointer-events-none"
                    style={{
                      width: "28%",
                      height: "28%",
                      background:
                        "color-mix(in oklch, var(--color-success) 55%, transparent)",
                    }}
                  />
                )}

                {cell && <PieceGlyph piece={cell} />}
              </button>
            );
          })}
        </div>

        <CapturedStrip
          side={bottomSide}
          tally={captured[bottomSide]}
          materialDelta={
            bottomSide === "b"
              ? materialDiff > 0
                ? materialDiff
                : 0
              : materialDiff < 0
                ? -materialDiff
                : 0
          }
        />
      </div>

      <div className="text-xs text-base-content/55 tracking-wide">
        {statusLine}
      </div>

      {pendingPromo && myColor && (
        <PromotionPicker
          color={myColor}
          onPick={submitPromotion}
          onCancel={() => setPendingPromo(null)}
        />
      )}
    </div>
  );
}

function CapturedStrip({
  side,
  tally,
  materialDelta,
}: {
  side: "w" | "b";
  tally: Record<string, number>;
  materialDelta: number;
}) {
  const total = Object.values(tally).reduce((s, n) => s + n, 0);
  if (total === 0 && materialDelta === 0) {
    // Reserve the vertical space so the board doesn't jump when the first
    // capture lands. A single thin line keeps the layout stable.
    return <div className="h-5" aria-hidden />;
  }

  // Build a flat, length-ordered list of captured pieces.
  const items: { key: string; piece: Piece }[] = [];
  for (const kind of CAPTURED_ORDER) {
    const n = tally[kind] ?? 0;
    for (let i = 0; i < n; i++) {
      const piece: Piece = (side === "w" ? kind.toUpperCase() : kind) as Piece;
      items.push({ key: `${kind}-${i}`, piece });
    }
  }

  return (
    <div className="h-5 flex items-center gap-2 px-1">
      <div className="flex items-center gap-[1px] min-w-0 overflow-hidden">
        {items.map(({ key, piece }) => (
          <span
            key={key}
            className="inline-flex items-center justify-center"
            style={{ width: "1.1rem", height: "1.1rem" }}
          >
            <PieceGlyph piece={piece} size="captured" />
          </span>
        ))}
      </div>
      {materialDelta > 0 && (
        <span
          className="font-mono text-[11px] tabular-nums font-semibold"
          style={{
            color: "color-mix(in oklch, var(--color-base-content) 80%, transparent)",
          }}
          aria-label={`material advantage +${materialDelta}`}
        >
          +{materialDelta}
        </span>
      )}
    </div>
  );
}

function PieceGlyph({
  piece,
  size = "board",
}: {
  piece: Piece;
  size?: "board" | "captured";
}) {
  const color = pieceColor(piece);
  const glyph = PIECE_GLYPH[piece];
  const isWhite = color === "w";

  // Both colors use the FILLED codepoint; we differentiate purely with CSS
  // `color` and `-webkit-text-stroke`. White = ivory with a dark stroke,
  // black = near-ink with a thin warm-ivory stroke (so the silhouette still
  // reads on the dark square without looking outlined).
  const fillColor = isWhite
    ? "color-mix(in oklch, var(--color-base-100) 92%, white)"
    : "oklch(18% 0.012 60)";
  const strokeColor = isWhite
    ? "oklch(15% 0.012 60)"
    : "color-mix(in oklch, var(--color-base-100) 55%, transparent)";

  const dimensions =
    size === "captured"
      ? { width: "100%", height: "100%", fontSize: "1.15rem" }
      : {
          width: "90%",
          height: "90%",
          fontSize: "clamp(1.6rem, 3.8vw, 2.4rem)",
        };

  return (
    <span
      className={`relative flex items-center justify-center select-none${
        size === "captured" ? "" : " parlor-rise"
      }`}
      style={{
        ...dimensions,
        lineHeight: 1,
        filter:
          size === "captured"
            ? undefined
            : "drop-shadow(0 1px 1px oklch(0% 0 0 / 0.35))",
      }}
    >
      <span
        className="relative"
        style={{
          color: fillColor,
          WebkitTextStroke: `${isWhite ? 1.1 : 0.7}px ${strokeColor}`,
          paintOrder: "stroke fill",
        }}
      >
        {glyph}
      </span>
    </span>
  );
}

function PromotionPicker({
  color,
  onPick,
  onCancel,
}: {
  color: Color;
  onPick: (k: PromotionKind) => void;
  onCancel: () => void;
}) {
  const options: { kind: PromotionKind; piece: Piece; label: string }[] = [
    { kind: "q", piece: color === "w" ? "Q" : "q", label: "Queen" },
    { kind: "r", piece: color === "w" ? "R" : "r", label: "Rook" },
    { kind: "b", piece: color === "w" ? "B" : "b", label: "Bishop" },
    { kind: "n", piece: color === "w" ? "N" : "n", label: "Knight" },
  ];
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{
        background: "color-mix(in oklch, oklch(0% 0 0) 35%, transparent)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col items-center gap-4 rounded-2xl p-5 parlor-rise"
        style={{
          background: "var(--color-base-100)",
          boxShadow:
            "0 24px 64px color-mix(in oklch, oklch(0% 0 0) 45%, transparent), inset 0 1px 0 oklch(100% 0 0 / 0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display text-lg">Promote pawn</div>
        <div className="grid grid-cols-4 gap-2">
          {options.map((o) => (
            <button
              key={o.kind}
              type="button"
              className="flex flex-col items-center gap-1 rounded-xl p-3 transition-colors hover:bg-base-200"
              onClick={() => onPick(o.kind)}
              aria-label={o.label}
              style={{
                boxShadow:
                  "inset 0 0 0 1px color-mix(in oklch, var(--color-base-content) 12%, transparent)",
              }}
            >
              <span
                className="text-3xl leading-none"
                style={{
                  color:
                    color === "w"
                      ? "var(--color-base-content)"
                      : "var(--color-neutral)",
                }}
              >
                {PIECE_GLYPH[o.piece]}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
                {o.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const chessClientModule: ClientGameModule<
  ChessView,
  ChessMove,
  Record<string, never>
> = {
  type: CHESS_TYPE,
  Board: ChessBoard,
};
