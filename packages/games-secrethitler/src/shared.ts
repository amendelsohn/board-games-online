import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const SECRET_HITLER_TYPE = "secret-hitler";

export type SHRole = "liberal" | "fascist" | "hitler";
export type SHTeam = "liberals" | "fascists";
export type SHPolicy = "liberal" | "fascist";
export type SHVote = "ja" | "nein";

export type SHPhase =
  | "nomination"
  | "vote"
  | "presidentDiscard"
  | "chancellorEnact"
  | "gameOver";

export type SHWinReason =
  | "liberalTrack"
  | "fascistTrack"
  | "hitlerChancellor";

/** Role counts by total player count. */
export const ROLE_COUNTS: Record<
  number,
  { liberals: number; fascists: number }
> = {
  5: { liberals: 3, fascists: 1 },
  6: { liberals: 4, fascists: 1 },
  7: { liberals: 4, fascists: 2 },
  8: { liberals: 5, fascists: 2 },
  9: { liberals: 5, fascists: 3 },
  10: { liberals: 6, fascists: 3 },
};

/** Policy deck composition — 6 Liberal + 11 Fascist = 17. */
export const DECK_LIBERAL = 6;
export const DECK_FASCIST = 11;

export const LIBERAL_TRACK_WIN = 5;
export const FASCIST_TRACK_WIN = 6;

/** Three failed elections in a row trigger chaos (auto-enact top policy). */
export const ELECTION_TRACKER_MAX = 3;

/** Number of Fascist policies after which electing Hitler Chancellor wins for fascists. */
export const HITLER_CHANCELLOR_DANGER = 3;

/**
 * In 5/6 player games Hitler knows the fascists; in 7+ Hitler is in the dark
 * (fascists still know each other and Hitler).
 */
export function hitlerKnowsFascists(playerCount: number): boolean {
  return playerCount <= 6;
}

// ------------------------- State -------------------------

export interface SHState {
  playerOrder: PlayerId[];
  roles: Record<PlayerId, SHRole>;
  /** Index into playerOrder of the next president (rotates after each round). */
  presidentIdx: number;
  /** Set to the current president's id while a round is in progress. */
  president: PlayerId | null;
  /** Chancellor nominee during vote phase, then the elected chancellor until the session ends. */
  chancellor: PlayerId | null;
  /** President who held office last successful election (for term limits). */
  lastPresident: PlayerId | null;
  /** Chancellor who held office last successful election (for term limits). */
  lastChancellor: PlayerId | null;
  phase: SHPhase;
  /** Per-player Ja/Nein — nulls until a player has voted. */
  votes: Record<PlayerId, SHVote | null>;
  /** Snapshot of the last revealed vote (kept for the UI between rounds). */
  lastVotes: Record<PlayerId, SHVote> | null;
  policyDeck: SHPolicy[];
  policyDiscard: SHPolicy[];
  /** President's 3-card hand during presidentDiscard, otherwise empty. */
  presidentHand: SHPolicy[];
  /** Chancellor's 2-card hand during chancellorEnact, otherwise empty. */
  chancellorHand: SHPolicy[];
  /** Number of Liberal policies enacted (0..5). */
  liberalTrack: number;
  /** Number of Fascist policies enacted (0..6). */
  fascistTrack: number;
  /** Failed-election counter, 0..2. Reset on successful election or chaos. */
  electionTracker: number;
  /** Chronological list of enacted policies for the UI history strip. */
  policyHistory: SHPolicy[];
  winner: SHTeam | null;
  winReason: SHWinReason | null;
}

// ------------------------- View -------------------------

export interface SHVoteTally {
  /** Who has cast a vote (for the "still thinking" indicator). */
  voters: PlayerId[];
  /** Null while voting is live; populated once everyone has voted. */
  results: Record<PlayerId, SHVote> | null;
}

export interface SHView {
  phase: SHPhase;
  playerOrder: PlayerId[];
  presidentIdx: number;
  president: PlayerId | null;
  chancellor: PlayerId | null;
  lastPresident: PlayerId | null;
  lastChancellor: PlayerId | null;
  liberalTrack: number;
  fascistTrack: number;
  electionTracker: number;
  policyHistory: SHPolicy[];
  deckSize: number;
  discardSize: number;
  /** Vote tally — hidden until everyone has voted (then revealed for everyone). */
  voteTally: SHVoteTally;
  /** Most recent completed vote, stored between rounds for post-mortem. */
  lastVotes: Record<PlayerId, SHVote> | null;
  /** The viewer's own role. Null for spectators until game over. */
  viewerRole: SHRole | null;
  /** Other players whose identity the viewer knows (fascist team only). */
  knownFascists: Record<PlayerId, SHRole> | null;
  /** President's drawn 3 cards — visible ONLY to the president during presidentDiscard. */
  presidentHand: SHPolicy[] | null;
  /** Chancellor's 2 cards — visible ONLY to the chancellor during chancellorEnact. */
  chancellorHand: SHPolicy[] | null;
  /** Eligible chancellor nominees (for the president's nomination UI). */
  eligibleChancellors: PlayerId[];
  winner: SHTeam | null;
  winReason: SHWinReason | null;
  /** All roles, revealed on game over. */
  allRoles: Record<PlayerId, SHRole> | null;
}

// ------------------------- Config -------------------------

export type SHConfig = Record<string, never>;

// ------------------------- Moves -------------------------

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("nominate"),
    target: z.string().min(1),
  }),
  z.object({
    kind: z.literal("vote"),
    vote: z.enum(["ja", "nein"]),
  }),
  z.object({
    kind: z.literal("presidentDiscard"),
    index: z.number().int().min(0).max(2),
  }),
  z.object({
    kind: z.literal("chancellorEnact"),
    index: z.number().int().min(0).max(1),
  }),
]);
export type SHMove = z.infer<typeof moveSchema>;
