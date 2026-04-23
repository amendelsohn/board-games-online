import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const BOTC_TYPE = "blood-on-the-clocktower";

// ============================================================================
// Characters
// ============================================================================

export type CharacterTeam =
  | "townsfolk"
  | "outsider"
  | "minion"
  | "demon"
  | "traveller"
  | "fabled";

export type CharacterEdition = "tb" | "bmr" | "snv" | "custom";

/**
 * Static metadata about a BotC character. The Storyteller adjudicates the
 * actual ability — this record only describes it for display and night-order
 * scheduling.
 */
export interface Character {
  id: string;
  name: string;
  team: CharacterTeam;
  edition: CharacterEdition;
  /** Ability text, rendered verbatim. */
  ability: string;
  /** Wake order on the first night. null = doesn't wake. */
  firstNight: number | null;
  /** Wake order on each subsequent night. null = doesn't wake. */
  otherNights: number | null;
  /** Reminder-token labels associated with this character (e.g. ["Drunk"]). */
  reminders: string[];
  /** True if this character changes the setup (Baron adds outsiders, etc.). */
  setup: boolean;
}

// ============================================================================
// Game state
// ============================================================================

/**
 * Setup → firstNight → day → night → day → ... → finished.
 * The "setup" phase exists between createInitialState and the first night so
 * the Storyteller can assign characters before anything game-affecting runs.
 */
export type BotCPhase =
  | "setup"
  | "firstNight"
  | "day"
  | "night"
  | "finished";

/**
 * Per-seat data the Storyteller can see in the Grimoire. Players never see
 * any of this for other seats; for their own seat they only see their
 * characterId (and only because they were told it at setup).
 */
export interface SeatGrimoire {
  characterId: string | null;
  isAlive: boolean;
  isPoisoned: boolean;
  isDrunk: boolean;
  /** Reminder tokens placed on this seat, e.g. "Red Herring", "Poisoned". */
  reminders: ReminderToken[];
  /** True once a dead player has used their one ghost vote. */
  ghostVoteUsed: boolean;
}

export interface ReminderToken {
  id: string;
  label: string;
  /** Optional source character id (so the UI can show the right colour). */
  characterId?: string;
}

export interface Nomination {
  id: string;
  nominator: PlayerId;
  nominee: PlayerId;
  /** Wall-clock when the nomination opened. */
  openedAt: number;
  /** Tally once the vote closes; null while voting is still open. */
  result: NominationResult | null;
}

export interface NominationResult {
  yesVotes: PlayerId[];
  noVotes: PlayerId[];
  /** Whether this nomination crossed the threshold (≥ half of living). */
  onTheBlock: boolean;
}

export interface OpenVote {
  nominationId: string;
  /** Per-player vote, keyed by PlayerId. Undefined = not yet voted. */
  votes: Record<PlayerId, "yes" | "no">;
}

export interface ExecutionRecord {
  dayNumber: number;
  /** null = no one was executed (no nomination passed, or ST skipped). */
  executed: PlayerId | null;
  reason: "vote" | "st-decision";
}

/**
 * Authoritative server state. The `grimoire` field is stripped in player /
 * spectator views — only the Storyteller sees it. Public seat info (alive /
 * dead / ghost vote) is duplicated into `seats[]` for player consumption.
 */
export interface BotCState {
  scriptId: string;
  scriptCharacterIds: string[];
  storytellerId: PlayerId;
  /** Seats clockwise around the town square. */
  seatOrder: PlayerId[];
  phase: BotCPhase;
  /** 0 during firstNight, 1 during the first day, 2 during the second night, etc. */
  dayNumber: number;
  /** Index into the night order (0 = first character of tonight). */
  nightStep: number;
  nominations: Nomination[];
  openVote: OpenVote | null;
  executions: ExecutionRecord[];
  /** Global reminder tokens (Fabled etc.). */
  fabled: string[];
  /** Public per-seat data, indexed by PlayerId. */
  seats: Record<PlayerId, SeatPublic>;
  /** ST-only per-seat data; never leaves the server raw. */
  grimoire: Record<PlayerId, SeatGrimoire>;
  /** Set when the match ends. */
  winner: "good" | "evil" | null;
  endReason: string | null;
}

/** What a seat looks like to anyone (player, spectator). */
export interface SeatPublic {
  isAlive: boolean;
  ghostVoteUsed: boolean;
}

// ============================================================================
// Config
// ============================================================================

export const configSchema = z.object({
  /**
   * Which script to play. v1 ships only "trouble-brewing"; later phases will
   * accept "bad-moon-rising", "sects-and-violets", or a custom script id.
   */
  scriptId: z.literal("trouble-brewing").default("trouble-brewing"),
});
export type BotCConfig = z.infer<typeof configSchema>;

// ============================================================================
// Moves
// ============================================================================

const playerIdField = z.string().min(1);

/**
 * Storyteller moves. Every one is gated on `actor === state.storytellerId`
 * in the server. Schema validation only checks the shape; permission is
 * enforced in handleMove.
 */
const stMoveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("st.assignCharacters"),
    /** Map from PlayerId to characterId. Must cover every seat exactly once. */
    assignments: z.record(playerIdField, z.string().min(1)),
  }),
  z.object({
    kind: z.literal("st.setSeatOrder"),
    order: z.array(playerIdField).min(1),
  }),
  z.object({
    kind: z.literal("st.setAlive"),
    seatId: playerIdField,
    alive: z.boolean(),
  }),
  z.object({
    kind: z.literal("st.setPoisoned"),
    seatId: playerIdField,
    poisoned: z.boolean(),
  }),
  z.object({
    kind: z.literal("st.setDrunk"),
    seatId: playerIdField,
    drunk: z.boolean(),
  }),
  z.object({
    kind: z.literal("st.addReminder"),
    seatId: playerIdField,
    label: z.string().min(1).max(48),
    characterId: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal("st.removeReminder"),
    seatId: playerIdField,
    reminderId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("st.advancePhase"),
  }),
  z.object({
    kind: z.literal("st.setNightStep"),
    index: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("st.sendInfo"),
    targetPlayerId: playerIdField,
    info: z.object({
      text: z.string().max(500).optional(),
      seats: z.array(playerIdField).optional(),
      character: z.string().optional(),
      yesNo: z.boolean().optional(),
      number: z.number().int().nonnegative().optional(),
    }),
  }),
  z.object({
    kind: z.literal("st.openNomination"),
    nominator: playerIdField,
    nominee: playerIdField,
  }),
  z.object({
    kind: z.literal("st.closeVote"),
  }),
  z.object({
    kind: z.literal("st.executeNominee"),
    nomineeId: playerIdField,
  }),
  z.object({
    kind: z.literal("st.skipExecution"),
  }),
  z.object({
    kind: z.literal("st.endMatch"),
    winner: z.enum(["good", "evil"]),
    reason: z.string().min(1).max(120),
  }),
]);

const playerMoveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("p.nominate"),
    nominee: playerIdField,
  }),
  z.object({
    kind: z.literal("p.castVote"),
    nominationId: z.string().min(1),
    vote: z.enum(["yes", "no"]),
  }),
  z.object({
    kind: z.literal("p.acknowledgeWake"),
  }),
]);

export const moveSchema = z.union([stMoveSchema, playerMoveSchema]);
export type BotCMove = z.infer<typeof moveSchema>;

// ============================================================================
// View shapes
// ============================================================================

/**
 * What the Storyteller sees: the entire authoritative state, including the
 * full Grimoire. Equivalent to `BotCState` modulo the discriminator field.
 */
export interface StorytellerView {
  viewer: "storyteller";
  state: BotCState;
}

/** What a seated player sees. */
export interface PlayerView {
  viewer: "player";
  scriptId: string;
  scriptCharacterIds: string[];
  storytellerId: PlayerId;
  seatOrder: PlayerId[];
  phase: BotCPhase;
  dayNumber: number;
  nominations: Nomination[];
  openVote: OpenVote | null;
  executions: ExecutionRecord[];
  fabled: string[];
  seats: Record<PlayerId, SeatPublic>;
  /** This viewer's own seat; null while in setup or for unseated viewers. */
  me: PlayerSelf | null;
  winner: "good" | "evil" | null;
  endReason: string | null;
}

export interface PlayerSelf {
  seatId: PlayerId;
  /** The character the ST has assigned to me (only set once setup is done). */
  characterId: string | null;
  isAlive: boolean;
  ghostVoteUsed: boolean;
}

export interface SpectatorView {
  viewer: "spectator";
  scriptId: string;
  scriptCharacterIds: string[];
  storytellerId: PlayerId;
  seatOrder: PlayerId[];
  phase: BotCPhase;
  dayNumber: number;
  nominations: Nomination[];
  openVote: OpenVote | null;
  executions: ExecutionRecord[];
  fabled: string[];
  seats: Record<PlayerId, SeatPublic>;
  /**
   * Once the match ends, the full grimoire is revealed for the post-mortem.
   * null while play is ongoing.
   */
  finalGrimoire: Record<PlayerId, SeatGrimoire> | null;
  winner: "good" | "evil" | null;
  endReason: string | null;
}

export type BotCView = StorytellerView | PlayerView | SpectatorView;
