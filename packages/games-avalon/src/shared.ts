import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const AVALON_TYPE = "avalon";

export type AvalonTeam = "loyal" | "spies";
export type AvalonRole = "loyal" | "merlin" | "spy";
export type AvalonPhase =
  | "proposal"
  | "vote"
  | "quest"
  | "merlinGuess"
  | "gameOver";
export type AvalonVote = "approve" | "reject";
export type AvalonQuestVote = "success" | "fail";
export type AvalonQuestResult = "success" | "failure";
export type AvalonWinReason =
  | "loyalQuests"
  | "spyQuests"
  | "hammerReject"
  | "merlinCaught"
  | "merlinSaved";

/** Spies per total-player count. Everyone else is loyal (one of whom is Merlin). */
export const SPY_COUNT: Record<number, number> = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4,
};

/** Quest team sizes, indexed by player count and quest index (0..4). */
export const QUEST_SIZES: Record<number, readonly [number, number, number, number, number]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 5],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

/** Maximum consecutive rejected proposals before the spies win by deadlock. */
export const MAX_REJECTIONS = 5;

/** For 7+ player games, quest index 3 (the 4th quest) needs two fails to fail. */
export function failsNeeded(playerCount: number, questIdx: number): number {
  if (playerCount >= 7 && questIdx === 3) return 2;
  return 1;
}

export interface AvalonState {
  /** Seating order; leader rotation follows this list. */
  playerOrder: PlayerId[];
  /** True role of every player. */
  roles: Record<PlayerId, AvalonRole>;
  /** Index into playerOrder of the current proposer. */
  leaderIdx: number;
  /** Which quest is being run now (0..4). */
  questIdx: number;
  /** Five quest slots; filled as quests resolve. */
  questResults: Array<AvalonQuestResult | null>;
  /** 1..5 — the nth proposal of the current quest. On 5 consecutive rejections spies win. */
  proposalNumber: number;
  /** Team proposed by the current leader. Null until a proposal exists. */
  proposedTeam: PlayerId[] | null;
  /** approve/reject vote per player for the current proposal; null = hasn't voted. */
  votes: Record<PlayerId, AvalonVote | null>;
  /** success/fail per selected team member on the active quest; null = hasn't submitted. */
  questVotes: Record<PlayerId, AvalonQuestVote | null>;
  phase: AvalonPhase;
  winner: AvalonTeam | null;
  winReason: AvalonWinReason | null;
  /** Which player the designated spy accused as Merlin (only set if merlinGuess resolved). */
  merlinGuess: PlayerId | null;
}

/** A proposal vote projection that hides individual votes until everyone has voted. */
export interface AvalonVoteTally {
  /** Who has voted (ids only) — useful for "who's still thinking" UI. */
  voters: PlayerId[];
  /** Null while voting is in progress, keyed by player once everyone has voted. */
  results: Record<PlayerId, AvalonVote> | null;
}

/** Completed quest results exposed in views (aggregate only — never per-player). */
export interface AvalonQuestHistoryEntry {
  result: AvalonQuestResult;
  teamSize: number;
  failsNeeded: number;
  /** Number of fails reported (only populated if the quest actually ran). */
  fails: number | null;
}

export interface AvalonView {
  phase: AvalonPhase;
  playerOrder: PlayerId[];
  /** Index of the current leader in playerOrder. */
  leaderIdx: number;
  leader: PlayerId;
  questIdx: number;
  /** Required team size for the active quest. */
  currentQuestSize: number;
  /** Fails required to fail the active quest (1, or 2 on quest 4 for 7+ players). */
  currentQuestFailsNeeded: number;
  questResults: Array<AvalonQuestResult | null>;
  /** Team sizes for each of the 5 quests, for the badges at the top. */
  questSizes: [number, number, number, number, number];
  /** fails-needed for each of the 5 quests. */
  questFailsNeeded: [number, number, number, number, number];
  proposalNumber: number;
  proposedTeam: PlayerId[] | null;
  /** Proposal votes — hidden until everyone has voted, then fully revealed. */
  voteTally: AvalonVoteTally;
  /** How many team members have turned in their quest card (count only). */
  questSubmissions: number;
  /** The viewer's own role, when viewer is a player. */
  viewerRole: AvalonRole | null;
  /** Other spies known to the viewer (Merlin and spies see this list; everyone else []). */
  knownSpies: PlayerId[];
  /** True iff the viewer is the designated spy who must submit the Merlin guess. */
  viewerIsMerlinGuesser: boolean;
  /** Revealed at game end: all roles for the post-mortem. */
  allRoles: Record<PlayerId, AvalonRole> | null;
  /** Spies' accusation once the merlinGuess phase resolves. */
  merlinGuess: PlayerId | null;
  winner: AvalonTeam | null;
  winReason: AvalonWinReason | null;
}

// ------------------------- Config -------------------------

/** No lobby-time config for v1 — roles and seating are assigned automatically. */
export type AvalonConfig = Record<string, never>;

// ------------------------- Moves -------------------------

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("proposeTeam"),
    team: z.array(z.string().min(1)).min(1).max(10),
  }),
  z.object({
    kind: z.literal("vote"),
    vote: z.enum(["approve", "reject"]),
  }),
  z.object({
    kind: z.literal("questVote"),
    vote: z.enum(["success", "fail"]),
  }),
  z.object({
    kind: z.literal("accuseMerlin"),
    target: z.string().min(1),
  }),
]);
export type AvalonMove = z.infer<typeof moveSchema>;
