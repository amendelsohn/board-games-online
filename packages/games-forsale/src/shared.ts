import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const FORSALE_TYPE = "for-sale";

export const PROPERTY_COUNT = 30; // 1..30
export const CHEQUE_VALUES: readonly number[] = (() => {
  // Two copies each of 0, 2..15 → 30 cheques (official distribution).
  const vals: number[] = [];
  vals.push(0, 0);
  for (let v = 2; v <= 15; v++) vals.push(v, v);
  return vals;
})();

export function startingCoins(playerCount: number): number {
  // 3p, 4p → 18; 5p → 15; 6p → 14. (Official distribution.)
  if (playerCount <= 4) return 18;
  if (playerCount === 5) return 15;
  return 14;
}

export type ForSalePhase = "property" | "cheque" | "gameOver";

export interface PropertyResolveEntry {
  player: PlayerId;
  card: number;
  paid: number;
}
export interface ChequeResolveEntry {
  player: PlayerId;
  property: number;
  cheque: number;
}
export type LastResolve =
  | { kind: "property"; takes: PropertyResolveEntry[] }
  | { kind: "cheque"; plays: ChequeResolveEntry[] }
  | null;

export interface ForSaleState {
  players: PlayerId[];
  phase: ForSalePhase;

  coins: Record<PlayerId, number>;
  properties: Record<PlayerId, number[]>;
  cheques: Record<PlayerId, number[]>;

  propertyDeck: number[];
  chequeDeck: number[];

  /** Rotates each property round. */
  startPlayer: PlayerId;

  // Property round
  faceUpProperties: number[];
  bids: Record<PlayerId, number>;
  currentBid: number;
  currentBidder: PlayerId | null;
  passedThisRound: PlayerId[];
  current: PlayerId;

  // Cheque round
  faceUpCheques: number[];
  chequePlays: Record<PlayerId, number | null>;

  lastResolve: LastResolve;

  finalScores: Record<PlayerId, number> | null;
  winners: PlayerId[] | null;
}

// ------------------------- Per-player view -------------------------

export interface ForSaleView {
  players: PlayerId[];
  phase: ForSalePhase;
  coins: Record<PlayerId, number>;
  propertyCount: Record<PlayerId, number>;
  chequeCount: Record<PlayerId, number>;
  /** Full cheque values (public once won). */
  cheques: Record<PlayerId, number[]>;

  propertyDeckSize: number;
  chequeDeckSize: number;

  // Your private properties in hand.
  myProperties: number[];

  // Property round
  faceUpProperties: number[];
  bids: Record<PlayerId, number>;
  currentBid: number;
  currentBidder: PlayerId | null;
  passedThisRound: PlayerId[];
  current: PlayerId;
  startPlayer: PlayerId;

  // Cheque round — plays hidden until reveal
  faceUpCheques: number[];
  submitted: Record<PlayerId, boolean>;
  /** Your own current selection, null if not submitted. */
  mySelection: number | null;

  lastResolve: LastResolve;

  finalScores: Record<PlayerId, number> | null;
  winners: PlayerId[] | null;
}

export type ForSaleConfig = Record<string, never>;

// ------------------------- Moves -------------------------

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("bid"), amount: z.number().int().min(1) }),
  z.object({ kind: z.literal("pass") }),
  z.object({
    kind: z.literal("playProperty"),
    card: z.number().int().min(1).max(PROPERTY_COUNT),
  }),
]);
export type ForSaleMove = z.infer<typeof moveSchema>;

// ------------------------- Helpers -------------------------

export function finalScoreOf(
  coins: number,
  cheques: number[],
): number {
  let s = coins;
  for (const c of cheques) s += c;
  return s;
}
