import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const MEMORY_TYPE = "memory";

export const PAIR_COUNT = 18;
export const CARD_COUNT = PAIR_COUNT * 2; // 36
export const GRID_COLS = 6;
export const GRID_ROWS = 6;

/** Peek window — how long the mismatched pair stays visible before flipping back. */
export const PEEK_MS = 1500;
export const TIMER_KEY_PEEK = "peek";

/**
 * Hard-coded symbol set. Exactly PAIR_COUNT entries so each deck uses every
 * symbol once, shuffled into 18 pairs. Chosen to be visually distinct and
 * renderable across platforms without emoji font fallback surprises.
 */
export const SYMBOLS: readonly string[] = [
  "◆",
  "▲",
  "●",
  "★",
  "■",
  "✚",
  "♠",
  "♣",
  "♥",
  "♦",
  "☀",
  "☂",
  "♫",
  "⚑",
  "☘",
  "✈",
  "☕",
  "☢",
];

export type MemoryPhase = "playing" | "peek" | "gameOver";

/** Authoritative card record. `symbol` is server-side; redacted in view for hidden cards. */
export interface MemoryCard {
  symbol: string;
  owner: PlayerId | null;
}

/** Client-facing card. `symbol` is null when the card is face-down and unclaimed. */
export interface MemoryCardView {
  symbol: string | null;
  owner: PlayerId | null;
}

export interface MemoryState {
  cards: readonly MemoryCard[]; // length CARD_COUNT
  revealed: readonly number[]; // indices currently face-up this turn (0, 1, or 2)
  players: readonly PlayerId[];
  current: PlayerId;
  scores: Record<PlayerId, number>;
  phase: MemoryPhase;
  lastFlipAt: number;
  winner: PlayerId | null;
  isDraw: boolean;
}

export interface MemoryView {
  cards: MemoryCardView[];
  revealed: number[];
  players: PlayerId[];
  current: PlayerId;
  scores: Record<PlayerId, number>;
  phase: MemoryPhase;
  peekMs: number;
  lastFlipAt: number;
  winner: PlayerId | null;
  isDraw: boolean;
}

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("flip"),
    cellIndex: z.number().int().min(0).max(CARD_COUNT - 1),
  }),
  z.object({ kind: z.literal("clearPeek") }),
]);
export type MemoryMove = z.infer<typeof moveSchema>;

/** No lobby-time config for v1. */
export type MemoryConfig = Record<string, never>;
