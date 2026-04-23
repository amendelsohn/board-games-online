import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

/**
 * Piece glyph — FEN-style. Uppercase = white, lowercase = black.
 *   P/p = pawn, N/n = knight, B/b = bishop,
 *   R/r = rook, Q/q = queen, K/k = king.
 */
export type Piece =
  | "P" | "N" | "B" | "R" | "Q" | "K"
  | "p" | "n" | "b" | "r" | "q" | "k";

export type Color = "w" | "b";
export type PieceKind = "p" | "n" | "b" | "r" | "q" | "k";
export type PromotionKind = "q" | "r" | "b" | "n";

export type Cell = Piece | null;

export const BOARD_SIZE = 8;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export interface Square {
  row: number;
  col: number;
}

export interface CastlingRights {
  wk: boolean;
  wq: boolean;
  bk: boolean;
  bq: boolean;
}

export type DrawReason =
  | "stalemate"
  | "fiftyMove"
  | "threefold"
  | "insufficientMaterial";

export interface ChessState {
  /** Row-major, row 0 = rank 8 (black back rank), row 7 = rank 1 (white back rank). */
  cells: readonly Cell[];
  colors: Record<PlayerId, Color>;
  current: PlayerId;
  castling: CastlingRights;
  /** Square a pawn just double-stepped *over* (the target of an en-passant capture), if any. */
  enPassant: Square | null;
  /** Half-moves since the last pawn advance or capture, for the 50-move rule. */
  halfmoveClock: number;
  fullmoveNumber: number;
  /** Repetition ledger keyed by a position signature (board + side + castling + ep). */
  positionHistory: Record<string, number>;
  winner: PlayerId | null;
  draw: DrawReason | null;
  lastMove: { from: Square; to: Square } | null;
  /** True iff the side to move is currently in check. Cached so clients don't recompute. */
  inCheck: boolean;
}

export interface ChessView {
  cells: Cell[];
  colors: Record<PlayerId, Color>;
  current: PlayerId;
  castling: CastlingRights;
  enPassant: Square | null;
  winner: PlayerId | null;
  draw: DrawReason | null;
  lastMove: { from: Square; to: Square } | null;
  inCheck: boolean;
}

const squareSchema = z.object({
  row: z.number().int().min(0).max(BOARD_SIZE - 1),
  col: z.number().int().min(0).max(BOARD_SIZE - 1),
});

export const moveSchema = z.object({
  kind: z.literal("move"),
  from: squareSchema,
  to: squareSchema,
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});
export type ChessMove = z.infer<typeof moveSchema>;

export type ChessConfig = Record<string, never>;

export const CHESS_TYPE = "chess";

/* ---------------- Low-level helpers ---------------- */

export function idx(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function pieceColor(p: Piece): Color {
  return p === p.toUpperCase() ? "w" : "b";
}

export function pieceKind(p: Piece): PieceKind {
  return p.toLowerCase() as PieceKind;
}

export function pieceAt(cells: readonly Cell[], sq: Square): Cell {
  if (!inBounds(sq.row, sq.col)) return null;
  return cells[idx(sq.row, sq.col)] ?? null;
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

export function opponent(c: Color): Color {
  return c === "w" ? "b" : "w";
}

/** The home (back) rank for a color — row 7 for white, row 0 for black. */
export function homeRow(c: Color): number {
  return c === "w" ? 7 : 0;
}

/** Forward direction (delta-row) for a pawn of this color. White moves "up" (row decreases). */
export function pawnDir(c: Color): number {
  return c === "w" ? -1 : 1;
}

export function promotionRow(c: Color): number {
  return c === "w" ? 0 : 7;
}

export function pawnStartRow(c: Color): number {
  return c === "w" ? 6 : 1;
}

/* ---------------- Initial board ---------------- */

export function buildInitialBoard(): Cell[] {
  const cells: Cell[] = new Array(CELL_COUNT).fill(null);
  const backBlack: Piece[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const backWhite: Piece[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let col = 0; col < BOARD_SIZE; col++) {
    cells[idx(0, col)] = backBlack[col]!;
    cells[idx(1, col)] = "p";
    cells[idx(6, col)] = "P";
    cells[idx(7, col)] = backWhite[col]!;
  }
  return cells;
}

/* ---------------- Attack detection ---------------- */

const KNIGHT_OFFSETS: readonly [number, number][] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const KING_OFFSETS: readonly [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

const ROOK_DIRS: readonly [number, number][] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

const BISHOP_DIRS: readonly [number, number][] = [
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

/** Is `sq` attacked by any piece of `byColor`? */
export function squareAttackedBy(
  cells: readonly Cell[],
  sq: Square,
  byColor: Color,
): boolean {
  // Pawn attacks: a pawn of `byColor` attacks diagonally in its forward direction.
  const pawnDelta = pawnDir(byColor);
  for (const dc of [-1, 1] as const) {
    const r = sq.row - pawnDelta;
    const c = sq.col - dc;
    if (!inBounds(r, c)) continue;
    const p = cells[idx(r, c)];
    if (p && pieceKind(p) === "p" && pieceColor(p) === byColor) return true;
  }

  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const r = sq.row + dr;
    const c = sq.col + dc;
    if (!inBounds(r, c)) continue;
    const p = cells[idx(r, c)];
    if (p && pieceKind(p) === "n" && pieceColor(p) === byColor) return true;
  }

  for (const [dr, dc] of KING_OFFSETS) {
    const r = sq.row + dr;
    const c = sq.col + dc;
    if (!inBounds(r, c)) continue;
    const p = cells[idx(r, c)];
    if (p && pieceKind(p) === "k" && pieceColor(p) === byColor) return true;
  }

  for (const [dr, dc] of ROOK_DIRS) {
    let r = sq.row + dr;
    let c = sq.col + dc;
    while (inBounds(r, c)) {
      const p = cells[idx(r, c)];
      if (p) {
        if (pieceColor(p) === byColor) {
          const k = pieceKind(p);
          if (k === "r" || k === "q") return true;
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }

  for (const [dr, dc] of BISHOP_DIRS) {
    let r = sq.row + dr;
    let c = sq.col + dc;
    while (inBounds(r, c)) {
      const p = cells[idx(r, c)];
      if (p) {
        if (pieceColor(p) === byColor) {
          const k = pieceKind(p);
          if (k === "b" || k === "q") return true;
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

export function findKing(cells: readonly Cell[], color: Color): Square | null {
  const target: Piece = color === "w" ? "K" : "k";
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === target) {
      return { row: Math.floor(i / BOARD_SIZE), col: i % BOARD_SIZE };
    }
  }
  return null;
}

export function isInCheck(cells: readonly Cell[], color: Color): boolean {
  const k = findKing(cells, color);
  if (!k) return false;
  return squareAttackedBy(cells, k, opponent(color));
}

/* ---------------- Move candidates ---------------- */

export interface ChessCandidate {
  from: Square;
  to: Square;
  isCapture: boolean;
  /** An en-passant capture consumes a pawn that is NOT on `to`. */
  isEnPassant: boolean;
  /** "K" = kingside castle, "Q" = queenside castle, false otherwise. */
  castle: false | "K" | "Q";
  /** If the pawn must promote on landing, the candidate is expanded per option. */
  promotion?: PromotionKind;
}

function pushSlider(
  cells: readonly Cell[],
  from: Square,
  dirs: readonly [number, number][],
  myColor: Color,
  out: ChessCandidate[],
): void {
  for (const [dr, dc] of dirs) {
    let r = from.row + dr;
    let c = from.col + dc;
    while (inBounds(r, c)) {
      const p = cells[idx(r, c)];
      if (!p) {
        out.push({
          from,
          to: { row: r, col: c },
          isCapture: false,
          isEnPassant: false,
          castle: false,
        });
      } else {
        if (pieceColor(p) !== myColor) {
          out.push({
            from,
            to: { row: r, col: c },
            isCapture: true,
            isEnPassant: false,
            castle: false,
          });
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
}

/**
 * All pseudo-legal moves from `from` given the rest of state. Pseudo-legal means
 * it respects piece movement rules and captures, but does NOT filter out moves
 * that leave one's own king in check. Call `legalMovesFrom` for that.
 */
export function pseudoLegalMovesFrom(
  state: {
    cells: readonly Cell[];
    castling: CastlingRights;
    enPassant: Square | null;
  },
  from: Square,
): ChessCandidate[] {
  const piece = pieceAt(state.cells, from);
  if (!piece) return [];
  const myColor = pieceColor(piece);
  const kind = pieceKind(piece);
  const out: ChessCandidate[] = [];

  if (kind === "p") {
    const dir = pawnDir(myColor);
    const startRow = pawnStartRow(myColor);
    const promoteRow = promotionRow(myColor);

    // One-square push
    const oneRow = from.row + dir;
    if (inBounds(oneRow, from.col) && !state.cells[idx(oneRow, from.col)]) {
      if (oneRow === promoteRow) {
        for (const p of ["q", "r", "b", "n"] as PromotionKind[]) {
          out.push({
            from,
            to: { row: oneRow, col: from.col },
            isCapture: false,
            isEnPassant: false,
            castle: false,
            promotion: p,
          });
        }
      } else {
        out.push({
          from,
          to: { row: oneRow, col: from.col },
          isCapture: false,
          isEnPassant: false,
          castle: false,
        });
        // Two-square push
        if (from.row === startRow) {
          const twoRow = from.row + 2 * dir;
          if (!state.cells[idx(twoRow, from.col)]) {
            out.push({
              from,
              to: { row: twoRow, col: from.col },
              isCapture: false,
              isEnPassant: false,
              castle: false,
            });
          }
        }
      }
    }

    // Captures (including en passant)
    for (const dc of [-1, 1] as const) {
      const r = from.row + dir;
      const c = from.col + dc;
      if (!inBounds(r, c)) continue;
      const target = state.cells[idx(r, c)];
      if (target && pieceColor(target) !== myColor) {
        if (r === promoteRow) {
          for (const p of ["q", "r", "b", "n"] as PromotionKind[]) {
            out.push({
              from,
              to: { row: r, col: c },
              isCapture: true,
              isEnPassant: false,
              castle: false,
              promotion: p,
            });
          }
        } else {
          out.push({
            from,
            to: { row: r, col: c },
            isCapture: true,
            isEnPassant: false,
            castle: false,
          });
        }
      } else if (
        !target &&
        state.enPassant &&
        state.enPassant.row === r &&
        state.enPassant.col === c
      ) {
        out.push({
          from,
          to: { row: r, col: c },
          isCapture: true,
          isEnPassant: true,
          castle: false,
        });
      }
    }
    return out;
  }

  if (kind === "n") {
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const r = from.row + dr;
      const c = from.col + dc;
      if (!inBounds(r, c)) continue;
      const p = state.cells[idx(r, c)];
      if (!p) {
        out.push({
          from, to: { row: r, col: c },
          isCapture: false, isEnPassant: false, castle: false,
        });
      } else if (pieceColor(p) !== myColor) {
        out.push({
          from, to: { row: r, col: c },
          isCapture: true, isEnPassant: false, castle: false,
        });
      }
    }
    return out;
  }

  if (kind === "b") {
    pushSlider(state.cells, from, BISHOP_DIRS, myColor, out);
    return out;
  }

  if (kind === "r") {
    pushSlider(state.cells, from, ROOK_DIRS, myColor, out);
    return out;
  }

  if (kind === "q") {
    pushSlider(state.cells, from, ROOK_DIRS, myColor, out);
    pushSlider(state.cells, from, BISHOP_DIRS, myColor, out);
    return out;
  }

  // King
  for (const [dr, dc] of KING_OFFSETS) {
    const r = from.row + dr;
    const c = from.col + dc;
    if (!inBounds(r, c)) continue;
    const p = state.cells[idx(r, c)];
    if (!p) {
      out.push({
        from, to: { row: r, col: c },
        isCapture: false, isEnPassant: false, castle: false,
      });
    } else if (pieceColor(p) !== myColor) {
      out.push({
        from, to: { row: r, col: c },
        isCapture: true, isEnPassant: false, castle: false,
      });
    }
  }

  // Castling — conditions on rights, emptiness, and "not through check" are
  // enforced here except the "not through check" part, which is handled by
  // `legalMovesFrom` (it rejects any move leaving us in check or traversing
  // an attacked square, via the explicit middle-square test below).
  const hr = homeRow(myColor);
  if (from.row === hr && from.col === 4) {
    const opp = opponent(myColor);
    const kingsideRight = myColor === "w" ? state.castling.wk : state.castling.bk;
    const queensideRight = myColor === "w" ? state.castling.wq : state.castling.bq;
    if (kingsideRight) {
      if (
        !state.cells[idx(hr, 5)] &&
        !state.cells[idx(hr, 6)] &&
        state.cells[idx(hr, 7)] === (myColor === "w" ? "R" : "r") &&
        !squareAttackedBy(state.cells, { row: hr, col: 4 }, opp) &&
        !squareAttackedBy(state.cells, { row: hr, col: 5 }, opp) &&
        !squareAttackedBy(state.cells, { row: hr, col: 6 }, opp)
      ) {
        out.push({
          from,
          to: { row: hr, col: 6 },
          isCapture: false,
          isEnPassant: false,
          castle: "K",
        });
      }
    }
    if (queensideRight) {
      if (
        !state.cells[idx(hr, 3)] &&
        !state.cells[idx(hr, 2)] &&
        !state.cells[idx(hr, 1)] &&
        state.cells[idx(hr, 0)] === (myColor === "w" ? "R" : "r") &&
        !squareAttackedBy(state.cells, { row: hr, col: 4 }, opp) &&
        !squareAttackedBy(state.cells, { row: hr, col: 3 }, opp) &&
        !squareAttackedBy(state.cells, { row: hr, col: 2 }, opp)
      ) {
        out.push({
          from,
          to: { row: hr, col: 2 },
          isCapture: false,
          isEnPassant: false,
          castle: "Q",
        });
      }
    }
  }

  return out;
}

/**
 * Apply a candidate to a board, producing the resulting cells. Does NOT update
 * castling rights or ep targets — callers that care (move validator, full
 * state transition) do that themselves.
 */
export function applyCandidateToCells(
  cells: readonly Cell[],
  cand: ChessCandidate,
): Cell[] {
  const next = cells.slice() as Cell[];
  const piece = next[idx(cand.from.row, cand.from.col)];
  if (!piece) return next;
  next[idx(cand.from.row, cand.from.col)] = null;

  if (cand.isEnPassant) {
    // The captured pawn sits on the same row as `from`, same column as `to`.
    next[idx(cand.from.row, cand.to.col)] = null;
  }

  let landed: Piece = piece;
  if (cand.promotion) {
    const c = pieceColor(piece);
    const letter = cand.promotion;
    landed = (c === "w" ? letter.toUpperCase() : letter) as Piece;
  }
  next[idx(cand.to.row, cand.to.col)] = landed;

  if (cand.castle) {
    const hr = cand.from.row;
    if (cand.castle === "K") {
      next[idx(hr, 7)] = null;
      next[idx(hr, 5)] = piece === "K" ? "R" : "r";
    } else {
      next[idx(hr, 0)] = null;
      next[idx(hr, 3)] = piece === "K" ? "R" : "r";
    }
  }

  return next;
}

export function legalMovesFrom(
  state: {
    cells: readonly Cell[];
    castling: CastlingRights;
    enPassant: Square | null;
  },
  from: Square,
): ChessCandidate[] {
  const piece = pieceAt(state.cells, from);
  if (!piece) return [];
  const myColor = pieceColor(piece);
  const pseudo = pseudoLegalMovesFrom(state, from);
  return pseudo.filter((c) => {
    const nextCells = applyCandidateToCells(state.cells, c);
    return !isInCheck(nextCells, myColor);
  });
}

export function anyLegalMove(
  state: {
    cells: readonly Cell[];
    castling: CastlingRights;
    enPassant: Square | null;
  },
  color: Color,
): boolean {
  for (let i = 0; i < state.cells.length; i++) {
    const p = state.cells[i];
    if (!p || pieceColor(p) !== color) continue;
    const from: Square = {
      row: Math.floor(i / BOARD_SIZE),
      col: i % BOARD_SIZE,
    };
    if (legalMovesFrom(state, from).length > 0) return true;
  }
  return false;
}

/* ---------------- Draw helpers ---------------- */

/**
 * Insufficient material: K vs K, K+N vs K, K+B vs K, and K+B vs K+B with
 * same-color bishops. Matches FIDE's practical rule of thumb.
 */
export function hasInsufficientMaterial(cells: readonly Cell[]): boolean {
  const minors: { color: Color; kind: "b" | "n"; squareColor: 0 | 1 }[] = [];
  let otherPieces = 0;
  for (let i = 0; i < cells.length; i++) {
    const p = cells[i];
    if (!p) continue;
    const k = pieceKind(p);
    if (k === "k") continue;
    if (k === "p" || k === "r" || k === "q") {
      otherPieces++;
      continue;
    }
    const row = Math.floor(i / BOARD_SIZE);
    const col = i % BOARD_SIZE;
    minors.push({
      color: pieceColor(p),
      kind: k,
      squareColor: ((row + col) % 2) as 0 | 1,
    });
  }
  if (otherPieces > 0) return false;
  if (minors.length === 0) return true;
  if (minors.length === 1) return true;
  if (minors.length === 2) {
    const [a, b] = minors as [typeof minors[number], typeof minors[number]];
    if (a.kind === "b" && b.kind === "b" && a.squareColor === b.squareColor) {
      return true;
    }
  }
  return false;
}

/** Stable signature of the position-defining fields used for repetition checks. */
export function positionKey(state: {
  cells: readonly Cell[];
  current: PlayerId;
  colors: Record<PlayerId, Color>;
  castling: CastlingRights;
  enPassant: Square | null;
}): string {
  const side = state.colors[state.current] ?? "w";
  const ep = state.enPassant
    ? `${state.enPassant.row},${state.enPassant.col}`
    : "-";
  const cr =
    (state.castling.wk ? "K" : "") +
    (state.castling.wq ? "Q" : "") +
    (state.castling.bk ? "k" : "") +
    (state.castling.bq ? "q" : "") || "-";
  const board = state.cells.map((c) => c ?? ".").join("");
  return `${board}|${side}|${cr}|${ep}`;
}
