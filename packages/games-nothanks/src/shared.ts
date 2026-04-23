import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const NOTHANKS_TYPE = "no-thanks";

/** Card values are 3..35 inclusive (33 cards), with 9 removed before play. */
export const CARD_MIN = 3;
export const CARD_MAX = 35;
export const CARDS_REMOVED = 9;

/** Standard chip allocation. */
export function startingChips(playerCount: number): number {
  if (playerCount <= 5) return 11;
  if (playerCount === 6) return 9;
  return 7; // 7 players
}

export type NoThanksPhase = "play" | "gameOver";

export interface NoThanksPlayerPublic {
  id: PlayerId;
  /** Cards taken (sorted ascending). */
  cards: number[];
  /** Chip count is public — it's the whole tension of the game. */
  chips: number;
  /** Final score = sum of "card runs lowest only" - chips. Computed at game end. */
  score: number | null;
}

export interface NoThanksState {
  players: PlayerId[];
  /** Cards remaining face-down in deck (in flip order — index 0 = next card). */
  deck: number[];
  /** Card currently up for offer; null only on game over. */
  currentCard: number | null;
  /** Chips that have piled up on the current card from passes. */
  chipsOnCard: number;
  /** Per-player counts. */
  chips: Record<PlayerId, number>;
  cards: Record<PlayerId, number[]>;
  current: PlayerId;
  phase: NoThanksPhase;
  /** Last move summary for UI feedback. */
  lastAction: NoThanksLastAction | null;
  /** Final scores per player, set when phase = gameOver. */
  finalScores: Record<PlayerId, number> | null;
  winners: PlayerId[] | null;
}

export type NoThanksLastAction =
  | { kind: "pass"; by: PlayerId; card: number; chipsAdded: number }
  | { kind: "take"; by: PlayerId; card: number; chipsTaken: number };

// ------------------------- View -------------------------

export interface NoThanksView {
  players: PlayerId[];
  /** Card on offer (null when game just ended). */
  currentCard: number | null;
  chipsOnCard: number;
  /** Cards left in the deck — public; values are hidden. */
  deckCount: number;
  /** Public per-player snapshots (own chips included). */
  seats: Record<PlayerId, NoThanksPlayerPublic>;
  current: PlayerId;
  phase: NoThanksPhase;
  /** Set on gameOver — same as `seats[id].score`. */
  finalScores: Record<PlayerId, number> | null;
  winners: PlayerId[] | null;
  lastAction: NoThanksLastAction | null;
  /** Convenience: viewer's own seat id, or null for spectators. */
  me: PlayerId | null;
}

export type NoThanksConfig = Record<string, never>;

// ------------------------- Moves -------------------------

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pass") }),
  z.object({ kind: z.literal("take") }),
]);
export type NoThanksMove = z.infer<typeof moveSchema>;

// ------------------------- Helpers -------------------------

/**
 * Score a player's cards: sum of the LOWEST card in each consecutive run,
 * minus their remaining chips. Lower is better.
 */
export function scoreCards(cards: number[], chips: number): number {
  if (cards.length === 0) return -chips;
  const sorted = [...cards].sort((a, b) => a - b);
  let total = 0;
  let runStart = sorted[0]!;
  let prev = sorted[0]!;
  total += runStart;
  for (let i = 1; i < sorted.length; i++) {
    const v = sorted[i]!;
    if (v === prev + 1) {
      // Continuing the run — already counted runStart only.
    } else {
      runStart = v;
      total += runStart;
    }
    prev = v;
  }
  return total - chips;
}
