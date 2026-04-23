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

const PIECE_GLYPH: Record<Piece, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

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
                    className="absolute inset-1 rounded-md ring-1 ring-base-100/50"
                    style={{
                      background:
                        "color-mix(in oklch, var(--color-warning) 18%, transparent)",
                    }}
                  />
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

function PieceGlyph({ piece }: { piece: Piece }) {
  const color = pieceColor(piece);
  const glyph = PIECE_GLYPH[piece];
  const isWhite = color === "w";

  // Two-layer render: a black stroke silhouette behind a white/black fill,
  // so pieces read clearly on both light and dark squares.
  const fillColor = isWhite
    ? "var(--color-base-100)"
    : "color-mix(in oklch, var(--color-neutral) 95%, black)";
  const strokeColor = isWhite
    ? "color-mix(in oklch, var(--color-neutral) 75%, black)"
    : "color-mix(in oklch, var(--color-base-100) 55%, transparent)";

  return (
    <span
      className="relative flex items-center justify-center parlor-rise select-none"
      style={{
        width: "90%",
        height: "90%",
        fontSize: "clamp(1.6rem, 3.8vw, 2.4rem)",
        lineHeight: 1,
        filter: "drop-shadow(0 1px 1px oklch(0% 0 0 / 0.35))",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center"
        style={{
          color: strokeColor,
          transform: "translate(0.6px, 0.6px)",
        }}
      >
        {glyph}
      </span>
      <span
        className="relative"
        style={{
          color: fillColor,
          WebkitTextStroke: `0.7px ${strokeColor}`,
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
