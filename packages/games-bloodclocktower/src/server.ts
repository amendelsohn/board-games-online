import type {
  GameContext,
  GameModule,
  MoveResult,
  Outcome,
  PhaseId,
  Player,
  PlayerId,
  Viewer,
} from "@bgo/sdk";
import {
  BOTC_TYPE,
  TROUBLE_BREWING_IDS,
  configSchema,
  moveSchema,
  type BotCConfig,
  type BotCMove,
  type BotCState,
  type BotCView,
  type PlayerView,
  type SpectatorView,
  type StorytellerView,
} from "./shared";

/**
 * Resolve the character pool for a script id. Phase 1 ships only Trouble
 * Brewing; later phases will branch on BMR / S&V / custom-script ids.
 */
function scriptIdsFor(scriptId: string): string[] {
  switch (scriptId) {
    case "trouble-brewing":
      return [...TROUBLE_BREWING_IDS];
    default:
      // Defensive: defaultConfig + Zod validation ensure this branch is
      // unreachable for now, but throwing makes a future typo loud.
      throw new Error(`Unknown BotC script: ${scriptId}`);
  }
}

/**
 * Minimal player-public view of a seat. Public seat info (alive/dead/ghost
 * vote) is the same for every viewer — we duplicate it from the grimoire
 * here so player views never have to reach into ST-only data.
 */
function emptyState(
  storytellerId: PlayerId,
  players: Player[],
  scriptId: string,
): BotCState {
  const seatOrder = players.map((p) => p.id);
  const seats: BotCState["seats"] = {};
  const grimoire: BotCState["grimoire"] = {};
  for (const id of seatOrder) {
    seats[id] = { isAlive: true, ghostVoteUsed: false };
    grimoire[id] = {
      characterId: null,
      isAlive: true,
      isPoisoned: false,
      isDrunk: false,
      reminders: [],
      ghostVoteUsed: false,
    };
  }
  return {
    scriptId,
    scriptCharacterIds: scriptIdsFor(scriptId),
    storytellerId,
    seatOrder,
    phase: "setup",
    dayNumber: 0,
    nightStep: 0,
    nominations: [],
    openVote: null,
    executions: [],
    fabled: [],
    seats,
    grimoire,
    winner: null,
    endReason: null,
  };
}

/**
 * Build the player-facing view for one viewer. The viewer learns nothing
 * about other seats' characters or status flags (poison/drunk) — those only
 * appear in the storyteller view.
 */
function makePlayerView(state: BotCState, viewer: PlayerId): PlayerView {
  const seat = state.grimoire[viewer];
  const me = seat
    ? {
        seatId: viewer,
        characterId: seat.characterId,
        isAlive: seat.isAlive,
        ghostVoteUsed: seat.ghostVoteUsed,
      }
    : null;
  return {
    viewer: "player",
    scriptId: state.scriptId,
    scriptCharacterIds: [...state.scriptCharacterIds],
    storytellerId: state.storytellerId,
    seatOrder: [...state.seatOrder],
    phase: state.phase,
    dayNumber: state.dayNumber,
    nominations: state.nominations.map((n) => ({ ...n })),
    openVote: state.openVote ? { ...state.openVote, votes: { ...state.openVote.votes } } : null,
    executions: state.executions.map((e) => ({ ...e })),
    fabled: [...state.fabled],
    seats: { ...state.seats },
    me,
    winner: state.winner,
    endReason: state.endReason,
  };
}

function makeSpectatorView(state: BotCState): SpectatorView {
  const finalGrimoire =
    state.phase === "finished" ? { ...state.grimoire } : null;
  return {
    viewer: "spectator",
    scriptId: state.scriptId,
    scriptCharacterIds: [...state.scriptCharacterIds],
    storytellerId: state.storytellerId,
    seatOrder: [...state.seatOrder],
    phase: state.phase,
    dayNumber: state.dayNumber,
    nominations: state.nominations.map((n) => ({ ...n })),
    openVote: state.openVote ? { ...state.openVote, votes: { ...state.openVote.votes } } : null,
    executions: state.executions.map((e) => ({ ...e })),
    fabled: [...state.fabled],
    seats: { ...state.seats },
    finalGrimoire,
    winner: state.winner,
    endReason: state.endReason,
  };
}

function makeStorytellerView(state: BotCState): StorytellerView {
  return { viewer: "storyteller", state };
}

export const bloodClocktowerServerModule: GameModule<
  BotCState,
  BotCMove,
  BotCConfig,
  BotCView
> = {
  type: BOTC_TYPE,
  displayName: "Blood on the Clocktower",
  description:
    "A bluffing town game for 5–15 players. One person is the Storyteller — they run the game, distribute roles, and adjudicate every ability. Bring voice chat.",
  category: "party",
  // Player counts. The Storyteller is a 16th, separate person — see hostSeated.
  minPlayers: 5,
  maxPlayers: 15,
  hostSeated: false,

  defaultConfig(): BotCConfig {
    return { scriptId: "trouble-brewing" };
  },

  validateConfig(cfg: unknown): BotCConfig {
    return configSchema.parse(cfg);
  },

  createInitialState(
    players: Player[],
    cfg: BotCConfig,
    ctx: GameContext,
  ): BotCState {
    if (!ctx.storytellerId) {
      throw new Error(
        "Blood on the Clocktower requires a non-playing Storyteller (table.hostIsPlayer === false)",
      );
    }
    return emptyState(ctx.storytellerId, players, cfg.scriptId);
  },

  handleMove(
    _state: BotCState,
    move: unknown,
    _actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<BotCState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) {
      return { ok: false, reason: parsed.error.message };
    }
    // All moves are stubbed in this skeleton commit. The next commits wire up
    // setup → night → day → execution flows. Returning a clear rejection
    // here keeps the framework happy and surfaces the "not yet" state in
    // the UI without crashing.
    return {
      ok: false,
      reason: `Move "${parsed.data.kind}" is not yet implemented`,
    };
  },

  view(state: BotCState, viewer: Viewer): BotCView {
    if (viewer === "spectator") return makeSpectatorView(state);
    return makePlayerView(state, viewer);
  },

  storytellerView(state: BotCState): BotCView {
    return makeStorytellerView(state);
  },

  phase(state: BotCState): PhaseId {
    return state.phase;
  },

  currentActors(state: BotCState): PlayerId[] {
    // The Storyteller drives everything in the digital-grimoire model;
    // players act only when they need to nominate or vote. Returning an
    // empty array keeps the "your turn" indicator off for everyone, which
    // is the right default since play is voice-driven.
    if (state.phase === "day" && state.openVote) {
      // Players who haven't voted yet on the open nomination are "on the
      // clock" — surface them as currentActors so the UI can highlight.
      const voted = new Set(Object.keys(state.openVote.votes));
      return state.seatOrder.filter(
        (id) => !voted.has(id) && state.grimoire[id]?.isAlive,
      );
    }
    return [];
  },

  isTerminal(state: BotCState): boolean {
    return state.phase === "finished";
  },

  outcome(state: BotCState): Outcome | null {
    if (state.phase !== "finished" || state.winner === null) return null;
    return {
      kind: "team",
      winningTeam: state.winner,
      losingTeams: [state.winner === "good" ? "evil" : "good"],
    };
  },
};

export { BOTC_TYPE } from "./shared";
