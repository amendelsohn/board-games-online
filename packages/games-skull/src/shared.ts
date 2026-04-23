import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const SKULL_TYPE = "skull";

export type DiscKind = "flower" | "skull";

export const FLOWERS_PER_PLAYER = 3;
export const SKULLS_PER_PLAYER = 1;
export const DISCS_PER_PLAYER = FLOWERS_PER_PLAYER + SKULLS_PER_PLAYER;
export const POINTS_TO_WIN = 2;

export type SkullPhase =
  | "placing"
  | "bidding"
  | "flipping"
  | "roundOver"
  | "gameOver";

export type RoundOutcome = "success" | "failure";

export interface SkullFlip {
  owner: PlayerId;
  disc: DiscKind;
}

export interface SkullRoundResult {
  outcome: RoundOutcome;
  challenger: PlayerId;
  bid: number;
  /** Ordered reveal — oldest flip first. */
  flips: SkullFlip[];
  /**
   * Populated on failure — the disc the challenger lost (public).
   * Not populated on success.
   */
  lostDisc: DiscKind | null;
  /** Who scored the winning point, if outcome === "success". */
  scorer: PlayerId | null;
  /** Everyone's full cup revealed for dramatic effect at round end. */
  revealed: Record<PlayerId, DiscKind[]>;
}

export interface SkullHand {
  flowers: number;
  skulls: number;
}

/** Public snapshot of every seat — hidden info is stripped in `view`. */
export interface SkullState {
  /** Seated players in clockwise order. Never mutated. */
  players: PlayerId[];
  /** Private hand contents. */
  hand: Record<PlayerId, SkullHand>;
  /** Stack, oldest at index 0, newest at end (top). Hidden from opponents. */
  stacks: Record<PlayerId, DiscKind[]>;
  /** Public scores — successful challenges landed. */
  points: Record<PlayerId, number>;
  /** Whoever starts the next round / placement / bid, depending on phase. */
  current: PlayerId;
  phase: SkullPhase;

  /** Current live bid, or null during placing. */
  currentBid: { count: number; by: PlayerId } | null;
  /** Players who have passed *this* bidding sequence. */
  passed: PlayerId[];

  /** Flipping phase state. */
  challenger: PlayerId | null;
  /** Flips made during the current challenge. */
  flips: SkullFlip[];
  /** Count of flipped cards per stack (consumed from the top). */
  flippedFromStack: Record<PlayerId, number>;

  /** Set to the starter of the *next* round while phase === "roundOver". */
  nextStarter: PlayerId | null;

  /** Most recent resolution — cleared when the next round actually begins. */
  lastResult: SkullRoundResult | null;
  winner: PlayerId | null;
}

// ------------------------- Per-player view -------------------------

export interface SkullView {
  players: PlayerId[];
  /** Own hand exactly; opponents show total disc count via stacks + handCount. */
  myHand: SkullHand | null;
  /** Opponent hand counts (how many discs still in hand). */
  handCount: Record<PlayerId, number>;
  /** Own stack is revealed to the viewer; opponents only show length. */
  myStack: DiscKind[];
  stackCount: Record<PlayerId, number>;
  /**
   * During flipping, the first N of each stack are public (flipped face up).
   * Outside of flipping this is null.
   */
  flipped: SkullFlip[] | null;
  /** Flipped counts per stack — useful for layering face-up discs over face-down. */
  flippedFromStack: Record<PlayerId, number>;
  points: Record<PlayerId, number>;
  current: PlayerId;
  phase: SkullPhase;
  currentBid: { count: number; by: PlayerId } | null;
  passed: PlayerId[];
  challenger: PlayerId | null;
  nextStarter: PlayerId | null;
  lastResult: SkullRoundResult | null;
  winner: PlayerId | null;
}

// ------------------------- Config -------------------------

export type SkullConfig = Record<string, never>;

// ------------------------- Moves -------------------------

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("place"), disc: z.enum(["flower", "skull"]) }),
  z.object({ kind: z.literal("bid"), count: z.number().int().min(1) }),
  z.object({ kind: z.literal("pass") }),
  z.object({ kind: z.literal("flip"), target: z.string() }),
  z.object({ kind: z.literal("startNextRound") }),
]);
export type SkullMove = z.infer<typeof moveSchema>;

// ------------------------- Pure helpers -------------------------

export function totalDiscsOnTable(state: {
  hand: Record<PlayerId, SkullHand>;
  stacks: Record<PlayerId, DiscKind[]>;
  players: PlayerId[];
}): number {
  let n = 0;
  for (const id of state.players) {
    const h = state.hand[id];
    if (h) n += h.flowers + h.skulls;
    n += state.stacks[id]?.length ?? 0;
  }
  return n;
}

export function playerDiscCount(
  hand: SkullHand | undefined,
  stackLen: number,
): number {
  const h = hand ? hand.flowers + hand.skulls : 0;
  return h + stackLen;
}

export function isEliminated(
  hand: SkullHand | undefined,
  stackLen: number,
): boolean {
  return playerDiscCount(hand, stackLen) === 0;
}
