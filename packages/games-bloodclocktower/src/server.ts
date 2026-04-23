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
  BAD_MOON_RISING_IDS,
  BOTC_TYPE,
  SECTS_AND_VIOLETS_IDS,
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
function scriptIdsFor(cfg: BotCConfig): string[] {
  // Custom scripts win — the ST pasted a homebrew, ignore the
  // built-in scriptId entirely.
  if (cfg.customScript) {
    return [...cfg.customScript.characterIds];
  }
  switch (cfg.scriptId) {
    case "trouble-brewing":
      return [...TROUBLE_BREWING_IDS];
    case "bad-moon-rising":
      return [...BAD_MOON_RISING_IDS];
    case "sects-and-violets":
      return [...SECTS_AND_VIOLETS_IDS];
    default:
      // Defensive: configSchema validates the enum so this branch is
      // unreachable for now. Throwing makes a future typo loud.
      throw new Error(`Unknown BotC script: ${cfg.scriptId}`);
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
  cfg: BotCConfig,
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
  // The displayed scriptId is either the custom script's name (so the
  // grimoire header reads "script My Homebrew") or the built-in id.
  const scriptId = cfg.customScript ? cfg.customScript.name : cfg.scriptId;
  return {
    scriptId,
    scriptCharacterIds: scriptIdsFor(cfg),
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
/**
 * Strip the voter-identity arrays from a Nomination's result before
 * serving it to non-ST viewers. `yesCount` / `noCount` / `onTheBlock`
 * stay; the per-voter lists are ST-only so a future "private vote"
 * mechanic (Tea Lady, etc.) doesn't silently leak.
 */
function publicNomination(
  n: BotCState["nominations"][number],
): BotCState["nominations"][number] {
  if (!n.result) return { ...n };
  const { yesVotes: _yes, noVotes: _no, ...publicResult } = n.result;
  return { ...n, result: publicResult };
}

/**
 * Project the open vote for a non-ST viewer. Strips the per-player
 * votes map down to (a) the viewer's own entry, if they've voted; or
 * (b) empty for spectators. The public votedCount is preserved so the
 * UI can show "x of n have voted" without revealing how each one
 * cast.
 */
function projectOpenVote(
  openVote: BotCState["openVote"],
  viewer: PlayerId | null,
): BotCState["openVote"] {
  if (!openVote) return null;
  const myVote = viewer ? openVote.votes[viewer] : undefined;
  return {
    nominationId: openVote.nominationId,
    votes: myVote !== undefined && viewer ? { [viewer]: myVote } : {},
    votedCount: openVote.votedCount,
  };
}

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
    nominations: state.nominations.map(publicNomination),
    openVote: projectOpenVote(state.openVote, viewer),
    executions: state.executions.map((e) => ({ ...e })),
    fabled: [...state.fabled],
    seats: { ...state.seats },
    me,
    finalGrimoire:
      state.phase === "finished" ? { ...state.grimoire } : null,
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
    nominations: state.nominations.map(publicNomination),
    openVote: projectOpenVote(state.openVote, null),
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
  // Partial assignments are allowed — the UI dropdowns autosave one seat
  // at a time. The "every seat must have a character" requirement is
  // enforced at advancePhase, not here.
  const seatSet = new Set(state.seatOrder);
  for (const seat of Object.keys(assignments)) {
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
  // not in TB). Validate against the *merged* state — if Empath is
  // already at seat A and the ST tries to put Empath at seat B, that's
  // the duplicate to catch. (Reassigning the same seat to the same
  // character is fine.)
  const merged: Record<PlayerId, string> = {};
  for (const [seatId, seat] of Object.entries(state.grimoire)) {
    if (seat.characterId) merged[seatId] = seat.characterId;
  }
  for (const [seatId, characterId] of Object.entries(assignments)) {
    merged[seatId] = characterId;
  }
  const seen = new Map<string, PlayerId>();
  for (const [seatId, characterId] of Object.entries(merged)) {
    const prior = seen.get(characterId);
    if (prior && prior !== seatId) {
      return {
        ok: false,
        reason: `Character "${characterId}" is already assigned to another seat`,
      };
    }
    seen.set(characterId, seatId);
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

// ============================================================================
// Day: nominations / votes / executions
// ============================================================================

function newNominationId(): string {
  return `nom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function countLiving(state: BotCState): number {
  let n = 0;
  for (const id of state.seatOrder) {
    if (state.grimoire[id]?.isAlive) n++;
  }
  return n;
}

/**
 * Open a nomination. Used by both `p.nominate` (player nominating
 * directly) and `st.openNomination` (ST opening on a player's behalf,
 * useful when someone's offline or for testing). The ST path skips the
 * "this nominator hasn't gone yet" check — the ST is the rules referee
 * and may have a reason to allow a re-nomination (e.g. to fix an
 * accidental misclick by the player).
 */
function makeOpenVote(
  nominationId: string,
  votes: Record<PlayerId, "yes" | "no">,
): BotCState["openVote"] {
  return {
    nominationId,
    votes,
    votedCount: Object.keys(votes).length,
  };
}

function openNomination(
  state: BotCState,
  nominator: PlayerId,
  nominee: PlayerId,
  byST: boolean,
): MoveResult<BotCState> {
  if (state.phase !== "day") {
    return { ok: false, reason: "Nominations only happen during day" };
  }
  if (state.openVote) {
    return { ok: false, reason: "Close the current vote before opening another" };
  }
  if (nominator === nominee) {
    // Self-nomination is rare in BotC. Reject unless ST forces it.
    if (!byST) return { ok: false, reason: "You can't nominate yourself" };
  }
  const nominatorSeat = state.grimoire[nominator];
  const nomineeSeat = state.grimoire[nominee];
  if (!nominatorSeat) return { ok: false, reason: `Unknown nominator: ${nominator}` };
  if (!nomineeSeat) return { ok: false, reason: `Unknown nominee: ${nominee}` };
  if (!byST && !nominatorSeat.isAlive) {
    return { ok: false, reason: "Dead players can't nominate" };
  }
  if (!byST && state.nominations.some((n) => n.nominator === nominator)) {
    return { ok: false, reason: "You've already nominated today" };
  }
  if (state.nominations.some((n) => n.nominee === nominee)) {
    return { ok: false, reason: "That player has already been nominated today" };
  }
  const nomination: BotCState["nominations"][number] = {
    id: newNominationId(),
    nominator,
    nominee,
    openedAt: Date.now(),
    result: null,
  };
  return {
    ok: true,
    state: {
      ...state,
      nominations: [...state.nominations, nomination],
      openVote: makeOpenVote(nomination.id, {}),
    },
    events: [
      {
        kind: "botc.nominationOpened",
        payload: { nominationId: nomination.id, nominator, nominee },
        to: "all",
      },
    ],
  };
}

/**
 * Cast a vote. Players may vote at any time during an open nomination;
 * dead players have one ghost vote that is consumed regardless of how
 * they vote (yes or no), per the official rule.
 */
function handleCastVote(
  state: BotCState,
  voter: PlayerId,
  nominationId: string,
  vote: "yes" | "no",
): MoveResult<BotCState> {
  if (state.phase !== "day") {
    return { ok: false, reason: "Voting only happens during day" };
  }
  if (!state.openVote || state.openVote.nominationId !== nominationId) {
    return { ok: false, reason: "There is no open vote to cast on" };
  }
  const seat = state.grimoire[voter];
  if (!seat) return { ok: false, reason: `Unknown voter: ${voter}` };
  if (!seat.isAlive && seat.ghostVoteUsed) {
    return { ok: false, reason: "Your ghost vote has already been used" };
  }
  if (state.openVote.votes[voter] !== undefined) {
    return { ok: false, reason: "You've already voted on this nomination" };
  }
  const newVotes = { ...state.openVote.votes, [voter]: vote };
  const nextOpenVote = makeOpenVote(state.openVote.nominationId, newVotes);
  let grimoire = state.grimoire;
  let seats = state.seats;
  if (!seat.isAlive) {
    grimoire = {
      ...grimoire,
      [voter]: { ...seat, ghostVoteUsed: true },
    };
    seats = {
      ...seats,
      [voter]: { ...seats[voter]!, ghostVoteUsed: true },
    };
  }
  return { ok: true, state: { ...state, openVote: nextOpenVote, grimoire, seats } };
}

/**
 * ST closes the current vote and stamps the result onto the
 * nomination. "On the block" = at least half of the living have voted
 * yes. Whether to actually execute is a separate ST move; we just
 * record the tally so the ST and players can see who got how many.
 */
function handleCloseVote(state: BotCState): MoveResult<BotCState> {
  if (!state.openVote) {
    return { ok: false, reason: "No open vote to close" };
  }
  const nominationId = state.openVote.nominationId;
  // Defensive: openVote should always reference a real nomination, but if
  // a bug ever decoupled them we'd silently drop the close. Fail loudly.
  if (!state.nominations.some((n) => n.id === nominationId)) {
    return {
      ok: false,
      reason: `Open vote references unknown nomination ${nominationId}`,
    };
  }
  const yesVotes: PlayerId[] = [];
  const noVotes: PlayerId[] = [];
  for (const [voter, v] of Object.entries(state.openVote.votes)) {
    if (v === "yes") yesVotes.push(voter);
    else noVotes.push(voter);
  }
  const livingCount = countLiving(state);
  const onTheBlock = yesVotes.length >= Math.ceil(livingCount / 2);
  const nominations = state.nominations.map((n) =>
    n.id === nominationId
      ? {
          ...n,
          result: {
            yesCount: yesVotes.length,
            noCount: noVotes.length,
            onTheBlock,
            yesVotes,
            noVotes,
          },
        }
      : n,
  );
  return {
    ok: true,
    state: { ...state, nominations, openVote: null },
    events: [
      {
        kind: "botc.voteClosed",
        payload: {
          nominationId,
          yesVotes: yesVotes.length,
          noVotes: noVotes.length,
          onTheBlock,
        },
        to: "all",
      },
    ],
  };
}

/**
 * Execute a nominee. The ST chooses who — typically the
 * highest-block person, but they may execute anyone they want
 * (Saint, Mayor, ST discretion etc.). Marks the seat dead and logs
 * the execution.
 */
function handleExecuteNominee(
  state: BotCState,
  nomineeId: PlayerId,
): MoveResult<BotCState> {
  if (state.phase !== "day") {
    return { ok: false, reason: "Executions only happen during day" };
  }
  if (state.openVote) {
    return { ok: false, reason: "Close the open vote before executing" };
  }
  const seat = state.grimoire[nomineeId];
  const pub = state.seats[nomineeId];
  if (!seat || !pub) {
    return { ok: false, reason: `Unknown nominee: ${nomineeId}` };
  }
  // Allow re-executing of an already-dead seat as a no-op-ish (records the
  // intent but doesn't double-kill). In practice this won't happen — the
  // ST sees alive/dead and won't re-pick — but keeping it simple.
  const grimoire = {
    ...state.grimoire,
    [nomineeId]: { ...seat, isAlive: false },
  };
  const seats = {
    ...state.seats,
    [nomineeId]: { ...pub, isAlive: false },
  };
  const executions = [
    ...state.executions,
    {
      dayNumber: state.dayNumber,
      executed: nomineeId,
      reason: "vote" as const,
    },
  ];
  return {
    ok: true,
    state: { ...state, grimoire, seats, executions },
    events: [
      {
        kind: "botc.executed",
        payload: { dayNumber: state.dayNumber, executed: nomineeId },
        to: "all",
      },
    ],
  };
}

/**
 * ST decides no one is executed today. Records a null execution so
 * the day's history stays complete.
 */
/**
 * End the match. The ST chooses the winning team (good or evil) and
 * a short human reason that goes onto the post-mortem and the lobby
 * "rematch" affordance. Per the digital-grimoire plan, win conditions
 * are not auto-detected — too many TB exceptions (Saint, Mayor,
 * Recluse) for an engine to be safer than the ST's call.
 */
function handleAddFabled(
  state: BotCState,
  fabledId: string,
): MoveResult<BotCState> {
  if (state.phase === "finished") {
    return { ok: false, reason: "Match has already finished" };
  }
  if (state.fabled.includes(fabledId)) {
    return { ok: true, state }; // idempotent
  }
  return { ok: true, state: { ...state, fabled: [...state.fabled, fabledId] } };
}

function handleRemoveFabled(
  state: BotCState,
  fabledId: string,
): MoveResult<BotCState> {
  if (state.phase === "finished") {
    return { ok: false, reason: "Match has already finished" };
  }
  const next = state.fabled.filter((id) => id !== fabledId);
  if (next.length === state.fabled.length) {
    return { ok: false, reason: `Fabled ${fabledId} is not active` };
  }
  return { ok: true, state: { ...state, fabled: next } };
}

function handleEndMatch(
  state: BotCState,
  winner: "good" | "evil",
  reason: string,
): MoveResult<BotCState> {
  if (state.phase === "finished") {
    return { ok: false, reason: "Match has already finished" };
  }
  return {
    ok: true,
    state: {
      ...state,
      phase: "finished",
      winner,
      endReason: reason,
      openVote: null,
    },
    events: [
      {
        kind: "botc.matchEnded",
        payload: { winner, reason },
        to: "all",
      },
    ],
  };
}

function handleSkipExecution(state: BotCState): MoveResult<BotCState> {
  if (state.phase !== "day") {
    return { ok: false, reason: "Executions only happen during day" };
  }
  if (state.openVote) {
    return { ok: false, reason: "Close the open vote first" };
  }
  const executions = [
    ...state.executions,
    {
      dayNumber: state.dayNumber,
      executed: null,
      reason: "st-decision" as const,
    },
  ];
  return {
    ok: true,
    state: { ...state, executions },
    events: [
      {
        kind: "botc.executionSkipped",
        payload: { dayNumber: state.dayNumber },
        to: "all",
      },
    ],
  };
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
    return emptyState(ctx.storytellerId, players, cfg);
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
      case "st.openNomination":
        return openNomination(state, m.nominator, m.nominee, true);
      case "st.closeVote":
        return handleCloseVote(state);
      case "st.executeNominee":
        return handleExecuteNominee(state, m.nomineeId);
      case "st.skipExecution":
        return handleSkipExecution(state);
      case "st.endMatch":
        return handleEndMatch(state, m.winner, m.reason);
      case "st.addFabled":
        return handleAddFabled(state, m.fabledId);
      case "st.removeFabled":
        return handleRemoveFabled(state, m.fabledId);
      case "p.nominate":
        return openNomination(state, actor, m.nominee, false);
      case "p.castVote":
        return handleCastVote(state, actor, m.nominationId, m.vote);
      case "p.acknowledgeWake":
        return handleAcknowledgeWake(state);
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
