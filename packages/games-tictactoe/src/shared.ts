import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export type Symbol = "X" | "O";
export type Cell = Symbol | null;

export interface TicTacToeState {
  cells: readonly Cell[]; // length 9, row-major
  symbols: Record<PlayerId, Symbol>;
  current: PlayerId;
  winner: PlayerId | null;
  isDraw: boolean;
}

export interface TicTacToeView {
  cells: Cell[];
  symbols: Record<PlayerId, Symbol>;
  current: PlayerId;
  winner: PlayerId | null;
  isDraw: boolean;
  winningLine: number[] | null;
}

/** Intent-based moves — never ship the whole board from the client. */
export const moveSchema = z.object({
  kind: z.literal("place"),
  cellIndex: z.number().int().min(0).max(8),
});
export type TicTacToeMove = z.infer<typeof moveSchema>;

/** No lobby-time config for tic-tac-toe. */
export type TicTacToeConfig = Record<string, never>;

export const TIC_TAC_TOE_TYPE = "tic-tac-toe";
