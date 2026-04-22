import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const THROWS = ["rock", "paper", "scissors", "lizard", "spock"] as const;
export type Throw = (typeof THROWS)[number];

export const WINS_TO_CLINCH = 3;

export type RpsPhase = "choosing" | "gameOver";

export interface RpsRoundRecord {
  throws: Record<PlayerId, Throw>;
  winner: PlayerId | null;
}

export interface RpsState {
  order: readonly PlayerId[];
  scores: Record<PlayerId, number>;
  currentThrows: Record<PlayerId, Throw | null>;
  round: number;
  roundHistory: RpsRoundRecord[];
  phase: RpsPhase;
  winner: PlayerId | null;
}

export interface RpsView {
  order: PlayerId[];
  scores: Record<PlayerId, number>;
  /** Who has submitted for the current (unresolved) round — no throw values. */
  submitted: Record<PlayerId, boolean>;
  /** Only populated for the viewer themselves, never opponents. */
  myThrow: Throw | null;
  round: number;
  roundHistory: RpsRoundRecord[];
  phase: RpsPhase;
  winner: PlayerId | null;
  winsToClinch: number;
}

export const throwSchema = z.enum(THROWS);

export const moveSchema = z.object({
  kind: z.literal("throw"),
  throw: throwSchema,
});
export type RpsMove = z.infer<typeof moveSchema>;

export type RpsConfig = Record<string, never>;

export const RPS_TYPE = "rps";

/**
 * Each throw beats exactly two others (Sam Kass / Big Bang Theory extension).
 * rock: crushes scissors + lizard
 * paper: covers rock + disproves spock
 * scissors: cuts paper + decapitates lizard
 * lizard: poisons spock + eats paper
 * spock: smashes scissors + vaporizes rock
 */
export const BEATS: Record<Throw, readonly Throw[]> = {
  rock: ["scissors", "lizard"],
  paper: ["rock", "spock"],
  scissors: ["paper", "lizard"],
  lizard: ["spock", "paper"],
  spock: ["scissors", "rock"],
};

/** null = tie, otherwise the winning throw. */
export function resolvePair(a: Throw, b: Throw): Throw | null {
  if (a === b) return null;
  if (BEATS[a].includes(b)) return a;
  return b;
}
