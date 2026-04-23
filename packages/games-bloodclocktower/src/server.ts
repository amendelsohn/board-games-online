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
  type ReminderToken,
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

// ============================================================================
// Move handlers
// ============================================================================

/**
 * ST assigns one character per seat. Setup phase only — once we leave
 * setup the assignments are locked. Validates that every seat is covered
 * exactly once and every chosen character is in the active script.
 *
 * The Drunk is a deliberate exception elsewhere in BotC (the player
 * thinks they're a Townsfolk), but at the framework level we still
 * record their actual character as "drunk"; what they're TOLD they are
 * is a separate ST decision (sent via st.sendInfo).
 */
function handleAssignCharacters(
  state: BotCState,
  assignments: Record<PlayerId, string>,
): MoveResult<BotCState> {
  if (state.phase !== "setup") {
    return {
      ok: false,
      reason: "Characters can only be assigned during setup",
    };
  }
  const seatSet = new Set(state.seatOrder);
  const targetSet = new Set(Object.keys(assignments));
  for (const seat of seatSet) {
    if (!targetSet.has(seat)) {
      return {
        ok: false,
        reason: `Seat ${seat} has no assigned character`,
      };
    }
  }
  for (const seat of targetSet) {
    if (!seatSet.has(seat)) {
      return {
        ok: false,
        reason: `Assigned character to non-seat: ${seat}`,
      };
    }
  }
  const scriptSet = new Set(state.scriptCharacterIds);
  for (const characterId of Object.values(assignments)) {
    if (!scriptSet.has(characterId)) {
      return {
        ok: false,
        reason: `Character "${characterId}" is not in the active script`,
      };
    }
  }
  // BotC characters appear at most once per game (with rare exceptions
  // not in TB). Reject duplicates so the ST notices.
  const seenCharacters = new Set<string>();
  for (const characterId of Object.values(assignments)) {
    if (seenCharacters.has(characterId)) {
      return {
        ok: false,
        reason: `Character "${characterId}" assigned to more than one seat`,
      };
    }
    seenCharacters.add(characterId);
  }

  const grimoire: BotCState["grimoire"] = { ...state.grimoire };
  for (const [seatId, characterId] of Object.entries(assignments)) {
    grimoire[seatId] = {
      ...grimoire[seatId]!,
      characterId,
    };
  }
  return { ok: true, state: { ...state, grimoire } };
}

/**
 * ST may rearrange seats clockwise during setup. The order matters for
 * Empath / Chef / Butler-style abilities, so the ST gets to set the
 * physical seating before the game starts.
 */
function handleSetSeatOrder(
  state: BotCState,
  order: PlayerId[],
): MoveResult<BotCState> {
  if (state.phase !== "setup") {
    return {
      ok: false,
      reason: "Seat order can only be changed during setup",
    };
  }
  if (order.length !== state.seatOrder.length) {
    return {
      ok: false,
      reason: `Expected ${state.seatOrder.length} seats in order, got ${order.length}`,
    };
  }
  const have = new Set(state.seatOrder);
  for (const id of order) {
    if (!have.has(id)) {
      return { ok: false, reason: `Unknown seat in order: ${id}` };
    }
  }
  if (new Set(order).size !== order.length) {
    return { ok: false, reason: "Seat order contains duplicates" };
  }
  return { ok: true, state: { ...state, seatOrder: [...order] } };
}

/**
 * Phase progression:
 *   setup → firstNight → day(1) → night(1) → day(2) → night(2) → …
 * Only the ST advances the phase; players never can. Transitions clear
 * any phase-bound state (open vote, current-day nominations).
 *
 * Going from setup → firstNight requires every seat to have a character
 * (anything else and the ST would be entering night with empty roles).
 */
function handleAdvancePhase(state: BotCState): MoveResult<BotCState> {
  switch (state.phase) {
    case "setup": {
      for (const seatId of state.seatOrder) {
        if (!state.grimoire[seatId]?.characterId) {
          return {
            ok: false,
            reason: "All seats must have a character before starting",
          };
        }
      }
      return {
        ok: true,
        state: { ...state, phase: "firstNight", nightStep: 0 },
      };
    }
    case "firstNight":
      return {
        ok: true,
        state: { ...state, phase: "day", dayNumber: 1, nightStep: 0 },
      };
    case "day":
      return {
        ok: true,
        state: {
          ...state,
          phase: "night",
          nightStep: 0,
          openVote: null,
          nominations: [],
        },
      };
    case "night":
      return {
        ok: true,
        state: {
          ...state,
          phase: "day",
          dayNumber: state.dayNumber + 1,
          nightStep: 0,
        },
      };
    case "finished":
      return { ok: false, reason: "Match has already finished" };
  }
}

/**
 * Toggle a seat's life status. The Storyteller is responsible for
 * deciding *when* this fires (Imp kill, execution, Slayer shot, etc.) —
 * we just persist the bit and mirror it into the public seat info so
 * everyone can see the gravestone.
 */
function handleSetAlive(
  state: BotCState,
  seatId: PlayerId,
  alive: boolean,
): MoveResult<BotCState> {
  if (state.phase === "finished") {
    return { ok: false, reason: "Match has already finished" };
  }
  const seat = state.grimoire[seatId];
  const pub = state.seats[seatId];
  if (!seat || !pub) {
    return { ok: false, reason: `Unknown seat: ${seatId}` };
  }
  if (seat.isAlive === alive) {
    return { ok: true, state };
  }
  // Coming back from the dead is rare but legal (Storyteller may need to
  // correct a mistake). Don't reset the ghost-vote bit — that's
  // historical and the ST can clear it manually if intended.
  return {
    ok: true,
    state: {
      ...state,
      grimoire: { ...state.grimoire, [seatId]: { ...seat, isAlive: alive } },
      seats: { ...state.seats, [seatId]: { ...pub, isAlive: alive } },
    },
  };
}

function handleSetPoisoned(
  state: BotCState,
  seatId: PlayerId,
  poisoned: boolean,
): MoveResult<BotCState> {
  if (state.phase === "finished") {
    return { ok: false, reason: "Match has already finished" };
  }
  const seat = state.grimoire[seatId];
  if (!seat) return { ok: false, reason: `Unknown seat: ${seatId}` };
  if (seat.isPoisoned === poisoned) return { ok: true, state };
  return {
    ok: true,
    state: {
      ...state,
      grimoire: {
        ...state.grimoire,
        [seatId]: { ...seat, isPoisoned: poisoned },
      },
    },
  };
}

function handleSetDrunk(
  state: BotCState,
  seatId: PlayerId,
  drunk: boolean,
): MoveResult<BotCState> {
  if (state.phase === "finished") {
    return { ok: false, reason: "Match has already finished" };
  }
  const seat = state.grimoire[seatId];
  if (!seat) return { ok: false, reason: `Unknown seat: ${seatId}` };
  if (seat.isDrunk === drunk) return { ok: true, state };
  return {
    ok: true,
    state: {
      ...state,
      grimoire: {
        ...state.grimoire,
        [seatId]: { ...seat, isDrunk: drunk },
      },
    },
  };
}

/**
 * Generate a reminder-token id. Doesn't have to be cryptographic — the
 * collision domain is the Grimoire (a few dozen tokens at most), and
 * the id only needs to be stable enough to address with removeReminder.
 */
function newReminderId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function handleAddReminder(
  state: BotCState,
  seatId: PlayerId,
  label: string,
  characterId: string | undefined,
): MoveResult<BotCState> {
  if (state.phase === "finished") {
    return { ok: false, reason: "Match has already finished" };
  }
  const seat = state.grimoire[seatId];
  if (!seat) return { ok: false, reason: `Unknown seat: ${seatId}` };
  const reminder: ReminderToken = {
    id: newReminderId(),
    label,
    ...(characterId ? { characterId } : {}),
  };
  return {
    ok: true,
    state: {
      ...state,
      grimoire: {
        ...state.grimoire,
        [seatId]: { ...seat, reminders: [...seat.reminders, reminder] },
      },
    },
  };
}

function handleRemoveReminder(
  state: BotCState,
  seatId: PlayerId,
  reminderId: string,
): MoveResult<BotCState> {
  if (state.phase === "finished") {
    return { ok: false, reason: "Match has already finished" };
  }
  const seat = state.grimoire[seatId];
  if (!seat) return { ok: false, reason: `Unknown seat: ${seatId}` };
  const next = seat.reminders.filter((r) => r.id !== reminderId);
  if (next.length === seat.reminders.length) {
    return { ok: false, reason: `Reminder ${reminderId} not found` };
  }
  return {
    ok: true,
    state: {
      ...state,
      grimoire: {
        ...state.grimoire,
        [seatId]: { ...seat, reminders: next },
      },
    },
  };
}

/**
 * Cursor into tonight's wake-order list. Pure ST scratch state — players
 * never see it. Allowed during firstNight or night so the ST can scrub
 * back and forth as they walk the order.
 */
function handleSetNightStep(
  state: BotCState,
  index: number,
): MoveResult<BotCState> {
  if (state.phase !== "firstNight" && state.phase !== "night") {
    return {
      ok: false,
      reason: "Night step is only meaningful during night phase",
    };
  }
  return { ok: true, state: { ...state, nightStep: index } };
}

/**
 * Storyteller delivers private information to one player. The info is
 * not stored in state (the ST is allowed to lie, and the player simply
 * has to remember what they were told); we just emit a targeted event
 * the player's client picks up to render a modal.
 */
function handleSendInfo(
  state: BotCState,
  targetPlayerId: PlayerId,
  info: Extract<BotCMove, { kind: "st.sendInfo" }>["info"],
): MoveResult<BotCState> {
  if (state.phase === "finished") {
    return { ok: false, reason: "Match has already finished" };
  }
  if (!state.grimoire[targetPlayerId]) {
    return { ok: false, reason: `Unknown target seat: ${targetPlayerId}` };
  }
  return {
    ok: true,
    state,
    events: [
      {
        kind: "botc.privateInfo",
        payload: { info, sentAt: Date.now() },
        to: targetPlayerId,
      },
    ],
  };
}

/**
 * Player dismissed the wake modal. No state changes — the ST drives the
 * night order and doesn't wait on this. We may emit a follow-up "ack"
 * back to the ST in a later commit so they can see who's caught up.
 */
function handleAcknowledgeWake(state: BotCState): MoveResult<BotCState> {
  return { ok: true, state };
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
    state: BotCState,
    move: unknown,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<BotCState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) {
      return { ok: false, reason: parsed.error.message };
    }
    const m = parsed.data;
    const isST = actor === state.storytellerId;

    // Storyteller-only moves: gate first, then dispatch.
    if (m.kind.startsWith("st.")) {
      if (!isST) {
        return { ok: false, reason: "Only the Storyteller can do that" };
      }
    }

    switch (m.kind) {
      case "st.assignCharacters":
        return handleAssignCharacters(state, m.assignments);
      case "st.setSeatOrder":
        return handleSetSeatOrder(state, m.order);
      case "st.advancePhase":
        return handleAdvancePhase(state);
      case "st.setAlive":
        return handleSetAlive(state, m.seatId, m.alive);
      case "st.setPoisoned":
        return handleSetPoisoned(state, m.seatId, m.poisoned);
      case "st.setDrunk":
        return handleSetDrunk(state, m.seatId, m.drunk);
      case "st.addReminder":
        return handleAddReminder(state, m.seatId, m.label, m.characterId);
      case "st.removeReminder":
        return handleRemoveReminder(state, m.seatId, m.reminderId);
      case "st.setNightStep":
        return handleSetNightStep(state, m.index);
      case "st.sendInfo":
        return handleSendInfo(state, m.targetPlayerId, m.info);
      case "p.acknowledgeWake":
        return handleAcknowledgeWake(state);
      default:
        return {
          ok: false,
          reason: `Move "${m.kind}" is not yet implemented`,
        };
    }
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
