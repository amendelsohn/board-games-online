import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const SUSHIGO_TYPE = "sushi-go";

/**
 * Card kinds. We ship the original Sushi Go (not "Party") set:
 *  - Tempura: 5 pts per pair
 *  - Sashimi: 10 pts per trio
 *  - Dumpling: 1 / 3 / 6 / 10 / 15 for 1..5 dumplings
 *  - Maki: most/2nd-most ribbons across players (6/3 split, ties share)
 *  - Nigiri (egg/salmon/squid): 1/2/3 pts (tripled if on Wasabi)
 *  - Wasabi: triples the next nigiri you play
 *  - Chopsticks: swap with two hand cards next turn (we'll model as a
 *    second pick from your *current* hand on a later turn — see schema)
 *  - Pudding: most across all 3 rounds = +6, fewest = -6 (ties share)
 */
export type CardKind =
  | "tempura"
  | "sashimi"
  | "dumpling"
  | "maki1"
  | "maki2"
  | "maki3"
  | "nigiri-egg"
  | "nigiri-salmon"
  | "nigiri-squid"
  | "wasabi"
  | "chopsticks"
  | "pudding";

export interface Card {
  id: string; // unique within deck
  kind: CardKind;
}

/** Hand size by player count, per Sushi Go rulebook. */
export const HAND_SIZE: Record<number, number> = {
  2: 10,
  3: 9,
  4: 8,
  5: 7,
};

export const ROUNDS = 3;

/** Standard deck composition (108 cards) — we encode by kind counts. */
export const DECK_COUNTS: Record<CardKind, number> = {
  tempura: 14,
  sashimi: 14,
  dumpling: 14,
  "maki1": 6,
  "maki2": 12,
  "maki3": 8,
  "nigiri-egg": 5,
  "nigiri-salmon": 10,
  "nigiri-squid": 5,
  wasabi: 6,
  chopsticks: 4,
  pudding: 10,
};

export type SushiPhase = "pick" | "scoring" | "gameOver";

export interface SushiPlayerPublic {
  id: PlayerId;
  /** Cards played to the table for the current round (face-up). */
  played: Card[];
  /** Score across all completed rounds. */
  score: number;
  /** Pudding count carried across the game. */
  puddings: number;
  /** Current hand size — public, contents hidden from opponents. */
  handSize: number;
  /** Whether they've locked in their pick this turn. */
  hasPicked: boolean;
}

export interface SushiState {
  players: PlayerId[];
  /** Round 1..3, then gameOver. */
  round: number;
  /** Cards remaining in deck for new rounds. */
  deck: Card[];
  /** Per-seat hidden hand. */
  hands: Record<PlayerId, Card[]>;
  /** Per-seat played pile (current round). */
  played: Record<PlayerId, Card[]>;
  /** Pudding running totals per seat (carried across rounds). */
  puddings: Record<PlayerId, number>;
  /** Cumulative score across rounds. */
  scores: Record<PlayerId, number>;
  /**
   * Current-turn picks (locked-in but not yet revealed). Always exactly the
   * card id pending; revealed and applied when all seats have picked.
   */
  picks: Record<PlayerId, { primary: string; secondary?: string } | null>;
  /** Per-seat: do they have an active Chopsticks they want to spend? */
  chopsticksReady: Record<PlayerId, boolean>;
  phase: SushiPhase;
  /** End-of-round summary for UI; cleared when next round begins. */
  lastRoundResult: SushiRoundResult | null;
  /** Final ranking on game over. */
  finalScores: Record<PlayerId, number> | null;
  winners: PlayerId[] | null;
}

export interface SushiRoundResult {
  round: number;
  /** Per-player breakdown for this round. */
  breakdown: Record<
    PlayerId,
    {
      tempura: number;
      sashimi: number;
      dumpling: number;
      maki: number;
      nigiri: number;
      total: number;
    }
  >;
  /** Pudding totals at end of game (only set on round 3). */
  puddingTotal?: Record<PlayerId, number> | null;
}

// ------------------------- View -------------------------

export interface SushiView {
  players: PlayerId[];
  round: number;
  phase: SushiPhase;
  /** Viewer's own hand (cards). null for spectators. */
  myHand: Card[] | null;
  seats: Record<PlayerId, SushiPlayerPublic>;
  /** Per-seat last-revealed played card (visible after the simultaneous pick). */
  lastRevealed: Record<PlayerId, Card[]> | null;
  lastRoundResult: SushiRoundResult | null;
  finalScores: Record<PlayerId, number> | null;
  winners: PlayerId[] | null;
  /** Convenience for client. */
  me: PlayerId | null;
  /** Did the viewer already lock their pick this turn? */
  iHavePicked: boolean;
  /** Does the viewer have a Wasabi waiting to be paired with a nigiri? */
  iHaveWasabiPending: boolean;
  /** Does the viewer have an unspent chopsticks they could play now? */
  iCanUseChopsticks: boolean;
}

export type SushiConfig = Record<string, never>;

// ------------------------- Moves -------------------------

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pick"),
    /** Card id from your current hand. */
    cardId: z.string(),
    /**
     * Optional second card id. If present AND you have a chopsticks already
     * in your played pile, you'll pick both this turn (and return the
     * chopsticks to your hand for next turn).
     */
    secondCardId: z.string().optional(),
  }),
]);
export type SushiMove = z.infer<typeof moveSchema>;

// ------------------------- Pure helpers -------------------------

export function isNigiri(kind: CardKind): boolean {
  return (
    kind === "nigiri-egg" ||
    kind === "nigiri-salmon" ||
    kind === "nigiri-squid"
  );
}

export function nigiriBaseValue(kind: CardKind): number {
  if (kind === "nigiri-egg") return 1;
  if (kind === "nigiri-salmon") return 2;
  if (kind === "nigiri-squid") return 3;
  return 0;
}

export function makiCount(kind: CardKind): number {
  if (kind === "maki1") return 1;
  if (kind === "maki2") return 2;
  if (kind === "maki3") return 3;
  return 0;
}

export const DUMPLING_TABLE = [0, 1, 3, 6, 10, 15];

/** Score the played cards for a single round (excluding pudding). */
export function scoreRound(
  byPlayer: Record<PlayerId, Card[]>,
): {
  perPlayer: Record<
    PlayerId,
    {
      tempura: number;
      sashimi: number;
      dumpling: number;
      maki: number; // assigned later
      nigiri: number;
      total: number;
    }
  >;
} {
  const perPlayer: Record<
    PlayerId,
    {
      tempura: number;
      sashimi: number;
      dumpling: number;
      maki: number;
      nigiri: number;
      total: number;
    }
  > = {};

  // First pass: per-card scoring (tempura/sashimi/dumpling/nigiri+wasabi).
  const makiBy: Record<PlayerId, number> = {};
  for (const [pid, cards] of Object.entries(byPlayer)) {
    let tempura = 0;
    let sashimi = 0;
    let dumpling = 0;
    let nigiri = 0;
    let maki = 0;
    let tempuraCount = 0;
    let sashimiCount = 0;
    let dumplingCount = 0;
    /**
     * Wasabi multiplier resolution: each Wasabi is "spent" by the next nigiri
     * placed *after* it in the played sequence. Track open wasabis as a queue.
     */
    let openWasabis = 0;
    for (const c of cards) {
      if (c.kind === "tempura") tempuraCount++;
      else if (c.kind === "sashimi") sashimiCount++;
      else if (c.kind === "dumpling") dumplingCount++;
      else if (c.kind === "wasabi") openWasabis++;
      else if (isNigiri(c.kind)) {
        const base = nigiriBaseValue(c.kind);
        if (openWasabis > 0) {
          nigiri += base * 3;
          openWasabis -= 1;
        } else {
          nigiri += base;
        }
      } else if (
        c.kind === "maki1" ||
        c.kind === "maki2" ||
        c.kind === "maki3"
      ) {
        maki += makiCount(c.kind);
      }
      // chopsticks: 0 pts; pudding: scored separately at game end.
    }
    tempura = Math.floor(tempuraCount / 2) * 5;
    sashimi = Math.floor(sashimiCount / 3) * 10;
    dumpling = DUMPLING_TABLE[Math.min(5, dumplingCount)] ?? 0;

    perPlayer[pid] = {
      tempura,
      sashimi,
      dumpling,
      maki: 0,
      nigiri,
      total: 0,
    };
    makiBy[pid] = maki;
  }

  // Maki: most ribbons +6 (split if tied), 2nd most +3 (split if tied,
  // skipped if 3+ share first).
  const playerIds = Object.keys(byPlayer);
  const sorted = [...playerIds].sort((a, b) => makiBy[b]! - makiBy[a]!);
  const counts = sorted.map((id) => makiBy[id] ?? 0);
  const top = counts[0] ?? 0;
  if (top > 0) {
    const firstTier = sorted.filter((id) => (makiBy[id] ?? 0) === top);
    const each6 = Math.floor(6 / firstTier.length);
    for (const id of firstTier) perPlayer[id]!.maki += each6;

    if (firstTier.length === 1) {
      const remaining = sorted.filter(
        (id) => !firstTier.includes(id) && (makiBy[id] ?? 0) > 0,
      );
      const second = (makiBy[remaining[0] ?? ""] ?? 0);
      if (remaining.length > 0 && second > 0) {
        const secondTier = remaining.filter(
          (id) => (makiBy[id] ?? 0) === second,
        );
        const each3 = Math.floor(3 / secondTier.length);
        for (const id of secondTier) perPlayer[id]!.maki += each3;
      }
    }
  }

  for (const id of playerIds) {
    const b = perPlayer[id]!;
    b.total = b.tempura + b.sashimi + b.dumpling + b.maki + b.nigiri;
  }

  return { perPlayer };
}

export function scorePuddings(
  puddings: Record<PlayerId, number>,
  playerCount: number,
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const id of Object.keys(puddings)) out[id] = 0;
  const counts = Object.values(puddings);
  const max = Math.max(...counts);
  if (max <= 0) return out;
  const top = Object.entries(puddings).filter(([, n]) => n === max);
  const each6 = Math.floor(6 / top.length);
  for (const [id] of top) out[id] = each6;
  if (playerCount > 2) {
    const min = Math.min(...counts);
    if (min !== max) {
      const bottom = Object.entries(puddings).filter(([, n]) => n === min);
      const each6down = Math.floor(6 / bottom.length);
      for (const [id] of bottom) out[id] = (out[id] ?? 0) - each6down;
    }
  }
  return out;
}
