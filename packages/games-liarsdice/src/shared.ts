import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const LIARS_DICE_TYPE = "liars-dice";

export const DICE_PER_PLAYER = 5;
export const DIE_FACES = 6;

export type LiarsDicePhase = "bidding" | "reveal" | "gameOver";

export type Face = 1 | 2 | 3 | 4 | 5 | 6;

export interface LiarsDiceBid {
  count: number;
  face: Face;
}

export interface LiarsDiceBidOnTable extends LiarsDiceBid {
  by: PlayerId;
}

export type LiarsDiceResolution =
  | "bidderLost"
  | "challengerLost"
  | "spotOnWin"
  | "spotOnLost";

export interface LiarsDiceReveal {
  /** Every cup, revealed publicly at the moment of a challenge. */
  dice: Record<PlayerId, number[]>;
  resolution: LiarsDiceResolution;
  /** Player who lost a die (or gained, in spotOnWin). */
  loser: PlayerId;
  /** Player who won (gained a die in spotOnWin). null otherwise. */
  winner: PlayerId | null;
  /** The bid being challenged. */
  bid: LiarsDiceBidOnTable;
  /** Actual total matching the bid's face (ones wild for non-one faces). */
  actual: number;
  /** Who started the next round. */
  nextStarter: PlayerId;
}

export interface LiarsDiceState {
  /** Seated players in clockwise turn order. Never mutated. */
  players: PlayerId[];
  /** Private hand per player. Zero-length when the player is out. */
  dice: Record<PlayerId, number[]>;
  /** Public die counts — always safe to show. */
  diceCount: Record<PlayerId, number>;
  /** Current bid on the table, or null if the round hasn't opened yet. */
  currentBid: LiarsDiceBidOnTable | null;
  /** The player whose turn it is (bidding) or who must advance (reveal). */
  current: PlayerId;
  phase: LiarsDicePhase;
  /** Public record of the most recent challenge, cleared when the next round starts. */
  lastReveal: LiarsDiceReveal | null;
  winner: PlayerId | null;
}

// ------------------------- Per-player view -------------------------

export interface LiarsDiceView {
  players: PlayerId[];
  diceCount: Record<PlayerId, number>;
  /**
   * The viewer's own dice (bidding phase), or every player's dice (reveal
   * phase — the reveal is public). Spectators see nothing during bidding.
   */
  myDice: number[] | null;
  revealedDice: Record<PlayerId, number[]> | null;
  currentBid: LiarsDiceBidOnTable | null;
  current: PlayerId;
  phase: LiarsDicePhase;
  lastReveal: LiarsDiceReveal | null;
  winner: PlayerId | null;
}

// ------------------------- Config -------------------------

/** No lobby-time config. */
export type LiarsDiceConfig = Record<string, never>;

// ------------------------- Moves -------------------------

const faceSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("bid"),
    count: z.number().int().min(1),
    face: faceSchema,
  }),
  z.object({ kind: z.literal("challenge") }),
  z.object({ kind: z.literal("spotOn") }),
  z.object({ kind: z.literal("startNextRound") }),
]);
export type LiarsDiceMove = z.infer<typeof moveSchema>;

// ------------------------- Pure helpers -------------------------

/**
 * Perudo raise ladder (aces wild, non-palifico):
 *   - same face, higher count; OR
 *   - higher face (2..6), count >= current count; OR
 *   - switch to ones: new count >= ceil(currentCount / 2); OR
 *   - switch from ones to non-ones: new count >= 2 * currentCount + 1.
 */
export function isStrictRaise(prev: LiarsDiceBid, next: LiarsDiceBid): boolean {
  if (!Number.isInteger(next.count) || next.count < 1) return false;
  if (next.face < 1 || next.face > 6) return false;

  const prevIsOnes = prev.face === 1;
  const nextIsOnes = next.face === 1;

  if (prevIsOnes && !nextIsOnes) {
    return next.count >= 2 * prev.count + 1;
  }
  if (!prevIsOnes && nextIsOnes) {
    return next.count >= Math.ceil(prev.count / 2);
  }
  if (prev.face === next.face) {
    return next.count > prev.count;
  }
  // Both non-ones, different faces.
  if (next.face > prev.face) {
    return next.count >= prev.count;
  }
  // Lower face, not switching to ones → illegal.
  return false;
}
