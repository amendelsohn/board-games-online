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
  /** Final tallies. Always present in every view (count info is public). */
  yesCount: number;
  noCount: number;
  /** Whether this nomination crossed the threshold (≥ half of living). */
  onTheBlock: boolean;
  /**
   * Identities of yes / no voters. ST-only: stripped from PlayerView and
   * SpectatorView so a future "private vote" mechanic doesn't silently
   * leak. Even for the public BotC vote, keeping identities ST-only
   * makes the redaction surface explicit.
   */
  yesVotes?: PlayerId[];
  noVotes?: PlayerId[];
}

export interface OpenVote {
  nominationId: string;
  /**
   * Per-player vote, keyed by PlayerId. Undefined = not yet voted.
   *
   * In the Storyteller view this is the full map. In the player view
   * it is redacted to the viewer's own entry (so a player can confirm
   * they voted but can't see who voted yes / no in real time and
   * fence-sit to the deciding ballot). Spectators get an empty map.
   *
   * The public `votedCount` below is the only running info exposed.
   */
  votes: Record<PlayerId, "yes" | "no">;
  /** How many seats have voted so far. Always public. */
  votedCount: number;
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
  /**
   * Inline characters from a custom script — their definitions live
   * in state so any viewer can resolve them. Empty for built-in
   * scripts. When an id appears here AND in ALL_CHARACTERS_BY_ID,
   * the inline definition wins (custom script can shadow built-ins).
   */
  customCharacters: Character[];
  /**
   * Table-wide play mode. Locked at match creation (doesn't change
   * between rematches at runtime — the ST picks it in the lobby).
   */
  playMode: BotCPlayMode;
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

/** Canonical script ids that ship with the package. */
export const BUILT_IN_SCRIPT_IDS = [
  "trouble-brewing",
  "bad-moon-rising",
  "sects-and-violets",
] as const;
export type BuiltInScriptId = (typeof BUILT_IN_SCRIPT_IDS)[number];

export const SCRIPT_LABELS: Readonly<Record<BuiltInScriptId, string>> = {
  "trouble-brewing": "Trouble Brewing",
  "bad-moon-rising": "Bad Moon Rising",
  "sects-and-violets": "Sects & Violets",
};

/**
 * Wire shape for a Character that came from a custom script's inline
 * definition. Server stores these alongside `characterIds` so the
 * grimoire can resolve them — they take precedence over the canonical
 * pool when their id collides.
 */
export const inlineCharacterSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  team: z.enum(["townsfolk", "outsider", "minion", "demon", "traveller", "fabled"]),
  edition: z.string().max(32).optional(),
  ability: z.string().min(1).max(500),
  firstNight: z.number().nullable().optional(),
  otherNights: z.number().nullable().optional(),
  reminders: z.array(z.string().max(48)).max(10).optional(),
  setup: z.boolean().optional(),
});
export type InlineCharacter = z.infer<typeof inlineCharacterSchema>;

/**
 * A custom script — the ST pasted a homebrew script JSON in the
 * lobby. `characterIds` is the ordered seat-pool. `inlineCharacters`
 * carries definitions for any homebrew character not in our shipped
 * editions; ids in `characterIds` resolve to the inline definition
 * first, then to the canonical pool.
 */
export const customScriptSchema = z.object({
  name: z.string().min(1).max(100),
  characterIds: z.array(z.string().min(1)).min(5).max(40),
  inlineCharacters: z.array(inlineCharacterSchema).max(40).optional(),
});
export type CustomScript = z.infer<typeof customScriptSchema>;

/**
 * How the table is being played.
 *   - "virtual": full app-driven nominations + spinning-hand vote.
 *   - "irl": ST tracks the grimoire on the app; nominations and votes
 *     happen in the physical room. Players see a stripped-down phone
 *     view (their character + private info only); ST gets per-seat
 *     execute buttons in the day panel.
 */
export type BotCPlayMode = "irl" | "virtual";

export const configSchema = z.object({
  /** Which canonical script to play. Ignored when customScript is set. */
  scriptId: z.enum(BUILT_IN_SCRIPT_IDS).default("trouble-brewing"),
  /**
   * If set, replaces scriptId — the ST pasted a homebrew script. The
   * character IDs are validated against ALL_CHARACTERS_BY_ID before
   * being accepted (unknown IDs reject the move).
   */
  customScript: customScriptSchema.optional(),
  /** App-driven (virtual) vs in-person (irl). Defaults to virtual. */
  playMode: z.enum(["irl", "virtual"]).default("virtual"),
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
      /**
       * Multi-character info — used for the Demon's first-night bluffs
       * (3 not-in-play characters they can claim) and similar
       * multi-character reveals.
       */
      characters: z.array(z.string()).max(10).optional(),
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
  z.object({
    kind: z.literal("st.addFabled"),
    fabledId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("st.removeFabled"),
    fabledId: z.string().min(1),
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
  customCharacters: Character[];
  playMode: BotCPlayMode;
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
  /**
   * Once the match ends, every player (and spectator) sees the full
   * grimoire — every seat's character, alive/dead status, etc. This is
   * the standard BotC closure ("here's how it actually played out");
   * null while the match is still in flight.
   */
  finalGrimoire: Record<PlayerId, SeatGrimoire> | null;
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
  customCharacters: Character[];
  playMode: BotCPlayMode;
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

// ============================================================================
// Character data + helpers (re-exported from ./characters/*)
// ============================================================================

export {
  TROUBLE_BREWING_CHARACTERS,
  TROUBLE_BREWING_BY_ID,
  TROUBLE_BREWING_IDS,
} from "./characters/trouble-brewing";

export {
  BAD_MOON_RISING_CHARACTERS,
  BAD_MOON_RISING_BY_ID,
  BAD_MOON_RISING_IDS,
} from "./characters/bad-moon-rising";

export {
  SECTS_AND_VIOLETS_CHARACTERS,
  SECTS_AND_VIOLETS_BY_ID,
  SECTS_AND_VIOLETS_IDS,
} from "./characters/sects-and-violets";

export {
  FABLED_CHARACTERS,
  FABLED_BY_ID,
  FABLED_IDS,
} from "./characters/fabled";

export {
  ALL_CHARACTERS_BY_ID,
  lookupCharacter,
} from "./characters/all";

export { tonightOrder, type NightStep } from "./characters/night-order";

export { parseScriptJson } from "./script-parser";

// ============================================================================
// Trouble Brewing setup distribution
// ============================================================================

/**
 * Recommended character-type counts for each player count, per the official
 * Trouble Brewing rules: [Townsfolk, Outsider, Minion, Demon].
 *
 * The Baron special-cases this by adding 2 Outsiders (and removing 2
 * Townsfolk); the auto-assigner adjusts when Baron is in the picked set.
 */
export const TB_DISTRIBUTION: Readonly<
  Record<number, readonly [number, number, number, number]>
> = {
  5: [3, 0, 1, 1],
  6: [3, 1, 1, 1],
  7: [5, 0, 1, 1],
  8: [5, 1, 1, 1],
  9: [5, 2, 1, 1],
  10: [7, 0, 2, 1],
  11: [7, 1, 2, 1],
  12: [7, 2, 2, 1],
  13: [9, 0, 3, 1],
  14: [9, 1, 3, 1],
  15: [9, 2, 3, 1],
};
