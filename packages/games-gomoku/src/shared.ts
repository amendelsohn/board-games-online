import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export type Stone = "B" | "W";
export type Cell = Stone | null;

export const BOARD_SIZE = 15;
export const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE;

export interface GomokuState {
  /** Row-major: index = row * BOARD_SIZE + col. */
  cells: readonly Cell[];
  colors: Record<PlayerId, Stone>;
  current: PlayerId;
  winner: PlayerId | null;
  isDraw: boolean;
  lastMove: { row: number; col: number } | null;
  winningLine: number[] | null;
}

export interface GomokuView {
  cells: Cell[];
  colors: Record<PlayerId, Stone>;
  current: PlayerId;
  winner: PlayerId | null;
  isDraw: boolean;
  lastMove: { row: number; col: number } | null;
  winningLine: number[] | null;
}

export const moveSchema = z.object({
  kind: z.literal("place"),
  row: z.number().int().min(0).max(BOARD_SIZE - 1),
  col: z.number().int().min(0).max(BOARD_SIZE - 1),
});
export type GomokuMove = z.infer<typeof moveSchema>;

export type GomokuConfig = Record<string, never>;

export const GOMOKU_TYPE = "gomoku";

export function cellAt(cells: readonly Cell[], row: number, col: number): Cell {
  return cells[row * BOARD_SIZE + col] ?? null;
}
