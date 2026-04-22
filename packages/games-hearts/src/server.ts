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
  FULL_DECK,
  HEARTS_TYPE,
  cardsEqual,
  cardKey,
  handContains,
  isHeart,
  isQueenOfSpades,
  isTwoOfClubs,
  moveSchema,
  sortHand,
  type Card,
  type HeartsConfig,
  type HeartsMove,
  type HeartsState,
  type HeartsView,
  type Suit,
  type TrickEntry,
} from "./shared";

const HAND_SIZE = 13;
const PASS_COUNT = 3;
const TOTAL_PENALTY = 26;

function leftOf(order: PlayerId[], id: PlayerId): PlayerId {
  const i = order.indexOf(id);
  return order[(i + 1) % order.length]!;
}

function holderOfTwoOfClubs(hands: Record<PlayerId, Card[]>): PlayerId | null {
  for (const [pid, hand] of Object.entries(hands)) {
    if (hand.some(isTwoOfClubs)) return pid;
  }
  return null;
}

function removeCard(hand: readonly Card[], card: Card): Card[] {
  const out: Card[] = [];
  let removed = false;
  for (const c of hand) {
    if (!removed && cardsEqual(c, card)) {
      removed = true;
      continue;
    }
    out.push(c);
  }
  return out;
}

function hasSuit(hand: readonly Card[], suit: Suit): boolean {
  return hand.some((c) => c.suit === suit);
}

function isFirstTrick(state: HeartsState): boolean {
  // Exactly one trick is "first" — no prior tricks have been taken by anyone.
  for (const pid of state.playerOrder) {
    if (state.tricksTaken[pid]!.length > 0) return false;
  }
  return true;
}

function hasOnlyHearts(hand: readonly Card[]): boolean {
  return hand.length > 0 && hand.every(isHeart);
}

/**
 * Validate that `card` is legal to play for `actor` right now. Returns a
 * rejection reason or null if the play is legal.
 */
function illegalPlayReason(state: HeartsState, card: Card, actor: PlayerId): string | null {
  const hand = state.hands[actor]!;
  if (!handContains(hand, card)) return "You don't have that card";

  const trick = state.currentTrick;
  const first = isFirstTrick(state);

  if (trick.length === 0) {
    // Leading a new trick.
    if (first) {
      if (!isTwoOfClubs(card)) return "The player holding 2♣ must lead it";
    } else {
      if (isHeart(card) && !state.heartsBroken && !hasOnlyHearts(hand)) {
        return "Hearts have not been broken";
      }
    }
  } else {
    // Following: must follow suit if possible.
    const lead = state.leadSuit!;
    if (card.suit !== lead && hasSuit(hand, lead)) {
      return `You must follow suit (${lead})`;
    }
    // No bleed on first trick: Q♠ and hearts forbidden unless you have nothing else.
    if (first) {
      if (isQueenOfSpades(card) || isHeart(card)) {
        const onlyBleeders = hand.every((c) => isQueenOfSpades(c) || isHeart(c));
        if (!onlyBleeders) return "No hearts or Q♠ on the first trick";
      }
    }
  }
  return null;
}

function resolveTrick(state: HeartsState): HeartsState {
  const trick = state.currentTrick;
  const lead = state.leadSuit!;
  let winner = trick[0]!;
  for (const entry of trick.slice(1)) {
    if (entry.card.suit === lead && entry.card.rank > winner.card.rank) {
      winner = entry;
    }
  }
  const nextTricks: Record<PlayerId, Card[][]> = { ...state.tricksTaken };
  nextTricks[winner.by] = [
    ...nextTricks[winner.by]!,
    trick.map((e) => e.card),
  ];

  const newHeartsBroken =
    state.heartsBroken || trick.some((e) => isHeart(e.card));

  const tricksPlayed = Object.values(nextTricks).reduce(
    (acc, piles) => acc + piles.length,
    0,
  );
  const done = tricksPlayed === HAND_SIZE;

  if (done) {
    // Score: 1 per heart taken, 13 per Q♠.
    const raw: Record<PlayerId, number> = {};
    for (const pid of state.playerOrder) {
      let s = 0;
      for (const pile of nextTricks[pid]!) {
        for (const c of pile) {
          if (isHeart(c)) s += 1;
          else if (isQueenOfSpades(c)) s += 13;
        }
      }
      raw[pid] = s;
    }
    const shooter = state.playerOrder.find((p) => raw[p] === TOTAL_PENALTY);
    const scores: Record<PlayerId, number> = {};
    if (shooter) {
      for (const pid of state.playerOrder) {
        scores[pid] = pid === shooter ? 0 : TOTAL_PENALTY;
      }
    } else {
      for (const pid of state.playerOrder) scores[pid] = raw[pid]!;
    }

    let minScore = Infinity;
    for (const pid of state.playerOrder) {
      if (scores[pid]! < minScore) minScore = scores[pid]!;
    }
    const lowest = state.playerOrder.filter((p) => scores[p] === minScore);
    const winnerId = lowest.length === 1 ? lowest[0]! : null;

    return {
      ...state,
      currentTrick: [],
      leadSuit: null,
      tricksTaken: nextTricks,
      heartsBroken: newHeartsBroken,
      current: null,
      phase: "gameOver",
      scores,
      winner: winnerId,
      isDraw: winnerId === null,
    };
  }

  return {
    ...state,
    currentTrick: [],
    leadSuit: null,
    tricksTaken: nextTricks,
    heartsBroken: newHeartsBroken,
    current: winner.by,
  };
}

function resolvePasses(state: HeartsState): HeartsState {
  const order = state.playerOrder;
  const newHands: Record<PlayerId, Card[]> = {};
  // First remove outgoing passes.
  for (const pid of order) {
    const outgoing = state.passed[pid]!;
    let hand = state.hands[pid]!.slice();
    for (const c of outgoing) {
      hand = removeCard(hand, c);
    }
    newHands[pid] = hand;
  }
  // Then distribute each player's pass to the seat to their left.
  for (const pid of order) {
    const dst = leftOf(order, pid);
    newHands[dst] = [...newHands[dst]!, ...state.passed[pid]!];
  }
  const leader = holderOfTwoOfClubs(newHands);
  if (!leader) {
    throw new Error("Invariant: no player holds 2♣ after dealing");
  }
  const clearedPasses: Record<PlayerId, Card[] | null> = {};
  for (const pid of order) clearedPasses[pid] = null;
  return {
    ...state,
    hands: newHands,
    passed: clearedPasses,
    phase: "playing",
    current: leader,
  };
}

export const heartsServerModule: GameModule<
  HeartsState,
  HeartsMove,
  HeartsConfig,
  HeartsView
> = {
  type: HEARTS_TYPE,
  displayName: "Hearts",
  description:
    "Shoot the moon or duck the queen — avoid hearts, dump the Q♠.",
  minPlayers: 4,
  maxPlayers: 4,

  defaultConfig(): HeartsConfig {
    return {};
  },

  validateConfig(cfg: unknown): HeartsConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: HeartsConfig,
    ctx: GameContext,
  ): HeartsState {
    if (players.length !== 4) {
      throw new Error(`hearts requires exactly 4 players, got ${players.length}`);
    }
    const order = players.map((p) => p.id);
    const deck = shuffle(FULL_DECK, ctx.rng);
    const hands: Record<PlayerId, Card[]> = {};
    order.forEach((pid, i) => {
      hands[pid] = deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE);
    });
    const passed: Record<PlayerId, Card[] | null> = {};
    const tricksTaken: Record<PlayerId, Card[][]> = {};
    const scores: Record<PlayerId, number> = {};
    for (const pid of order) {
      passed[pid] = null;
      tricksTaken[pid] = [];
      scores[pid] = 0;
    }
    return {
      phase: "passing",
      playerOrder: order,
      hands,
      passed,
      currentTrick: [],
      tricksTaken,
      heartsBroken: false,
      leadSuit: null,
      current: null,
      scores,
      winner: null,
      isDraw: false,
    };
  },

  handleMove(
    state: HeartsState,
    move: HeartsMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<HeartsState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") return { ok: false, reason: "Game is over" };
    if (!state.playerOrder.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    const m = parsed.data;

    if (m.kind === "pass") {
      if (state.phase !== "passing") {
        return { ok: false, reason: "Not in the passing phase" };
      }
      if (state.passed[actor]) {
        return { ok: false, reason: "You already passed" };
      }
      const hand = state.hands[actor]!;
      const seen = new Set<string>();
      for (const c of m.cards) {
        const k = cardKey(c);
        if (seen.has(k)) return { ok: false, reason: "Duplicate card in pass" };
        seen.add(k);
        if (!handContains(hand, c)) {
          return { ok: false, reason: "You don't have that card" };
        }
      }
      if (m.cards.length !== PASS_COUNT) {
        return { ok: false, reason: `Pass exactly ${PASS_COUNT} cards` };
      }
      const passed: Record<PlayerId, Card[] | null> = {
        ...state.passed,
        [actor]: m.cards.slice(),
      };
      const next: HeartsState = { ...state, passed };
      const allPassed = state.playerOrder.every((pid) => passed[pid]);
      if (allPassed) {
        return { ok: true, state: resolvePasses(next) };
      }
      return { ok: true, state: next };
    }

    // --- play ---
    if (state.phase !== "playing") {
      return { ok: false, reason: "Not in the playing phase" };
    }
    if (state.current !== actor) {
      return { ok: false, reason: "Not your turn" };
    }
    const reason = illegalPlayReason(state, m.card, actor);
    if (reason) return { ok: false, reason };

    const newHand = removeCard(state.hands[actor]!, m.card);
    const newHands: Record<PlayerId, Card[]> = {
      ...state.hands,
      [actor]: newHand,
    };
    const entry: TrickEntry = { by: actor, card: m.card };
    const trick = [...state.currentTrick, entry];
    const leadSuit = state.currentTrick.length === 0 ? m.card.suit : state.leadSuit;

    let next: HeartsState = {
      ...state,
      hands: newHands,
      currentTrick: trick,
      leadSuit,
      heartsBroken: state.heartsBroken || isHeart(m.card),
      current: leftOf(state.playerOrder, actor),
    };

    if (trick.length === 4) {
      next = resolveTrick(next);
    }
    return { ok: true, state: next };
  },

  view(state: HeartsState, viewer: Viewer): HeartsView {
    const isSpectator = viewer === "spectator";
    const terminal = state.phase === "gameOver";
    const viewerId = isSpectator ? null : viewer;

    const handSizes: Record<PlayerId, number> = {};
    for (const pid of state.playerOrder) {
      handSizes[pid] = state.hands[pid]!.length;
    }

    const passed: Record<PlayerId, boolean> = {};
    for (const pid of state.playerOrder) {
      passed[pid] = state.passed[pid] !== null;
    }

    const myHand: Card[] =
      viewerId && state.hands[viewerId] ? sortHand(state.hands[viewerId]!) : [];

    const myPass: Card[] | null =
      viewerId && state.passed[viewerId]
        ? state.passed[viewerId]!.slice()
        : null;

    // If passes have resolved (phase playing or later), compute received for viewer.
    // The receiver of player i's pass is leftOf(order, i). So receiver's "right
    // neighbor" passed to them; we can't read it from state.passed (cleared),
    // but we do NOT expose it here for simplicity — clients receive the cards
    // into their hand directly.
    const myReceived: Card[] | null = null;

    const tricksWonCount: Record<PlayerId, number> = {};
    for (const pid of state.playerOrder) {
      tricksWonCount[pid] = state.tricksTaken[pid]!.length;
    }

    const revealedTricks = terminal
      ? Object.fromEntries(
          state.playerOrder.map((pid) => [pid, state.tricksTaken[pid]!.map((pile) => pile.slice())]),
        )
      : null;

    return {
      phase: state.phase,
      playerOrder: [...state.playerOrder],
      hand: myHand,
      handSizes,
      passed,
      myPass,
      myReceived,
      currentTrick: state.currentTrick.map((e) => ({ ...e, card: { ...e.card } })),
      leadSuit: state.leadSuit,
      tricksWonCount,
      tricksTaken: revealedTricks,
      heartsBroken: state.heartsBroken,
      current: state.current,
      scores: { ...state.scores },
      winner: state.winner,
      isDraw: state.isDraw,
    };
  },

  phase(state: HeartsState): PhaseId {
    return state.phase;
  },

  currentActors(state: HeartsState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    if (state.phase === "passing") {
      return state.playerOrder.filter((pid) => state.passed[pid] === null);
    }
    return state.current ? [state.current] : [];
  },

  isTerminal(state: HeartsState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: HeartsState): Outcome | null {
    if (state.phase !== "gameOver") return null;
    if (state.isDraw) return { kind: "draw" };
    if (!state.winner) return { kind: "draw" };
    const losers = state.playerOrder.filter((p) => p !== state.winner);
    return { kind: "solo", winners: [state.winner], losers };
  },
};
