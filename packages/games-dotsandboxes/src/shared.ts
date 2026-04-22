import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

/** 5×5 grid of boxes → 6×6 dots. */
export const ROWS = 5;
export const COLS = 5;

/** Horizontal edges: between dots in the same row; one above each box row + one below the last. */
export const H_EDGE_COUNT = (ROWS + 1) * COLS; // 30
/** Vertical edges: between dots in the same column; one left of each box col + one right of the last. */
export const V_EDGE_COUNT = ROWS * (COLS + 1); // 30
export const BOX_COUNT = ROWS * COLS; // 25

export type PlayerSymbol = "A" | "B";
export type BoxOwner = PlayerId | null;

export interface LastEdge {
  orient: "h" | "v";
  row: number;
  col: number;
}

export interface DotsAndBoxesState {
  hEdges: readonly boolean[]; // length H_EDGE_COUNT, row-major: idx = row*COLS + col
  vEdges: readonly boolean[]; // length V_EDGE_COUNT, row-major: idx = row*(COLS+1) + col
  boxes: readonly BoxOwner[]; // length BOX_COUNT, row-major
  colors: Record<PlayerId, PlayerSymbol>;
  current: PlayerId;
  scores: Record<PlayerId, number>;
  lastEdge: LastEdge | null;
  winner: PlayerId | null;
  isDraw: boolean;
}

export interface DotsAndBoxesView {
  hEdges: boolean[];
  vEdges: boolean[];
  boxes: BoxOwner[];
  colors: Record<PlayerId, PlayerSymbol>;
  current: PlayerId;
  scores: Record<PlayerId, number>;
  lastEdge: LastEdge | null;
  winner: PlayerId | null;
  isDraw: boolean;
}

/** Intent-based moves — identify the edge by orientation + grid coordinates. */
export const moveSchema = z.object({
  kind: z.literal("draw"),
  orient: z.union([z.literal("h"), z.literal("v")]),
  row: z.number().int().min(0).max(ROWS),
  col: z.number().int().min(0).max(COLS),
});
export type DotsAndBoxesMove = z.infer<typeof moveSchema>;

/** No lobby-time config. */
export type DotsAndBoxesConfig = Record<string, never>;

export const DOTS_AND_BOXES_TYPE = "dots-and-boxes";

/** Map an edge (orient, row, col) to its index in the relevant edges array, or -1 if out of bounds. */
export function edgeIndex(orient: "h" | "v", row: number, col: number): number {
  if (orient === "h") {
    if (row < 0 || row > ROWS || col < 0 || col >= COLS) return -1;
    return row * COLS + col;
  }
  if (row < 0 || row >= ROWS || col < 0 || col > COLS) return -1;
  return row * (COLS + 1) + col;
}
