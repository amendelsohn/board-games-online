import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const GO_FISH_TYPE = "go-fish";

// ------------------------- Cards -------------------------

export const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;
export type Rank = (typeof RANKS)[number];

export const SUITS = ["C", "D", "H", "S"] as const;
export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

/** Serialize a card to a stable string id (e.g. "7H", "10C"). */
export function cardId(c: Card): string {
  return `${c.rank}${c.suit}`;
}

// ------------------------- Log / events -------------------------

/**
 * Public record of what happened on the most recent ask. The view exposes
 * the last entry so the board can render "Alice asked Bob for 7s — Go fish!"
 */
export interface AskLogEntry {
  kind: "ask";
  asker: PlayerId;
  target: PlayerId;
  rank: Rank;
  /** How many cards moved from target to asker. 0 = "Go fish". */
  gotCount: number;
  /** Present when the asker drew a card on a "Go fish" result. */
  drew?: {
    /** True if the drawn card happened to match the requested rank. */
    matched: boolean;
  };
  /** Ranks the asker completed as a book on this ask. */
  booksClaimed: Rank[];
}

// ------------------------- State -------------------------

export type GoFishPhase = "play" | "gameOver";

export interface GoFishState {
  /** Turn order. */
  players: PlayerId[];
  /** Per-player hand (full cards, authoritative). Redacted in view(). */
  hands: Record<PlayerId, Card[]>;
  /** Per-player face-up books, by rank. */
  books: Record<PlayerId, Rank[]>;
  /** Remaining draw pile. Top of pile is the last element. */
  deck: Card[];
  /** Whose turn it is. */
  current: PlayerId;
  phase: GoFishPhase;
  /** Most recent action, for the public log. Null until the first ask. */
  lastAction: AskLogEntry | null;
}

// ------------------------- View -------------------------

export interface GoFishPlayerView {
  id: PlayerId;
  /** Visible to viewer iff this is their own seat (otherwise null). */
  hand: Card[] | null;
  handCount: number;
  books: Rank[];
}

export interface GoFishView {
  phase: GoFishPhase;
  players: PlayerId[];
  current: PlayerId;
  deckCount: number;
  perPlayer: Record<PlayerId, GoFishPlayerView>;
  /** Most recent public action. */
  lastAction: AskLogEntry | null;
  /** Winners (players with the most books) once the game ends; null otherwise. */
  winners: PlayerId[] | null;
}

// ------------------------- Moves -------------------------

const rankSchema = z.enum(RANKS);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ask"),
    targetPlayer: z.string().min(1),
    rank: rankSchema,
  }),
]);
export type GoFishMove = z.infer<typeof moveSchema>;

// ------------------------- Config -------------------------

export type GoFishConfig = Record<string, never>;
