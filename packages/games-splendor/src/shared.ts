import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const SPLENDOR_TYPE = "splendor";

export const GEMS = ["white", "blue", "green", "red", "black"] as const;
export type Gem = (typeof GEMS)[number];
export type GemWithGold = Gem | "gold";
export const ALL_TOKENS: readonly GemWithGold[] = [...GEMS, "gold"];

export type Tier = 1 | 2 | 3;

export interface Card {
  id: string;
  tier: Tier;
  points: number;
  bonus: Gem;
  cost: Record<Gem, number>;
}

export interface Noble {
  id: string;
  points: number;
  req: Record<Gem, number>;
}

export const POINTS_TO_WIN = 15;
export const RESERVE_LIMIT = 3;
export const TOKEN_LIMIT = 10;

export function gemSupply(playerCount: number): Record<Gem, number> {
  const perColor = playerCount === 2 ? 4 : playerCount === 3 ? 5 : 7;
  return {
    white: perColor,
    blue: perColor,
    green: perColor,
    red: perColor,
    black: perColor,
  };
}
export const GOLD_SUPPLY = 5;

export type SplendorPhase = "play" | "gameOver";

export interface PlayerPublic {
  id: PlayerId;
  tokens: Record<GemWithGold, number>;
  bonuses: Record<Gem, number>;
  points: number;
  cardCount: number;
  nobles: Noble[];
  /** Count of reserved cards — identities hidden from opponents. */
  reservedCount: number;
  /** Only populated for the viewer's own seat — opponents see null here. */
  reserved: Card[] | null;
}

export interface SplendorState {
  players: PlayerId[];
  tokens: Record<GemWithGold, number>;
  /** Visible cards per tier; null = empty slot (deck exhausted). */
  display: {
    1: (Card | null)[];
    2: (Card | null)[];
    3: (Card | null)[];
  };
  decks: {
    1: Card[];
    2: Card[];
    3: Card[];
  };
  nobles: Noble[];
  seats: Record<
    PlayerId,
    {
      tokens: Record<GemWithGold, number>;
      bonuses: Record<Gem, number>;
      points: number;
      owned: Card[];
      reserved: Card[];
      nobles: Noble[];
    }
  >;
  current: PlayerId;
  phase: SplendorPhase;
  /** Set to the player who first hit 15 pts — finish the round, then end. */
  finalRoundTrigger: PlayerId | null;
  /** Turn counter, used for final-round detection. */
  turn: number;

  /** Last move summary for UI — lightweight. */
  lastAction: SplendorLastAction | null;

  winners: PlayerId[] | null;
}

export type SplendorLastAction =
  | {
      kind: "takeTokens";
      by: PlayerId;
      tokens: Partial<Record<GemWithGold, number>>;
      returned?: Partial<Record<GemWithGold, number>>;
    }
  | {
      kind: "reserve";
      by: PlayerId;
      cardId: string | null;
      tier: Tier;
      fromDeck: boolean;
      goldGained: boolean;
      returned?: Partial<Record<GemWithGold, number>>;
    }
  | {
      kind: "buy";
      by: PlayerId;
      cardId: string;
      points: number;
      bonus: Gem;
      paid: Partial<Record<GemWithGold, number>>;
      fromReserve: boolean;
      nobleClaimed: Noble | null;
    };

// ------------------------- View -------------------------

export interface SplendorView {
  players: PlayerId[];
  tokens: Record<GemWithGold, number>;
  display: SplendorState["display"];
  deckCounts: { 1: number; 2: number; 3: number };
  nobles: Noble[];
  seats: Record<PlayerId, PlayerPublic>;
  current: PlayerId;
  phase: SplendorPhase;
  finalRoundTrigger: PlayerId | null;
  turn: number;
  lastAction: SplendorLastAction | null;
  winners: PlayerId[] | null;
  /** For convenience the viewer's own id (spectator => null). */
  me: PlayerId | null;
}

export type SplendorConfig = Record<string, never>;

// ------------------------- Moves -------------------------

const gemSchema = z.enum(GEMS);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("takeThree"),
    gems: z.array(gemSchema).length(3),
    /** On token overflow (>10 after take), what to return. Sum must equal overflow. */
    returnTokens: z.record(z.number().int().min(0)).optional(),
  }),
  z.object({
    kind: z.literal("takeTwo"),
    gem: gemSchema,
    returnTokens: z.record(z.number().int().min(0)).optional(),
  }),
  z.object({
    kind: z.literal("reserve"),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** If omitted, reserve top of deck. Otherwise 0..3 slot index. */
    slot: z.number().int().min(0).max(3).optional(),
    returnTokens: z.record(z.number().int().min(0)).optional(),
  }),
  // Buy has two shapes (display vs reserve) — zod can't put two entries with
  // the same `kind` in a discriminated union, so we combine them and validate
  // the source-specific fields in the handler.
  z.object({
    kind: z.literal("buy"),
    source: z.enum(["display", "reserve"]),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    slot: z.number().int().min(0).max(3).optional(),
    cardId: z.string().optional(),
    /** Explicit gold allocation per color (covers non-gold shortfall). */
    gold: z.record(z.number().int().min(0)).optional(),
  }),
]);
export type SplendorMove = z.infer<typeof moveSchema>;

// ------------------------- Helpers -------------------------

export function emptyGems(): Record<Gem, number> {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0 };
}
export function emptyTokens(): Record<GemWithGold, number> {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
}

export function tokenTotal(t: Record<GemWithGold, number>): number {
  return t.white + t.blue + t.green + t.red + t.black + t.gold;
}

export interface PayBreakdown {
  ok: boolean;
  /** Tokens spent (per color). */
  spend: Record<GemWithGold, number>;
  /** Missing amount total if !ok. */
  missing?: number;
}

/**
 * Compute how many tokens (by color) are needed to pay for a card given the
 * player's bonuses, tokens, and an optional explicit gold allocation.
 */
export function payForCard(
  card: Card,
  tokens: Record<GemWithGold, number>,
  bonuses: Record<Gem, number>,
  explicitGold?: Record<string, number>,
): PayBreakdown {
  const spend: Record<GemWithGold, number> = emptyTokens();
  let missing = 0;
  let goldLeft = tokens.gold;
  const rawGold: Record<string, number> = { ...(explicitGold ?? {}) };

  for (const g of GEMS) {
    const needed = Math.max(0, card.cost[g] - (bonuses[g] ?? 0));
    const have = tokens[g];
    const assignedGold = Math.max(0, rawGold[g] ?? 0);
    if (needed <= have) {
      spend[g] = needed;
    } else {
      const shortfall = needed - have;
      const useGold = Math.min(
        shortfall,
        Math.min(goldLeft, assignedGold > 0 ? assignedGold : goldLeft),
      );
      spend[g] = have;
      spend.gold += useGold;
      goldLeft -= useGold;
      if (useGold < shortfall) {
        missing += shortfall - useGold;
      }
    }
  }

  return missing > 0 ? { ok: false, spend, missing } : { ok: true, spend };
}

export function nobleEligible(
  bonuses: Record<Gem, number>,
  noble: Noble,
): boolean {
  return GEMS.every((g) => bonuses[g] >= (noble.req[g] ?? 0));
}
