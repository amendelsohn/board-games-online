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
import { shuffle } from "@bgo/sdk";
import {
  ALL_CARDS,
  COUP_TYPE,
  actionIsBlockable,
  actionIsChallengeable,
  actionNeedsTarget,
  blockersFor,
  claimFor,
  moveSchema,
  type ActionType,
  type Card,
  type CoupConfig,
  type CoupMove,
  type CoupState,
  type CoupView,
  type ForcedReveal,
  type HandCard,
  type LogEntry,
  type OpponentHandView,
  type PendingAction,
  type PendingBlock,
} from "./shared";

const STARTING_COINS = 2;
const COUP_COST = 7;
const ASSASSINATE_COST = 3;
const MANDATORY_COUP_THRESHOLD = 10;

/** Build and shuffle the 15-card court deck. */
function freshDeck(rng: () => number): Card[] {
  const deck: Card[] = [];
  for (const c of ALL_CARDS) {
    deck.push(c, c, c);
  }
  return shuffle(deck, rng);
}

/** True if the player still has at least one face-down (unrevealed) card. */
function isAlive(hand: HandCard[] | undefined): boolean {
  if (!hand) return false;
  return hand.some((c) => !c.revealed);
}

/** Return the next alive player after `from` in seating order. */
function nextAlive(state: CoupState, from: PlayerId): PlayerId | null {
  const idx = state.playerOrder.indexOf(from);
  if (idx < 0) return null;
  const n = state.playerOrder.length;
  for (let step = 1; step <= n; step++) {
    const cand = state.playerOrder[(idx + step) % n]!;
    if (isAlive(state.hands[cand])) return cand;
  }
  return null;
}

/** Players (excluding `exclude`) who are still alive, in seating order. */
function aliveOthers(state: CoupState, exclude: PlayerId): PlayerId[] {
  return state.playerOrder.filter(
    (id) => id !== exclude && isAlive(state.hands[id]),
  );
}

function addLog(state: CoupState, text: string): CoupState {
  const entry: LogEntry = { id: state.nextLogId, text };
  const nextLog = state.log.slice();
  nextLog.push(entry);
  // Cap the log so it doesn't grow unbounded.
  const trimmed = nextLog.length > 50 ? nextLog.slice(-50) : nextLog;
  return { ...state, log: trimmed, nextLogId: state.nextLogId + 1 };
}

/** Return the next alive card index the player will need to flip. */
function aliveCardIndices(hand: HandCard[]): number[] {
  const out: number[] = [];
  hand.forEach((c, i) => {
    if (!c.revealed) out.push(i);
  });
  return out;
}

/** Start the "end of turn" transition: advance to next alive player. */
function endTurn(state: CoupState): CoupState {
  // Check game over: exactly one alive player.
  const alive = state.playerOrder.filter((id) => isAlive(state.hands[id]));
  if (alive.length <= 1) {
    return {
      ...state,
      phase: "gameOver",
      pendingAction: null,
      pendingBlock: null,
      respondersRemaining: [],
      forcedReveal: null,
      exchangeDraw: null,
      winner: alive[0] ?? null,
    };
  }
  const next = nextAlive(state, state.current);
  return {
    ...state,
    phase: "action",
    current: next ?? state.current,
    pendingAction: null,
    pendingBlock: null,
    respondersRemaining: [],
    forcedReveal: null,
    exchangeDraw: null,
  };
}

/** Fire the pending action's effect (the actor "had" the card / it wasn't blocked). */
function fireAction(state: CoupState): CoupState {
  const pa = state.pendingAction;
  if (!pa) return state;
  const actor = pa.actor;
  const target = pa.target;
  const coins = { ...state.coins };

  switch (pa.actionType) {
    case "income": {
      coins[actor] = (coins[actor] ?? 0) + 1;
      return endTurn(addLog({ ...state, coins }, logActionFired(pa)));
    }
    case "foreignAid": {
      coins[actor] = (coins[actor] ?? 0) + 2;
      return endTurn(addLog({ ...state, coins }, logActionFired(pa)));
    }
    case "tax": {
      coins[actor] = (coins[actor] ?? 0) + 3;
      return endTurn(addLog({ ...state, coins }, logActionFired(pa)));
    }
    case "steal": {
      if (!target) return endTurn(state);
      const stolen = Math.min(2, coins[target] ?? 0);
      coins[target] = (coins[target] ?? 0) - stolen;
      coins[actor] = (coins[actor] ?? 0) + stolen;
      return endTurn(addLog({ ...state, coins }, logActionFired(pa, stolen)));
    }
    case "assassinate": {
      if (!target) return endTurn(state);
      // If target is already out (e.g. just died to a challenge), skip the reveal.
      if (!isAlive(state.hands[target])) {
        return endTurn(addLog({ ...state, coins }, logActionFired(pa)));
      }
      const next: CoupState = {
        ...state,
        coins,
        phase: "reveal",
        respondersRemaining: [],
        pendingBlock: null,
        forcedReveal: {
          player: target,
          reason: "assassinated",
          resume: "resolveAction",
        },
      };
      return addLog(next, logActionFired(pa));
    }
    case "exchange": {
      // Draw 2 from deck; actor will pick which to keep.
      const deck = state.deck.slice();
      const drawn: Card[] = [];
      for (let i = 0; i < 2 && deck.length > 0; i++) {
        drawn.push(deck.shift()!);
      }
      const next: CoupState = {
        ...state,
        coins,
        deck,
        phase: "exchange",
        respondersRemaining: [],
        pendingBlock: null,
        exchangeDraw: drawn,
      };
      return addLog(next, logActionFired(pa));
    }
    case "coup": {
      if (!target) return endTurn(state);
      if (!isAlive(state.hands[target])) {
        return endTurn(addLog({ ...state, coins }, logActionFired(pa)));
      }
      const next: CoupState = {
        ...state,
        coins,
        phase: "reveal",
        respondersRemaining: [],
        pendingBlock: null,
        forcedReveal: {
          player: target,
          reason: "couped",
          resume: "resolveAction",
        },
      };
      return addLog(next, logActionFired(pa));
    }
  }
}

function logActionFired(pa: PendingAction, stolenAmount?: number): string {
  const a = pa.actor;
  switch (pa.actionType) {
    case "income":
      return `${a} takes Income (+1).`;
    case "foreignAid":
      return `${a} takes Foreign Aid (+2).`;
    case "tax":
      return `${a} collects Tax (+3) as Duke.`;
    case "steal":
      return `${a} steals ${stolenAmount ?? 0} from ${pa.target} as Captain.`;
    case "assassinate":
      return `${a} assassinates ${pa.target}.`;
    case "exchange":
      return `${a} exchanges with the court (Ambassador).`;
    case "coup":
      return `${a} coups ${pa.target}.`;
  }
}

// ------------------------- Action submission -------------------------

function submitAction(
  state: CoupState,
  actor: PlayerId,
  actionType: ActionType,
  target: PlayerId | null,
): MoveResult<CoupState> {
  if (state.current !== actor) {
    return { ok: false, reason: "Not your turn" };
  }
  if (state.phase !== "action") {
    return { ok: false, reason: "Not in the action phase" };
  }
  if (!isAlive(state.hands[actor])) {
    return { ok: false, reason: "You are out" };
  }

  // Mandatory coup at 10+ coins.
  const actorCoins = state.coins[actor] ?? 0;
  if (actorCoins >= MANDATORY_COUP_THRESHOLD && actionType !== "coup") {
    return { ok: false, reason: "You have 10+ coins — you must coup" };
  }

  // Targeting rules.
  if (actionNeedsTarget(actionType)) {
    if (!target) return { ok: false, reason: "This action needs a target" };
    if (target === actor) {
      return { ok: false, reason: "You can't target yourself" };
    }
    if (!state.playerOrder.includes(target)) {
      return { ok: false, reason: "Unknown target" };
    }
    if (!isAlive(state.hands[target])) {
      return { ok: false, reason: "Target is out of the game" };
    }
  } else if (target) {
    return { ok: false, reason: "This action doesn't take a target" };
  }

  // Cost checks.
  if (actionType === "coup" && actorCoins < COUP_COST) {
    return { ok: false, reason: "Coup costs 7 coins" };
  }
  if (actionType === "assassinate" && actorCoins < ASSASSINATE_COST) {
    return { ok: false, reason: "Assassinate costs 3 coins" };
  }

  let next: CoupState = state;

  // Pay up-front costs for actions that are paid regardless of challenge outcome.
  if (actionType === "coup") {
    next = { ...next, coins: { ...next.coins, [actor]: actorCoins - COUP_COST } };
  } else if (actionType === "assassinate") {
    next = {
      ...next,
      coins: { ...next.coins, [actor]: actorCoins - ASSASSINATE_COST },
    };
  }

  const pa: PendingAction = {
    actor,
    actionType,
    target: target ?? null,
    claim: claimFor(actionType),
  };

  // Coup and Income cannot be interrupted — fire immediately.
  if (actionType === "coup" || actionType === "income") {
    next = { ...next, pendingAction: pa };
    next = addLog(
      next,
      actionType === "coup"
        ? `${actor} pays 7 and coups ${target}.`
        : `${actor} takes Income.`,
    );
    next = fireAction(next);
    return { ok: true, state: next };
  }

  // Otherwise we enter a response window for all other alive players.
  const responders = aliveOthers(next, actor);
  next = {
    ...next,
    pendingAction: pa,
    pendingBlock: null,
    respondersRemaining: responders,
    phase: "respond",
  };
  next = addLog(next, logActionClaim(pa));

  // Edge case: solo player with no opponents (shouldn't happen in a live game).
  if (responders.length === 0) {
    return { ok: true, state: fireAction(next) };
  }
  return { ok: true, state: next };
}

function logActionClaim(pa: PendingAction): string {
  const a = pa.actor;
  switch (pa.actionType) {
    case "foreignAid":
      return `${a} attempts Foreign Aid (+2) — anyone can block as Duke.`;
    case "tax":
      return `${a} claims Duke for Tax (+3).`;
    case "steal":
      return `${a} claims Captain, stealing 2 from ${pa.target}.`;
    case "assassinate":
      return `${a} pays 3 and claims Assassin on ${pa.target}.`;
    case "exchange":
      return `${a} claims Ambassador to exchange cards.`;
    case "income":
      return `${a} takes Income (+1).`;
    case "coup":
      return `${a} coups ${pa.target}.`;
  }
}

// ------------------------- Response handling -------------------------

function submitResponse(
  state: CoupState,
  actor: PlayerId,
  response: "allow" | "block" | "challenge",
  blockAs: Card | undefined,
  rng: () => number,
): MoveResult<CoupState> {
  if (state.phase !== "respond" && state.phase !== "blockRespond") {
    return { ok: false, reason: "Nothing to respond to right now" };
  }
  if (!state.respondersRemaining.includes(actor)) {
    return { ok: false, reason: "You already responded or can't respond" };
  }
  if (!isAlive(state.hands[actor])) {
    return { ok: false, reason: "You are out" };
  }

  if (state.phase === "respond") {
    return handleActionResponse(state, actor, response, blockAs, rng);
  }
  return handleBlockResponse(state, actor, response, blockAs, rng);
}

/** Response to the actor's claimed action. */
function handleActionResponse(
  state: CoupState,
  actor: PlayerId,
  response: "allow" | "block" | "challenge",
  blockAs: Card | undefined,
  rng: () => number,
): MoveResult<CoupState> {
  const pa = state.pendingAction;
  if (!pa) return { ok: false, reason: "No pending action" };

  if (response === "allow") {
    const rem = state.respondersRemaining.filter((id) => id !== actor);
    if (rem.length > 0) {
      return { ok: true, state: { ...state, respondersRemaining: rem } };
    }
    // Everyone allowed → action fires.
    return { ok: true, state: fireAction(state) };
  }

  if (response === "challenge") {
    if (!actionIsChallengeable(pa.actionType) || pa.claim == null) {
      return { ok: false, reason: "This action can't be challenged" };
    }
    // Resolve the challenge.
    return { ok: true, state: resolveChallenge(state, actor, "action", rng) };
  }

  // Block.
  if (!actionIsBlockable(pa.actionType)) {
    return { ok: false, reason: "This action can't be blocked" };
  }
  if (!blockAs) {
    return { ok: false, reason: "Must specify the card you're blocking as" };
  }
  const allowed = blockersFor(pa.actionType);
  if (!allowed.includes(blockAs)) {
    return {
      ok: false,
      reason: `${blockAs} can't block that action`,
    };
  }
  // Only the target may block a targeted action (steal/assassinate).
  if (pa.target && pa.target !== actor) {
    return { ok: false, reason: "Only the target may block this action" };
  }
  const pb: PendingBlock = { blocker: actor, blockAs };
  // Now everyone except the blocker gets to respond to the block.
  const responders = state.playerOrder.filter(
    (id) => id !== actor && isAlive(state.hands[id]),
  );
  let next: CoupState = {
    ...state,
    pendingBlock: pb,
    phase: "blockRespond",
    respondersRemaining: responders,
  };
  next = addLog(next, `${actor} blocks as ${blockAs}.`);
  if (responders.length === 0) {
    // Nobody to challenge — block succeeds; action fizzles.
    next = addLog(next, `Block stands — ${pa.actionType} fails.`);
    return { ok: true, state: endTurn(next) };
  }
  return { ok: true, state: next };
}

/** Response to a block (blockRespond phase). */
function handleBlockResponse(
  state: CoupState,
  actor: PlayerId,
  response: "allow" | "block" | "challenge",
  _blockAs: Card | undefined,
  rng: () => number,
): MoveResult<CoupState> {
  if (response === "block") {
    return { ok: false, reason: "Can't block a block" };
  }
  if (response === "allow") {
    const rem = state.respondersRemaining.filter((id) => id !== actor);
    if (rem.length > 0) {
      return { ok: true, state: { ...state, respondersRemaining: rem } };
    }
    // Block succeeded — action fails.
    const pa = state.pendingAction;
    let next = state;
    next = addLog(
      next,
      `Block stands — ${pa?.actionType ?? "action"} fails.`,
    );
    return { ok: true, state: endTurn(next) };
  }
  // Challenge the block.
  return { ok: true, state: resolveChallenge(state, actor, "block", rng) };
}

/**
 * Resolve a challenge. If the challenged player has the claimed card, they
 * reveal it (returned to deck, replaced), and the challenger loses an
 * influence. Otherwise the challenged player loses an influence and the
 * action/block is treated as failed/succeeded respectively.
 *
 * Because a reveal is a player choice (phase=reveal), we set up a forcedReveal
 * with a "resume" instruction telling us how to continue after the flip.
 */
function resolveChallenge(
  state: CoupState,
  challenger: PlayerId,
  target: "action" | "block",
  rng: () => number,
): CoupState {
  const pa = state.pendingAction;
  const pb = state.pendingBlock;
  if (!pa) return state;
  const claimed = target === "action" ? pa.claim : pb?.blockAs ?? null;
  const claimedBy = target === "action" ? pa.actor : pb?.blocker ?? null;
  if (!claimed || !claimedBy) return state;

  const hand = state.hands[claimedBy] ?? [];
  const matchIdx = hand.findIndex((c) => !c.revealed && c.card === claimed);
  const hasCard = matchIdx >= 0;

  let next: CoupState = state;
  next = addLog(
    next,
    `${challenger} challenges ${claimedBy}'s ${claimed}.`,
  );

  if (hasCard) {
    // Challenger is wrong: claimant shuffles the card back into the deck,
    // draws a replacement, and the challenger must reveal an influence.
    const newHand = hand.slice();
    const oldCard = newHand[matchIdx]!;
    const reshuffled = shuffle([...state.deck, oldCard.card], rng);
    const drawn = reshuffled.shift();
    if (drawn) {
      newHand[matchIdx] = { card: drawn, revealed: false };
    } else {
      newHand[matchIdx] = oldCard;
    }
    next = {
      ...next,
      hands: { ...state.hands, [claimedBy]: newHand },
      deck: reshuffled,
    };
    next = addLog(
      next,
      `${claimedBy} reveals ${claimed} — ${challenger} loses an influence.`,
    );
    next = beginForcedReveal(next, {
      player: challenger,
      reason: "lostChallenge",
      // Action target: claim was true → action still fires (unless challenger
      //   was also the blocker? no — action challenge == claim holds == fire).
      // Block target: block claim was true → block stands → action aborts.
      resume: target === "action" ? "fireAction" : "abortAction",
    });
    return next;
  }

  // Claimant bluffed — they lose influence.
  next = addLog(
    next,
    `${claimedBy} doesn't have ${claimed} — they lose an influence.`,
  );
  next = beginForcedReveal(next, {
    player: claimedBy,
    reason: "lostChallenge",
    // Action target: actor was caught bluffing → action aborts.
    // Block target: blocker was caught bluffing → block fails → action fires.
    resume: target === "action" ? "abortAction" : "fireAction",
  });
  return next;
}

function beginForcedReveal(state: CoupState, fr: ForcedReveal): CoupState {
  const hand = state.hands[fr.player];
  if (!hand || !isAlive(hand)) {
    // Player is already out — skip reveal, continue resume branch.
    return finishForcedReveal(state, fr, null);
  }
  const alive = aliveCardIndices(hand);
  if (alive.length === 1) {
    // Force-flip their one remaining card without asking.
    return finishForcedReveal(state, fr, alive[0]!);
  }
  return {
    ...state,
    phase: "reveal",
    forcedReveal: fr,
  };
}

/** Apply the reveal (flipping `cardIndex`, or skipping if null) and resume. */
function finishForcedReveal(
  state: CoupState,
  fr: ForcedReveal,
  cardIndex: number | null,
): CoupState {
  let next: CoupState = state;
  if (cardIndex !== null) {
    const hand = state.hands[fr.player] ?? [];
    if (!hand[cardIndex] || hand[cardIndex].revealed) {
      // Defensive: caller validated, but in case, leave unchanged.
      return state;
    }
    const newHand = hand.slice();
    newHand[cardIndex] = { ...hand[cardIndex], revealed: true };
    next = {
      ...next,
      hands: { ...state.hands, [fr.player]: newHand },
    };
    next = addLog(next, `${fr.player} reveals ${hand[cardIndex].card}.`);
  }

  // Clear forcedReveal regardless.
  next = { ...next, forcedReveal: null };

  switch (fr.resume) {
    case "resolveAction":
      // Reveal was the terminal step of an action (e.g. coup/assassinate
      // target flipping). End the turn.
      return endTurn(next);
    case "fireAction":
      // Reveal happened because a challenge completed; the underlying action
      // should now fire. Challenger lost -> actor still had the card; or the
      // block was challenged and the blocker had the card -> block stands
      // (action aborts). The caller sets the right resume accordingly.
      return fireAction(next);
    case "abortAction":
      // Action or block was successfully challenged in a way that means the
      // actor's action does NOT fire. Just end the turn (coins already paid
      // for assassinate / coup remain paid).
      return endTurn(next);
    case "noResume":
      return next;
  }
}

// ------------------------- Other moves -------------------------

function submitRevealInfluence(
  state: CoupState,
  actor: PlayerId,
  cardIndex: 0 | 1,
): MoveResult<CoupState> {
  if (state.phase !== "reveal" || !state.forcedReveal) {
    return { ok: false, reason: "No reveal is pending" };
  }
  if (state.forcedReveal.player !== actor) {
    return { ok: false, reason: "Not your reveal" };
  }
  const hand = state.hands[actor] ?? [];
  if (!hand[cardIndex]) {
    return { ok: false, reason: "Card index out of range" };
  }
  if (hand[cardIndex].revealed) {
    return { ok: false, reason: "That card is already revealed" };
  }
  return { ok: true, state: finishForcedReveal(state, state.forcedReveal, cardIndex) };
}

function submitExchangeSelect(
  state: CoupState,
  actor: PlayerId,
  keep: Card[],
  rng: () => number,
): MoveResult<CoupState> {
  if (state.phase !== "exchange") {
    return { ok: false, reason: "Not in an exchange" };
  }
  const pa = state.pendingAction;
  if (!pa || pa.actor !== actor) {
    return { ok: false, reason: "Not your exchange" };
  }
  const drawn = state.exchangeDraw ?? [];
  const hand = state.hands[actor] ?? [];
  const alive = hand.filter((c) => !c.revealed).map((c) => c.card);
  const expectedKeep = alive.length; // Keep as many cards as you currently have alive.

  if (keep.length !== expectedKeep) {
    return {
      ok: false,
      reason: `You must keep exactly ${expectedKeep} card${expectedKeep === 1 ? "" : "s"}`,
    };
  }

  // Verify that `keep` is a valid multiset drawn from (alive ∪ drawn).
  const pool: Card[] = [...alive, ...drawn];
  const poolCopy = pool.slice();
  for (const k of keep) {
    const idx = poolCopy.indexOf(k);
    if (idx < 0) {
      return { ok: false, reason: "Kept a card you don't have access to" };
    }
    poolCopy.splice(idx, 1);
  }
  const returned = poolCopy; // Whatever wasn't kept goes back to the deck.

  // Rebuild the hand: keep revealed cards as-is; unrevealed cards replaced by keep[].
  const newHand: HandCard[] = [];
  let keepIdx = 0;
  for (const c of hand) {
    if (c.revealed) {
      newHand.push(c);
    } else {
      const k = keep[keepIdx++];
      if (!k) {
        return { ok: false, reason: "Internal: hand rebuild failed" };
      }
      newHand.push({ card: k, revealed: false });
    }
  }

  const newDeck = shuffle([...state.deck, ...returned], rng);

  let next: CoupState = {
    ...state,
    hands: { ...state.hands, [actor]: newHand },
    deck: newDeck,
    exchangeDraw: null,
  };
  next = addLog(next, `${actor} finishes exchanging.`);
  return { ok: true, state: endTurn(next) };
}

// ------------------------- Module -------------------------

export const coupServerModule: GameModule<
  CoupState,
  CoupMove,
  CoupConfig,
  CoupView
> = {
  type: COUP_TYPE,
  displayName: "Coup",
  description:
    "Lie about your cards, call out bluffs, and be the last influence standing.",
  minPlayers: 2,
  maxPlayers: 6,

  defaultConfig(): CoupConfig {
    return {};
  },

  validateConfig(cfg: unknown): CoupConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: CoupConfig,
    ctx: GameContext,
  ): CoupState {
    const count = players.length;
    if (count < 2 || count > 6) {
      throw new Error(`Coup requires 2-6 players, got ${count}`);
    }
    const seating = shuffle(players, ctx.rng).map((p) => p.id);
    const deck = freshDeck(ctx.rng);

    const hands: Record<PlayerId, HandCard[]> = {};
    for (const id of seating) {
      const a = deck.shift()!;
      const b = deck.shift()!;
      hands[id] = [
        { card: a, revealed: false },
        { card: b, revealed: false },
      ];
    }
    const coins: Record<PlayerId, number> = {};
    for (const id of seating) coins[id] = STARTING_COINS;

    const firstIdx = Math.floor(ctx.rng() * seating.length);
    const first = seating[firstIdx]!;

    return {
      playerOrder: seating,
      hands,
      coins,
      deck,
      current: first,
      phase: "action",
      pendingAction: null,
      pendingBlock: null,
      respondersRemaining: [],
      forcedReveal: null,
      exchangeDraw: null,
      log: [{ id: 0, text: `Game begins. ${first} acts first.` }],
      nextLogId: 1,
      winner: null,
    };
  },

  handleMove(
    state: CoupState,
    move: CoupMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<CoupState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    if (!state.playerOrder.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }

    const m = parsed.data;
    switch (m.kind) {
      case "action":
        return submitAction(state, actor, m.actionType, m.target ?? null);
      case "respond":
        return submitResponse(state, actor, m.response, m.blockAs, ctx.rng);
      case "revealInfluence":
        return submitRevealInfluence(state, actor, m.cardIndex as 0 | 1);
      case "exchangeSelect":
        return submitExchangeSelect(state, actor, m.keep, ctx.rng);
    }
  },

  view(state: CoupState, viewer: Viewer): CoupView {
    const isSpectator = viewer === "spectator";
    const isTerminal = state.phase === "gameOver";

    const myHand =
      isSpectator || !state.hands[viewer]
        ? null
        : state.hands[viewer].map((c) => ({ ...c }));

    const opponents: Record<PlayerId, OpponentHandView> = {};
    for (const id of state.playerOrder) {
      if (id === viewer) continue;
      const hand = state.hands[id] ?? [];
      const revealed: Card[] = [];
      let hiddenCount = 0;
      for (const c of hand) {
        if (c.revealed) revealed.push(c.card);
        else hiddenCount++;
      }
      opponents[id] = { revealed, hiddenCount };
    }

    // Exchange draw is only visible to the acting player currently exchanging.
    const seeExchange =
      !isSpectator &&
      state.phase === "exchange" &&
      state.pendingAction?.actor === viewer;

    const finalHands: Record<PlayerId, HandCard[]> | null = isTerminal
      ? Object.fromEntries(
          state.playerOrder.map((id) => [
            id,
            (state.hands[id] ?? []).map((c) => ({ ...c })),
          ]),
        )
      : null;

    return {
      phase: state.phase,
      playerOrder: [...state.playerOrder],
      current: state.current,
      coins: { ...state.coins },
      deckCount: state.deck.length,
      myHand,
      opponents,
      pendingAction: state.pendingAction
        ? { ...state.pendingAction }
        : null,
      pendingBlock: state.pendingBlock ? { ...state.pendingBlock } : null,
      respondersRemaining: [...state.respondersRemaining],
      forcedReveal: state.forcedReveal ? { ...state.forcedReveal } : null,
      exchangeDraw: seeExchange ? [...(state.exchangeDraw ?? [])] : null,
      log: state.log.map((e) => ({ ...e })),
      winner: state.winner,
      finalHands,
    };
  },

  phase(state: CoupState): PhaseId {
    return state.phase;
  },

  currentActors(state: CoupState): PlayerId[] {
    switch (state.phase) {
      case "action":
        return [state.current];
      case "respond":
      case "blockRespond":
        return [...state.respondersRemaining];
      case "reveal":
        return state.forcedReveal ? [state.forcedReveal.player] : [];
      case "exchange":
        return [state.current];
      case "gameOver":
        return [];
    }
  },

  isTerminal(state: CoupState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: CoupState): Outcome | null {
    if (state.phase !== "gameOver") return null;
    if (!state.winner) {
      // Pathological: everyone out. Treat as a draw.
      return { kind: "draw" };
    }
    const losers = state.playerOrder.filter((id) => id !== state.winner);
    return { kind: "solo", winners: [state.winner], losers };
  },
};
