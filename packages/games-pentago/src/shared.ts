import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const PENTAGO_TYPE = "pentago";

export type Stone = "white" | "black";
/** 6×6 board flattened row-major; index = row*6 + col. null = empty. */
export type PentagoBoard = (Stone | null)[];

export const BOARD_SIZE = 6;
export const QUADRANT_SIZE = 3;

export type PentagoPhase = "place" | "rotate" | "gameOver";

/** Quadrants are indexed 0..3 in TL, TR, BL, BR order. */
export type Quadrant = 0 | 1 | 2 | 3;
export type Rotation = "cw" | "ccw";

export interface PentagoState {
  players: PlayerId[];
  /** Stone color assigned per seat (white moves first by convention). */
  colors: Record<PlayerId, Stone>;
  board: PentagoBoard;
  current: PlayerId;
  phase: PentagoPhase;
  /** Move count (full place+rotate counts as one). */
  turn: number;
  /** Last placement to highlight in the UI. */
  lastPlacement: { row: number; col: number; stone: Stone } | null;
  /** Last rotation (after rotate phase ends). */
  lastRotation: { quadrant: Quadrant; direction: Rotation } | null;
  /** Cells that form a winning 5-in-a-row, if game is over by win. */
  winningLine: number[] | null;
  winners: PlayerId[] | null;
  /** Set when game ends with no 5-in-a-row and the board fills (rare). */
  draw: boolean;
}

// ------------------------- Per-player view -------------------------

export interface PentagoView {
  players: PlayerId[];
  colors: Record<PlayerId, Stone>;
  board: PentagoBoard;
  current: PlayerId;
  phase: PentagoPhase;
  turn: number;
  lastPlacement: { row: number; col: number; stone: Stone } | null;
  lastRotation: { quadrant: Quadrant; direction: Rotation } | null;
  winningLine: number[] | null;
  winners: PlayerId[] | null;
  draw: boolean;
  me: PlayerId | null;
}

export type PentagoConfig = Record<string, never>;

// ------------------------- Moves -------------------------

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("place"),
    row: z.number().int().min(0).max(5),
    col: z.number().int().min(0).max(5),
  }),
  z.object({
    kind: z.literal("rotate"),
    quadrant: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
    ]),
    direction: z.enum(["cw", "ccw"]),
  }),
]);
export type PentagoMove = z.infer<typeof moveSchema>;

// ------------------------- Pure helpers -------------------------

export const idx = (row: number, col: number): number => row * BOARD_SIZE + col;
export const rowOf = (i: number): number => Math.floor(i / BOARD_SIZE);
export const colOf = (i: number): number => i % BOARD_SIZE;

/** Returns a new board with the given quadrant rotated 90° in `direction`. */
export function rotateQuadrant(
  board: PentagoBoard,
  quadrant: Quadrant,
  direction: Rotation,
): PentagoBoard {
  const out = [...board];
  // Top-left corner of this quadrant.
  const qRow = quadrant < 2 ? 0 : 3;
  const qCol = quadrant % 2 === 0 ? 0 : 3;
  // Snapshot existing cells.
  const cells: (Stone | null)[] = [];
  for (let r = 0; r < QUADRANT_SIZE; r++) {
    for (let c = 0; c < QUADRANT_SIZE; c++) {
      cells.push(board[idx(qRow + r, qCol + c)] ?? null);
    }
  }
  // Apply rotation: write back rotated values.
  for (let r = 0; r < QUADRANT_SIZE; r++) {
    for (let c = 0; c < QUADRANT_SIZE; c++) {
      let srcR: number;
      let srcC: number;
      if (direction === "cw") {
        // (r, c) <- (QS - 1 - c, r)
        srcR = QUADRANT_SIZE - 1 - c;
        srcC = r;
      } else {
        // (r, c) <- (c, QS - 1 - r)
        srcR = c;
        srcC = QUADRANT_SIZE - 1 - r;
      }
      const srcIdx = srcR * QUADRANT_SIZE + srcC;
      out[idx(qRow + r, qCol + c)] = cells[srcIdx] ?? null;
    }
  }
  return out;
}

const DIRS: Array<[number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal ↘
  [1, -1], // diagonal ↗
];

/**
 * Find any 5-in-a-row of the given stone. Returns the cell indices forming
 * that line, or null if none.
 */
export function find5InRow(
  board: PentagoBoard,
  stone: Stone,
): number[] | null {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      for (const [dr, dc] of DIRS) {
        const cells: number[] = [];
        for (let k = 0; k < 5; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= BOARD_SIZE || cc < 0 || cc >= BOARD_SIZE) {
            break;
          }
          if (board[idx(rr, cc)] !== stone) break;
          cells.push(idx(rr, cc));
        }
        if (cells.length === 5) return cells;
      }
    }
  }
  return null;
}

export function boardFull(board: PentagoBoard): boolean {
  return board.every((c) => c !== null);
}
