import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

/** Piece glyph — lowercase = man, uppercase = king. */
export type Piece = "r" | "R" | "b" | "B";

/** Board color — red moves first by American-rules convention. */
export type Color = "r" | "b";

/** Board cell — `null` for either an empty dark square or a light square. */
export type Cell = Piece | null;

export const BOARD_SIZE = 8;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export interface Square {
  row: number;
  col: number;
}

export interface CheckersState {
  /** Row-major 64-cell board. Light squares are always `null`. Row 0 is Black's back row. */
  cells: readonly Cell[];
  colors: Record<PlayerId, Color>;
  current: PlayerId;
  /** When set, the current player just completed a jump and must continue jumping with this piece. */
  mustContinueFrom: Square | null;
  winner: PlayerId | null;
  /** Square the player last moved from / to, for subtle highlight on the client. */
  lastMove: { from: Square; to: Square } | null;
}

export interface CheckersView {
  cells: Cell[];
  colors: Record<PlayerId, Color>;
  current: PlayerId;
  mustContinueFrom: Square | null;
  winner: PlayerId | null;
  lastMove: { from: Square; to: Square } | null;
}

const squareSchema = z.object({
  row: z.number().int().min(0).max(BOARD_SIZE - 1),
  col: z.number().int().min(0).max(BOARD_SIZE - 1),
});

/**
 * Single move kind. The server decides whether it's a one-step slide or a
 * single-hop capture. Multi-jumps are performed as a sequence of moves,
 * each gated by `mustContinueFrom` in state.
 */
export const moveSchema = z.object({
  kind: z.literal("step"),
  from: squareSchema,
  to: squareSchema,
});
export type CheckersMove = z.infer<typeof moveSchema>;

export type CheckersConfig = Record<string, never>;

export const CHECKERS_TYPE = "checkers";

export function idx(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

/** Dark (playable) squares are those where (row + col) is odd. */
export function isPlayable(row: number, col: number): boolean {
  return (row + col) % 2 === 1;
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function pieceColor(piece: Piece): Color {
  return piece === "r" || piece === "R" ? "r" : "b";
}

export function isKing(piece: Piece): boolean {
  return piece === "R" || piece === "B";
}

/**
 * Movement directions for a piece, from the piece's perspective.
 * Red travels "up" the board (toward row 0), Black travels "down" (toward row 7).
 * Kings travel in all four diagonal directions.
 */
export function directionsFor(piece: Piece): readonly [number, number][] {
  if (isKing(piece)) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  if (pieceColor(piece) === "r") {
    return [
      [-1, -1],
      [-1, 1],
    ];
  }
  return [
    [1, -1],
    [1, 1],
  ];
}

/** The opponent's back rank for a given color — crowning row. */
export function crownRow(color: Color): number {
  return color === "r" ? 0 : BOARD_SIZE - 1;
}

export interface StepOption {
  from: Square;
  to: Square;
  captured: Square | null;
}

export function pieceAt(cells: readonly Cell[], sq: Square): Cell {
  if (!inBounds(sq.row, sq.col)) return null;
  return cells[idx(sq.row, sq.col)] ?? null;
}

export function jumpsFrom(cells: readonly Cell[], from: Square): StepOption[] {
  const piece = pieceAt(cells, from);
  if (!piece) return [];
  const myColor = pieceColor(piece);
  const out: StepOption[] = [];
  for (const [dr, dc] of directionsFor(piece)) {
    const midRow = from.row + dr;
    const midCol = from.col + dc;
    const toRow = from.row + 2 * dr;
    const toCol = from.col + 2 * dc;
    if (!inBounds(toRow, toCol)) continue;
    const mid = pieceAt(cells, { row: midRow, col: midCol });
    if (!mid) continue;
    if (pieceColor(mid) === myColor) continue;
    if (cells[idx(toRow, toCol)]) continue;
    out.push({
      from,
      to: { row: toRow, col: toCol },
      captured: { row: midRow, col: midCol },
    });
  }
  return out;
}

export function simpleMovesFrom(cells: readonly Cell[], from: Square): StepOption[] {
  const piece = pieceAt(cells, from);
  if (!piece) return [];
  const out: StepOption[] = [];
  for (const [dr, dc] of directionsFor(piece)) {
    const toRow = from.row + dr;
    const toCol = from.col + dc;
    if (!inBounds(toRow, toCol)) continue;
    if (cells[idx(toRow, toCol)]) continue;
    out.push({ from, to: { row: toRow, col: toCol }, captured: null });
  }
  return out;
}

export function anyColorHasJump(cells: readonly Cell[], color: Color): boolean {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const p = cells[idx(row, col)];
      if (!p || pieceColor(p) !== color) continue;
      if (jumpsFrom(cells, { row, col }).length > 0) return true;
    }
  }
  return false;
}
