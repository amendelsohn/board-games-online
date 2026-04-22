import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const LOVE_LETTER_TYPE = "love-letter";

// ------------------------- Cards -------------------------

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface CardDef {
  rank: Rank;
  name: string;
  /** Short one-line rule summary. */
  effect: string;
}

export const CARDS: Readonly<Record<Rank, CardDef>> = {
  1: {
    rank: 1,
    name: "Guard",
    effect: "Name another player and a non-Guard card. If they hold it, they're out.",
  },
  2: {
    rank: 2,
    name: "Priest",
    effect: "Secretly see another player's hand.",
  },
  3: {
    rank: 3,
    name: "Baron",
    effect: "Compare hands with another player. Lower rank is eliminated.",
  },
  4: {
    rank: 4,
    name: "Handmaid",
    effect: "Immune to effects until your next turn.",
  },
  5: {
    rank: 5,
    name: "Prince",
    effect: "Choose any player; they discard their hand and draw a new card.",
  },
  6: {
    rank: 6,
    name: "King",
    effect: "Swap hands with another player.",
  },
  7: {
    rank: 7,
    name: "Countess",
    effect: "Must be played if you also hold a King or Prince.",
  },
  8: {
    rank: 8,
    name: "Princess",
    effect: "If you ever discard the Princess, you are out.",
  },
} as const;

export const ALL_RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** Base 16-card Love Letter deck composition. */
export const DECK_COMPOSITION: readonly Rank[] = [
  1, 1, 1, 1, 1,
  2, 2,
  3, 3,
  4, 4,
  5, 5,
  6,
  7,
  8,
];

/** Guard guesses must be rank 2..8 (Guard can't name another Guard). */
export type GuardGuessRank = 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const GUARD_GUESS_RANKS: readonly GuardGuessRank[] = [
  2, 3, 4, 5, 6, 7, 8,
];

// ------------------------- Log events -------------------------

/**
 * Append-only record of what happened this hand. Entries are produced
 * server-side; `view()` redacts private fields per viewer.
 */
export type LogEntry =
  | {
      kind: "play";
      actor: PlayerId;
      card: Rank;
      /** For Guard / Priest / Baron / Prince / King. */
      target?: PlayerId;
      /** For Guard only. */
      guess?: Rank;
      /** For Guard only. Public. */
      guessCorrect?: boolean;
      /** No-effect reason (e.g. everyone else immune). */
      fizzled?: boolean;
    }
  | {
      kind: "priestReveal";
      /** The player who played Priest (sees target's card). */
      looker: PlayerId;
      target: PlayerId;
      /** Redacted for non-participants in view(). */
      revealedCard: Rank | null;
    }
  | {
      kind: "baronReveal";
      actor: PlayerId;
      target: PlayerId;
      /** Redacted for non-participants in view(). Null if viewer isn't actor/target. */
      actorCard: Rank | null;
      targetCard: Rank | null;
      /** null on tie. Public. */
      loser: PlayerId | null;
    }
  | {
      kind: "eliminated";
      player: PlayerId;
      /** Public — discarded / revealed card that caused elimination. */
      card: Rank;
      cause: "guard" | "baron" | "princess" | "prince-princess";
    }
  | {
      kind: "swap";
      actor: PlayerId;
      target: PlayerId;
    }
  | {
      kind: "princeDiscard";
      actor: PlayerId;
      target: PlayerId;
      /** Discarded by the target. Public. */
      discarded: Rank;
      drewFromBurned: boolean;
    }
  | {
      kind: "handmaidImmune";
      actor: PlayerId;
    }
  | {
      kind: "finalReveal";
      /** Remaining players' hands at deck-out. */
      hands: Record<PlayerId, Rank>;
    };

// ------------------------- State -------------------------

export type LoveLetterPhase = "play" | "gameOver";

export interface LoveLetterState {
  /** Turn order. Eliminated players stay in this list (with empty hand). */
  players: PlayerId[];
  /** 0–2 cards during the current actor's turn, 0 or 1 between turns, [] if eliminated. */
  hands: Record<PlayerId, Rank[]>;
  /** Face-down removed card. */
  burned: Rank;
  /** 2-player only: 3 face-up cards removed at setup (known to all). */
  revealed: Rank[];
  /** Remaining draw pile (top is index 0). */
  deck: Rank[];
  /** The current actor. */
  current: PlayerId;
  phase: LoveLetterPhase;
  /** Players currently protected by Handmaid. */
  immunities: PlayerId[];
  /** Players who've been knocked out. */
  eliminated: PlayerId[];
  log: LogEntry[];
  winner: PlayerId | null;
  isDraw: boolean;
}

// ------------------------- View -------------------------

export interface LoveLetterPlayerView {
  id: PlayerId;
  handCount: number;
  /** Revealed only for the viewer's own hand during play, and for all at gameOver. */
  hand: Rank[] | null;
  eliminated: boolean;
  immune: boolean;
}

export interface LoveLetterView {
  phase: LoveLetterPhase;
  /** Turn order. */
  players: PlayerId[];
  current: PlayerId;
  /** Cards remaining in the draw pile (public count). */
  deckCount: number;
  /** Face-up cards removed at 2p setup. Public. */
  revealed: Rank[];
  /** Per-player summary, redacted. */
  perPlayer: Record<PlayerId, LoveLetterPlayerView>;
  /** Redacted log entries — private fields blanked out for non-participants. */
  log: LogEntry[];
  /** Revealed on terminal, otherwise null. */
  burned: Rank | null;
  winner: PlayerId | null;
  isDraw: boolean;
}

// ------------------------- Moves -------------------------

/**
 * Single "play" move per turn. Server auto-draws a second card at turn start,
 * then the actor picks one of their two cards to play (with optional target/guess).
 */
export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("play"),
    cardIndex: z.union([z.literal(0), z.literal(1)]),
    target: z.string().min(1).optional(),
    /** Guard only — must name rank 2..8. */
    guardGuess: z
      .union([
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
        z.literal(7),
        z.literal(8),
      ])
      .optional(),
  }),
]);
export type LoveLetterMove = z.infer<typeof moveSchema>;

// ------------------------- Config -------------------------

export type LoveLetterConfig = Record<string, never>;
