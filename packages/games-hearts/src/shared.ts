import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const HEARTS_TYPE = "hearts";

export type Suit = "C" | "D" | "H" | "S";

export interface Card {
  suit: Suit;
  /** 2..10 for number cards, 11=J, 12=Q, 13=K, 14=A. */
  rank: number;
}

export const SUITS: readonly Suit[] = ["C", "D", "H", "S"];
export const RANKS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Full 52-card deck, ordered by suit then ascending rank. */
export const FULL_DECK: readonly Card[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => ({ suit, rank })),
);

export const SUIT_ORDER: Record<Suit, number> = { C: 0, D: 1, H: 2, S: 3 };

export function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function cardKey(c: Card): string {
  return `${c.suit}${c.rank}`;
}

/** Sort by suit (C, D, H, S) then ascending rank — the hand display order. */
export function compareCards(a: Card, b: Card): number {
  const s = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  if (s !== 0) return s;
  return a.rank - b.rank;
}

export function sortHand(cards: readonly Card[]): Card[] {
  return cards.slice().sort(compareCards);
}

export function handContains(hand: readonly Card[], card: Card): boolean {
  return hand.some((c) => cardsEqual(c, card));
}

export function isHeart(c: Card): boolean {
  return c.suit === "H";
}

export function isQueenOfSpades(c: Card): boolean {
  return c.suit === "S" && c.rank === 12;
}

export function isTwoOfClubs(c: Card): boolean {
  return c.suit === "C" && c.rank === 2;
}

export function rankLabel(rank: number): string {
  if (rank <= 10) return String(rank);
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return "A";
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case "C":
      return "♣";
    case "D":
      return "♦";
    case "H":
      return "♥";
    case "S":
      return "♠";
  }
}

export function cardLabel(c: Card): string {
  return `${rankLabel(c.rank)}${suitSymbol(c.suit)}`;
}

export type HeartsPhase = "passing" | "playing" | "gameOver";

export interface TrickEntry {
  by: PlayerId;
  card: Card;
}

export interface HeartsState {
  phase: HeartsPhase;
  /** Seat order, indices 0..3. Passing direction is +1 (to the left). */
  playerOrder: PlayerId[];
  /** Authoritative per-player hands. Private — never serialized to other players. */
  hands: Record<PlayerId, Card[]>;
  /** Cards each player has committed to pass. null = not passed yet. Cleared after resolve. */
  passed: Record<PlayerId, Card[] | null>;
  /** In-progress trick. Plays in order; length 0..4. */
  currentTrick: TrickEntry[];
  /** Tricks each player has won so far. Each entry is the 4-card pile. */
  tricksTaken: Record<PlayerId, Card[][]>;
  heartsBroken: boolean;
  /** Suit that was led on the current trick. null between tricks. */
  leadSuit: Suit | null;
  /** Player to act next, or null at gameOver. */
  current: PlayerId | null;
  /** Per-player running score; populated once all 13 tricks are played. */
  scores: Record<PlayerId, number>;
  winner: PlayerId | null;
  isDraw: boolean;
}

// ------------------------- Per-viewer projection -------------------------

export interface HeartsView {
  phase: HeartsPhase;
  playerOrder: PlayerId[];
  /** Viewer's hand only, sorted. Empty array for spectators. */
  hand: Card[];
  /** Hand size per player — public info. */
  handSizes: Record<PlayerId, number>;
  /** Whether each player has already locked in their pass (booleans, no contents). */
  passed: Record<PlayerId, boolean>;
  /** The viewer's own pass selection if they've passed — else null. */
  myPass: Card[] | null;
  /**
   * After passing resolves, the 3 cards this viewer received from the player on
   * their right. Shown as a "you received" peek on the first playing tick.
   */
  myReceived: Card[] | null;
  /** Public — everyone sees the trick in progress. */
  currentTrick: TrickEntry[];
  leadSuit: Suit | null;
  /** Tricks won count per player (counts only while playing; full reveal at gameOver). */
  tricksWonCount: Record<PlayerId, number>;
  /** Revealed only at gameOver. Otherwise null. */
  tricksTaken: Record<PlayerId, Card[][]> | null;
  heartsBroken: boolean;
  current: PlayerId | null;
  scores: Record<PlayerId, number>;
  winner: PlayerId | null;
  isDraw: boolean;
}

// ------------------------- Config -------------------------

/** Hearts has no lobby-time config in v1. */
export type HeartsConfig = Record<string, never>;

// ------------------------- Moves -------------------------

const cardSchema = z.object({
  suit: z.enum(["C", "D", "H", "S"]),
  rank: z.number().int().min(2).max(14),
});

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pass"),
    cards: z.array(cardSchema).length(3),
  }),
  z.object({
    kind: z.literal("play"),
    card: cardSchema,
  }),
]);
export type HeartsMove = z.infer<typeof moveSchema>;
