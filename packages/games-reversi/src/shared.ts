import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export type Disc = "B" | "W";
export type Cell = Disc | null;

export const SIZE = 8;

export interface ReversiState {
  /** Row-major: index = row * SIZE + col. */
  cells: readonly Cell[];
  colors: Record<PlayerId, Disc>;
  current: PlayerId;
  /** Consecutive passes; two in a row ends the game. */
  passCount: number;
  winner: PlayerId | null;
  isDraw: boolean;
  scores: { B: number; W: number };
  lastMove: { row: number; col: number } | null;
}

export interface ReversiView {
  cells: Cell[];
  colors: Record<PlayerId, Disc>;
  current: PlayerId;
  passCount: number;
  winner: PlayerId | null;
  isDraw: boolean;
  scores: { B: number; W: number };
  lastMove: { row: number; col: number } | null;
  /** Legal moves for the current player (row * SIZE + col). */
  legalMoves: number[];
}

export const moveSchema = z.object({
  kind: z.literal("place"),
  row: z.number().int().min(0).max(SIZE - 1),
  col: z.number().int().min(0).max(SIZE - 1),
});
export type ReversiMove = z.infer<typeof moveSchema>;

export type ReversiConfig = Record<string, never>;

export const REVERSI_TYPE = "reversi";

export function cellAt(cells: readonly Cell[], row: number, col: number): Cell {
  return cells[row * SIZE + col] ?? null;
}

export function opposite(disc: Disc): Disc {
  return disc === "B" ? "W" : "B";
}

/** Eight compass directions used for line-capture. */
export const DIRECTIONS: readonly [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];

/**
 * Indices that would flip if `disc` is placed at (row, col).
 * Returns empty array when the move is illegal.
 */
export function flipsFor(
  cells: readonly Cell[],
  row: number,
  col: number,
  disc: Disc,
): number[] {
  if (cellAt(cells, row, col) !== null) return [];
  const enemy = opposite(disc);
  const flips: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      const v = cellAt(cells, r, c);
      if (v === enemy) {
        line.push(r * SIZE + c);
        r += dr;
        c += dc;
        continue;
      }
      if (v === disc && line.length > 0) {
        flips.push(...line);
      }
      break;
    }
  }
  return flips;
}

export function legalMovesFor(cells: readonly Cell[], disc: Disc): number[] {
  const moves: number[] = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (flipsFor(cells, row, col, disc).length > 0) {
        moves.push(row * SIZE + col);
      }
    }
  }
  return moves;
}

export function countDiscs(cells: readonly Cell[]): { B: number; W: number } {
  let B = 0;
  let W = 0;
  for (const c of cells) {
    if (c === "B") B++;
    else if (c === "W") W++;
  }
  return { B, W };
}

export function initialCells(): Cell[] {
  const cells: Cell[] = new Array(SIZE * SIZE).fill(null);
  const mid = SIZE / 2;
  // Standard opening: two diagonals in the center.
  cells[(mid - 1) * SIZE + (mid - 1)] = "W";
  cells[(mid - 1) * SIZE + mid] = "B";
  cells[mid * SIZE + (mid - 1)] = "B";
  cells[mid * SIZE + mid] = "W";
  return cells;
}
