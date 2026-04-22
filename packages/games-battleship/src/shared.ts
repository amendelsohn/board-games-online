import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const BATTLESHIP_TYPE = "battleship";

export const BOARD_SIZE = 10;

export type ShipType =
  | "carrier"
  | "battleship"
  | "cruiser"
  | "submarine"
  | "destroyer";

export const SHIP_LENGTHS: Record<ShipType, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

export const SHIP_TYPES: readonly ShipType[] = [
  "carrier",
  "battleship",
  "cruiser",
  "submarine",
  "destroyer",
];

export type Orient = "h" | "v";

export type BattleshipPhase = "placing" | "firing" | "gameOver";

export type ShotMark = "miss" | "hit" | null;

/** Private per-player ship state: where it lives, how many hits, sunk flag. */
export interface ShipRecord {
  ship: ShipType;
  row: number;
  col: number;
  orient: Orient;
  length: number;
  hits: number;
  sunk: boolean;
}

/** Per-player grid: 10×10 flat array (row-major) of ShipType or null. */
export type Board = readonly (ShipType | null)[];

/** Per-player shots: 10×10 flat array of outcome of each shot this player has FIRED (onto the opponent). */
export type Shots = readonly ShotMark[];

export interface LastShot {
  by: PlayerId;
  row: number;
  col: number;
  result: "miss" | "hit";
  sunk: ShipType | null;
}

export interface BattleshipState {
  players: [PlayerId, PlayerId];
  boards: Record<PlayerId, Board>;
  ships: Record<PlayerId, ShipRecord[]>;
  /** Shots this player has FIRED on the opponent. */
  shots: Record<PlayerId, Shots>;
  placed: Record<PlayerId, boolean>;
  phase: BattleshipPhase;
  current: PlayerId;
  winner: PlayerId | null;
  lastShot: LastShot | null;
}

// ------------------------- Views -------------------------

/**
 * Per-player view. Hidden-info rules:
 *  - you see your own board (ships + where shots have landed on you)
 *  - you see an opponent grid as just shot outcomes (your `shots`)
 *  - spectators see neither fleet before gameOver; both are revealed at gameOver
 */
export interface PlayerSideView {
  /** Ship placement — revealed for your own side, or for everyone at gameOver; null otherwise. */
  board: Board | null;
  /** Shots fired onto this side. */
  incoming: Shots;
  /** Ship status — full detail when visible to viewer, otherwise just sunk summary. */
  ships: ShipRecord[] | null;
  /** Number of ships sunk on this side — always public. */
  sunkCount: number;
}

export interface BattleshipView {
  phase: BattleshipPhase;
  players: [PlayerId, PlayerId];
  placed: Record<PlayerId, boolean>;
  current: PlayerId;
  winner: PlayerId | null;
  lastShot: LastShot | null;
  /** One entry per player id. */
  sides: Record<PlayerId, PlayerSideView>;
  /** True iff the viewer is a seated player and hasn't locked in placement yet. */
  viewerMustPlace: boolean;
  /** True iff the viewer is a seated player. */
  viewerIsPlayer: boolean;
}

// ------------------------- Config -------------------------

export type BattleshipConfig = Record<string, never>;

// ------------------------- Moves -------------------------

const placementSchema = z.object({
  ship: z.enum(["carrier", "battleship", "cruiser", "submarine", "destroyer"]),
  row: z.number().int().min(0).max(BOARD_SIZE - 1),
  col: z.number().int().min(0).max(BOARD_SIZE - 1),
  orient: z.enum(["h", "v"]),
});
export type Placement = z.infer<typeof placementSchema>;

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("place"),
    placements: z.array(placementSchema).length(SHIP_TYPES.length),
  }),
  z.object({
    kind: z.literal("fire"),
    row: z.number().int().min(0).max(BOARD_SIZE - 1),
    col: z.number().int().min(0).max(BOARD_SIZE - 1),
  }),
]);
export type BattleshipMove = z.infer<typeof moveSchema>;

// ------------------------- Helpers -------------------------

export function cellIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

/**
 * Compute the cells a ship would occupy. Returns null if any cell is off-grid.
 * Caller must check for overlaps separately.
 */
export function shipCells(
  row: number,
  col: number,
  length: number,
  orient: Orient,
): { row: number; col: number }[] | null {
  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i < length; i++) {
    const r = orient === "v" ? row + i : row;
    const c = orient === "h" ? col + i : col;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return null;
    cells.push({ row: r, col: c });
  }
  return cells;
}
