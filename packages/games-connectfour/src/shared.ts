import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export type Color = "R" | "Y";
export type Cell = Color | null;

export const ROWS = 6;
export const COLS = 7;

export interface ConnectFourState {
  /** Row-major: index = row * COLS + col. Row 0 is the top. */
  cells: readonly Cell[];
  colors: Record<PlayerId, Color>;
  current: PlayerId;
  winner: PlayerId | null;
  isDraw: boolean;
  lastMove: { row: number; col: number } | null;
}

export interface ConnectFourView {
  cells: Cell[];
  colors: Record<PlayerId, Color>;
  current: PlayerId;
  winner: PlayerId | null;
  isDraw: boolean;
  lastMove: { row: number; col: number } | null;
  winningCells: number[] | null;
}

export const moveSchema = z.object({
  kind: z.literal("drop"),
  col: z.number().int().min(0).max(COLS - 1),
});
export type ConnectFourMove = z.infer<typeof moveSchema>;

export type ConnectFourConfig = Record<string, never>;

export const CONNECT_FOUR_TYPE = "connect-four";

export function cellAt(cells: readonly Cell[], row: number, col: number): Cell {
  return cells[row * COLS + col] ?? null;
}

/** Lowest empty row in a column, or -1 if full. */
export function dropRow(cells: readonly Cell[], col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (cellAt(cells, row, col) === null) return row;
  }
  return -1;
}
