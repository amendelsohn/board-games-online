import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const SPYFALL_TYPE = "spyfall";

/** Default clock is 8 minutes — classic Spyfall. */
export const DEFAULT_ROUND_SECONDS = 8 * 60;
export const MIN_ROUND_SECONDS = 2 * 60;
export const MAX_ROUND_SECONDS = 15 * 60;

export const TIMER_KEY_ROUND = "round";

export type SpyfallPhase = "playing" | "voting" | "gameOver";
export type SpyfallWinner = "spy" | "nonSpies";
export type SpyfallWinReason =
  | "timeUp"
  | "spyGuessedRight"
  | "spyGuessedWrong"
  | "accusedSpy"
  | "accusedNonSpy";

export interface SpyfallAccusation {
  accuser: PlayerId;
  target: PlayerId;
  /** Votes by non-target players (the target doesn't vote on themselves). */
  votes: Record<PlayerId, boolean>;
}

export interface SpyfallState {
  /** Authoritative location. Hidden from the spy. */
  location: string;
  /** Full list of possible locations, visible to everyone (spy uses it to guess). */
  locationPool: string[];
  /** Role at the location for each non-spy player. Hidden from others. */
  roles: Record<PlayerId, string>;
  /** The spy's player id. Hidden from everyone except the spy. */
  spyId: PlayerId;
  /** Turn order — first questioner is the player at index 0, informational only. */
  order: PlayerId[];
  phase: SpyfallPhase;
  startedAt: number;
  endsAt: number;
  accusation: SpyfallAccusation | null;
  spyGuess: string | null;
  winner: SpyfallWinner | null;
  winReason: SpyfallWinReason | null;
}

// ------------------------- Per-player view -------------------------

export interface SpyfallAccusationView {
  accuser: PlayerId;
  target: PlayerId;
  approvals: number;
  rejections: number;
  /** Player ids that still need to vote (excludes target; accuser already approves implicitly). */
  pending: PlayerId[];
  /** True iff the viewer still needs to cast a vote. */
  viewerMustVote: boolean;
}

export interface SpyfallViewer {
  isSpy: boolean;
  /** Role at the location — set for non-spy players while in progress, set for all on terminal. */
  role: string | null;
  /** Location — null for spy while in progress; revealed for all on terminal. */
  location: string | null;
}

export interface SpyfallView {
  phase: SpyfallPhase;
  endsAt: number;
  order: PlayerId[];
  /** Full pool of possible locations. */
  locationPool: string[];
  accusation: SpyfallAccusationView | null;
  viewer: SpyfallViewer;
  /** Revealed on terminal, otherwise null. */
  spyId: PlayerId | null;
  location: string | null;
  allRoles: Record<PlayerId, string> | null;
  winner: SpyfallWinner | null;
  winReason: SpyfallWinReason | null;
  spyGuess: string | null;
}

// ------------------------- Config -------------------------

export const configSchema = z.object({
  roundSeconds: z
    .number()
    .int()
    .min(MIN_ROUND_SECONDS)
    .max(MAX_ROUND_SECONDS)
    .default(DEFAULT_ROUND_SECONDS),
});
export type SpyfallConfig = z.infer<typeof configSchema>;

// ------------------------- Moves -------------------------

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("accuse"),
    target: z.string().min(1),
  }),
  z.object({
    kind: z.literal("vote"),
    approve: z.boolean(),
  }),
  z.object({
    kind: z.literal("cancelAccusation"),
  }),
  z.object({
    kind: z.literal("spyGuess"),
    location: z.string().min(1),
  }),
]);
export type SpyfallMove = z.infer<typeof moveSchema>;

// ------------------------- Location data -------------------------

export interface SpyfallLocation {
  name: string;
  roles: string[];
}
