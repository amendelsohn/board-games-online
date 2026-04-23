import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const HANABI_TYPE = "hanabi";

export const COLORS = ["red", "yellow", "green", "blue", "white"] as const;
export type HanabiColor = (typeof COLORS)[number];

export const RANKS = [1, 2, 3, 4, 5] as const;
export type HanabiRank = (typeof RANKS)[number];

/** Deck composition per color: three 1s, two each of 2/3/4, one 5 = 10 cards × 5 colors = 50. */
export const RANK_COUNTS: Record<HanabiRank, number> = {
  1: 3,
  2: 2,
  3: 2,
  4: 2,
  5: 1,
};

export const INFO_TOKENS_MAX = 8;
export const FUSE_TOKENS_MAX = 3;

export function handSize(playerCount: number): number {
  if (playerCount <= 3) return 5;
  return 4;
}

export interface HanabiCard {
  id: string;
  color: HanabiColor;
  rank: HanabiRank;
}

/**
 * Per-card hint knowledge: what has been revealed to the card's holder about
 * its identity. `possibleColors`/`possibleRanks` shrink each time a hint rules
 * out options; `knownColor`/`knownRank` are shorthand for length-1 possibles.
 */
export interface CardKnowledge {
  possibleColors: HanabiColor[];
  possibleRanks: HanabiRank[];
  /** Colors explicitly told about this card ("your red card"). Distinct from inferred. */
  toldColors: HanabiColor[];
  /** Ranks explicitly told about this card. */
  toldRanks: HanabiRank[];
}

export type HanabiPhase = "play" | "gameOver";

export interface HanabiState {
  players: PlayerId[];
  /** Hand cards in seating order — each seat's own cards are hidden from self. */
  hands: Record<PlayerId, HanabiCard[]>;
  /** Knowledge tracked per card, keyed by card.id. */
  knowledge: Record<string, CardKnowledge>;
  /** Remaining draw deck (face-down to all). */
  deck: HanabiCard[];
  /** Played firework stacks — top rank per color (0 = empty). */
  played: Record<HanabiColor, HanabiRank | 0>;
  /** Discard pile — all public. */
  discard: HanabiCard[];
  info: number;
  fuses: number;
  current: PlayerId;
  phase: HanabiPhase;
  /**
   * Final-round counter. When the deck empties, each remaining seat
   * gets exactly one more turn; we count down from `players.length`.
   * -1 = deck still has cards; 0 = last turn just taken.
   */
  finalRoundTurnsLeft: number;
  /** Final score (sum of top ranks across colors), set on game over. */
  score: number | null;
  /** Most recent action for UI feedback. */
  lastAction: HanabiLastAction | null;
}

export type HanabiLastAction =
  | {
      kind: "hint";
      by: PlayerId;
      target: PlayerId;
      hint:
        | { type: "color"; color: HanabiColor }
        | { type: "rank"; rank: HanabiRank };
      /** Positions of the target's hand that matched. */
      positions: number[];
    }
  | {
      kind: "play";
      by: PlayerId;
      card: HanabiCard;
      slot: number;
      success: boolean;
      drew?: HanabiCard | null; // only visible to owner — strip in view
    }
  | {
      kind: "discard";
      by: PlayerId;
      card: HanabiCard;
      slot: number;
      drew?: HanabiCard | null;
    };

// ------------------------- View -------------------------

/**
 * A card as seen by the current viewer. If the card belongs to the viewer,
 * `color`/`rank` are null (unknown to self). Knowledge is always shown so the
 * viewer can reason about their own hand.
 */
export interface HanabiHandCardView {
  id: string;
  color: HanabiColor | null;
  rank: HanabiRank | null;
  knowledge: CardKnowledge;
}

export interface HanabiView {
  players: PlayerId[];
  /** All seats' hands — viewer's own cards are color/rank null. */
  hands: Record<PlayerId, HanabiHandCardView[]>;
  played: Record<HanabiColor, HanabiRank | 0>;
  discard: HanabiCard[];
  deckCount: number;
  info: number;
  fuses: number;
  current: PlayerId;
  phase: HanabiPhase;
  finalRoundTurnsLeft: number;
  score: number | null;
  lastAction: HanabiLastAction | null;
  me: PlayerId | null;
}

export type HanabiConfig = Record<string, never>;

// ------------------------- Moves -------------------------

const colorSchema = z.enum(COLORS);
const rankSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("play"),
    /** 0-indexed position in your own hand. */
    slot: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("discard"),
    slot: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("hintColor"),
    target: z.string(),
    color: colorSchema,
  }),
  z.object({
    kind: z.literal("hintRank"),
    target: z.string(),
    rank: rankSchema,
  }),
]);
export type HanabiMove = z.infer<typeof moveSchema>;

// ------------------------- Helpers -------------------------

export function emptyStacks(): Record<HanabiColor, HanabiRank | 0> {
  return { red: 0, yellow: 0, green: 0, blue: 0, white: 0 };
}

export function freshKnowledge(): CardKnowledge {
  return {
    possibleColors: [...COLORS],
    possibleRanks: [...RANKS],
    toldColors: [],
    toldRanks: [],
  };
}

export function scoreFireworks(
  played: Record<HanabiColor, HanabiRank | 0>,
): number {
  return COLORS.reduce((sum, c) => sum + (played[c] ?? 0), 0);
}
