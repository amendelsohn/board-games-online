import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export type Side = "A" | "B";

/**
 * Board layout — 14 slots in counter-clockwise sowing order.
 *
 *   index:   0  1  2  3  4  5   6
 *            A0 A1 A2 A3 A4 A5  AStore
 *           12 11 10  9  8  7   13
 *            B5 B4 B3 B2 B1 B0  BStore
 *
 * Side A owns pits 0..5 and store 6.
 * Side B owns pits 7..12 (B0=7, B5=12) and store 13.
 * Walking +1 mod 14 is counter-clockwise: A0..A5 → AStore → B0..B5 → BStore → A0.
 */
export const PITS_PER_SIDE = 6;
export const STONES_PER_PIT = 4;

export const A_STORE = 6;
export const B_STORE = 13;

/** Index of the n-th (0..5) playing pit for a given side. */
export function pitIndex(side: Side, n: number): number {
  if (side === "A") return n;
  return 7 + n;
}

/** The store owned by a side. */
export function storeIndex(side: Side): number {
  return side === "A" ? A_STORE : B_STORE;
}

/** The store owned by the opponent of the given side. */
export function opponentStoreIndex(side: Side): number {
  return side === "A" ? B_STORE : A_STORE;
}

/**
 * The pit directly opposite `pit` across the board. Only defined for playing
 * pits (0..5 and 7..12). A_n (idx n) faces B_(5-n) (idx 12-n), so the pairing
 * is symmetric: opposite(p) = 12 - p.
 */
export function oppositePit(pit: number): number {
  if (pit >= 0 && pit <= 5) return 12 - pit;
  if (pit >= 7 && pit <= 12) return 12 - pit;
  return -1;
}

/** Which side owns a given board slot, or null for neither. */
export function sideOfSlot(slot: number): Side | null {
  if (slot >= 0 && slot <= 5) return "A";
  if (slot === A_STORE) return "A";
  if (slot === B_STORE) return "B";
  if (slot >= 7 && slot <= 12) return "B";
  return null;
}

export interface MancalaState {
  board: readonly number[]; // length 14
  players: readonly [PlayerId, PlayerId];
  sides: Record<PlayerId, Side>;
  current: PlayerId;
  winner: PlayerId | null;
  isDraw: boolean;
  lastMove: { pit: number; by: PlayerId } | null;
  lastCaptured: { pit: number; pickupPit: number } | null;
}

export interface MancalaView {
  board: number[];
  players: [PlayerId, PlayerId];
  sides: Record<PlayerId, Side>;
  current: PlayerId;
  winner: PlayerId | null;
  isDraw: boolean;
  lastMove: { pit: number; by: PlayerId } | null;
  lastCaptured: { pit: number; pickupPit: number } | null;
}

export const moveSchema = z.object({
  kind: z.literal("sow"),
  /** Relative to the actor's own side, 0..5 (leftmost to rightmost from actor's POV). */
  pitIndex: z.number().int().min(0).max(PITS_PER_SIDE - 1),
});
export type MancalaMove = z.infer<typeof moveSchema>;

export type MancalaConfig = Record<string, never>;

export const MANCALA_TYPE = "mancala";

export interface SowResult {
  next: number[];
  extraTurn: boolean;
  /**
   * When a capture triggers, `landingPit` is the actor's own (previously-empty)
   * pit where the last sown stone landed, and `oppositePit` is the opponent's
   * pit whose stones were scooped (along with the lone landing stone) into the
   * actor's store.
   */
  captured: null | { landingPit: number; oppositePit: number };
  /** Absolute index of the last slot a stone was sown into. */
  lastSlot: number;
}

/**
 * Pure single-lap sow. Validates only that the starting pit is non-empty and
 * belongs to `side`; callers should check ownership/turn state first.
 *
 * Rules implemented:
 *   - sow 1-at-a-time counter-clockwise into successive slots
 *   - skip the opponent's store
 *   - extra turn if last stone lands in your own store
 *   - capture if last stone lands in your own empty pit AND opposite has stones:
 *       the lone stone + opponent's opposite pit stones are moved to your store
 */
export function sow(
  board: readonly number[],
  side: Side,
  pit: number,
): SowResult {
  if (pit < 0 || pit >= PITS_PER_SIDE) {
    throw new Error(`invalid pit ${pit}`);
  }
  const start = pitIndex(side, pit);
  const stones = board[start] ?? 0;
  if (stones <= 0) throw new Error("pit is empty");

  const next = board.slice();
  next[start] = 0;

  const oppStore = opponentStoreIndex(side);
  let idx = start;
  let remaining = stones;
  while (remaining > 0) {
    idx = (idx + 1) % 14;
    if (idx === oppStore) continue;
    next[idx] = (next[idx] ?? 0) + 1;
    remaining--;
  }

  const own = storeIndex(side);
  const extraTurn = idx === own;

  let captured: SowResult["captured"] = null;
  if (!extraTurn) {
    const landedOnOwnSide =
      (side === "A" && idx >= 0 && idx <= 5) ||
      (side === "B" && idx >= 7 && idx <= 12);
    if (landedOnOwnSide && next[idx] === 1) {
      const opp = oppositePit(idx);
      const oppStones = next[opp] ?? 0;
      if (oppStones > 0) {
        next[own] = (next[own] ?? 0) + oppStones + 1;
        next[opp] = 0;
        next[idx] = 0;
        captured = { landingPit: idx, oppositePit: opp };
      }
    }
  }

  return { next, extraTurn, captured, lastSlot: idx };
}

/** True if a side has no stones in any of its six playing pits. */
export function sideEmpty(board: readonly number[], side: Side): boolean {
  for (let n = 0; n < PITS_PER_SIDE; n++) {
    if ((board[pitIndex(side, n)] ?? 0) > 0) return false;
  }
  return true;
}

/** Sweep a side's remaining stones into that side's store. Returns a new board. */
export function sweepSide(board: readonly number[], side: Side): number[] {
  const next = board.slice();
  const store = storeIndex(side);
  let swept = 0;
  for (let n = 0; n < PITS_PER_SIDE; n++) {
    const p = pitIndex(side, n);
    swept += next[p] ?? 0;
    next[p] = 0;
  }
  next[store] = (next[store] ?? 0) + swept;
  return next;
}

/** Produce an initial 14-slot board: 4 stones in each pit, stores empty. */
export function initialBoard(): number[] {
  const board = new Array(14).fill(0);
  for (let n = 0; n < PITS_PER_SIDE; n++) {
    board[pitIndex("A", n)] = STONES_PER_PIT;
    board[pitIndex("B", n)] = STONES_PER_PIT;
  }
  return board;
}
