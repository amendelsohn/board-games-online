import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const CATEGORIES = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "threeKind",
  "fourKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const UPPER_CATEGORIES: readonly Category[] = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
] as const;

export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS = 35;

export type Scorecard = Partial<Record<Category, number>>;

export interface YahtzeeState {
  players: PlayerId[];
  current: PlayerId;
  turnRollNumber: number;
  dice: number[];
  kept: boolean[];
  scorecards: Record<PlayerId, Scorecard>;
  winner: PlayerId | null;
  isDraw: boolean;
  phase: "playing" | "gameOver";
}

export interface YahtzeeView {
  players: PlayerId[];
  current: PlayerId;
  turnRollNumber: number;
  dice: number[];
  kept: boolean[];
  scorecards: Record<PlayerId, Scorecard>;
  winner: PlayerId | null;
  isDraw: boolean;
  phase: "playing" | "gameOver";
}

const keepMaskSchema = z
  .array(z.boolean())
  .length(5);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("roll"),
    keepMask: keepMaskSchema,
  }),
  z.object({
    kind: z.literal("assign"),
    category: z.enum(CATEGORIES),
  }),
]);

export type YahtzeeMove = z.infer<typeof moveSchema>;

export type YahtzeeConfig = Record<string, never>;

export const YAHTZEE_TYPE = "yahtzee";

export const MAX_ROLLS_PER_TURN = 3;
export const DICE_COUNT = 5;

/** Count frequency of each face 1..6 in a dice array. */
function faceCounts(dice: readonly number[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) {
    if (d >= 1 && d <= 6) counts[d]! += 1;
  }
  return counts;
}

function sum(dice: readonly number[]): number {
  let s = 0;
  for (const d of dice) s += d;
  return s;
}

function hasStraight(counts: readonly number[], length: number): boolean {
  let run = 0;
  for (let face = 1; face <= 6; face++) {
    if ((counts[face] ?? 0) > 0) {
      run += 1;
      if (run >= length) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/**
 * Score a category against the given 5 dice. Unrolled dice are represented by
 * zeros and should never be scored — but we still compute a valid value (0)
 * if a caller supplies them.
 */
export function scoreFor(category: Category, dice: readonly number[]): number {
  const counts = faceCounts(dice);
  switch (category) {
    case "ones":
      return (counts[1] ?? 0) * 1;
    case "twos":
      return (counts[2] ?? 0) * 2;
    case "threes":
      return (counts[3] ?? 0) * 3;
    case "fours":
      return (counts[4] ?? 0) * 4;
    case "fives":
      return (counts[5] ?? 0) * 5;
    case "sixes":
      return (counts[6] ?? 0) * 6;
    case "threeKind":
      return counts.some((c) => c >= 3) ? sum(dice) : 0;
    case "fourKind":
      return counts.some((c) => c >= 4) ? sum(dice) : 0;
    case "fullHouse": {
      // Exactly one triple and one pair of different faces.
      const hasThree = counts.some((c) => c === 3);
      const hasTwo = counts.some((c) => c === 2);
      return hasThree && hasTwo ? 25 : 0;
    }
    case "smallStraight":
      return hasStraight(counts, 4) ? 30 : 0;
    case "largeStraight":
      return hasStraight(counts, 5) ? 40 : 0;
    case "yahtzee":
      return counts.some((c) => c === 5) ? 50 : 0;
    case "chance":
      return sum(dice);
  }
}

export function upperSubtotal(card: Scorecard): number {
  let s = 0;
  for (const cat of UPPER_CATEGORIES) {
    const v = card[cat];
    if (typeof v === "number") s += v;
  }
  return s;
}

export function grandTotal(card: Scorecard): number {
  let s = 0;
  for (const cat of CATEGORIES) {
    const v = card[cat];
    if (typeof v === "number") s += v;
  }
  if (upperSubtotal(card) >= UPPER_BONUS_THRESHOLD) s += UPPER_BONUS;
  return s;
}

export function cardFilled(card: Scorecard): boolean {
  for (const cat of CATEGORIES) {
    if (typeof card[cat] !== "number") return false;
  }
  return true;
}
