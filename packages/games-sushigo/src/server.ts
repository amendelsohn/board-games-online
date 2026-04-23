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
  DECK_COUNTS,
  HAND_SIZE,
  ROUNDS,
  SUSHIGO_TYPE,
  isNigiri,
  moveSchema,
  scorePuddings,
  scoreRound,
  type Card,
  type CardKind,
  type SushiConfig,
  type SushiMove,
  type SushiPlayerPublic,
  type SushiRoundResult,
  type SushiState,
  type SushiView,
} from "./shared";

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function buildDeck(rng: () => number): Card[] {
  const cards: Card[] = [];
  let counter = 0;
  for (const [kind, count] of Object.entries(DECK_COUNTS) as Array<
    [CardKind, number]
  >) {
    for (let i = 0; i < count; i++) {
      cards.push({ id: `${kind}#${counter++}`, kind });
    }
  }
  return shuffled(cards, rng);
}

function dealNewRound(
  state: SushiState,
  ctx: GameContext,
): SushiState {
  const handSize = HAND_SIZE[state.players.length] ?? 8;
  let deck = state.deck;
  // Reshuffle if undersized.
  const needed = handSize * state.players.length;
  if (deck.length < needed) {
    deck = buildDeck(ctx.rng);
  }
  const hands: Record<PlayerId, Card[]> = {};
  let i = 0;
  for (const id of state.players) {
    hands[id] = deck.slice(i, i + handSize);
    i += handSize;
  }
  const remaining = deck.slice(i);
  const played: Record<PlayerId, Card[]> = {};
  const picks: Record<PlayerId, null> = {};
  const chopsticksReady: Record<PlayerId, boolean> = {};
  for (const id of state.players) {
    played[id] = [];
    picks[id] = null;
    chopsticksReady[id] = false;
  }
  return {
    ...state,
    deck: remaining,
    hands,
    played,
    picks,
    chopsticksReady,
    phase: "pick",
  };
}

function rotateHands(state: SushiState): Record<PlayerId, Card[]> {
  // Pass left = each seat gets the previous seat's hand.
  const n = state.players.length;
  const out: Record<PlayerId, Card[]> = {};
  for (let i = 0; i < n; i++) {
    const prev = state.players[(i - 1 + n) % n]!;
    const me = state.players[i]!;
    out[me] = state.hands[prev] ?? [];
  }
  return out;
}

function applyPicks(state: SushiState): SushiState {
  const newPlayed: Record<PlayerId, Card[]> = { ...state.played };
  const newHands: Record<PlayerId, Card[]> = { ...state.hands };
  const newChopsticks: Record<PlayerId, boolean> = {
    ...state.chopsticksReady,
  };
  for (const id of state.players) {
    const pick = state.picks[id];
    if (!pick) continue;
    const hand = [...newHands[id]!];
    const playedSet = [...(newPlayed[id] ?? [])];
    const primary = hand.find((c) => c.id === pick.primary);
    if (!primary) continue;
    hand.splice(hand.indexOf(primary), 1);
    playedSet.push(primary);

    if (pick.secondary !== undefined) {
      const second = hand.find((c) => c.id === pick.secondary);
      if (second) {
        hand.splice(hand.indexOf(second), 1);
        playedSet.push(second);
        // Return chopsticks to hand
        const chopIdx = playedSet.findIndex((c) => c.kind === "chopsticks");
        if (chopIdx >= 0) {
          const chop = playedSet[chopIdx]!;
          playedSet.splice(chopIdx, 1);
          hand.push(chop);
        }
      }
    }
    newPlayed[id] = playedSet;
    newHands[id] = hand;
    // Refresh chopsticks-ready: true if you have any chopsticks already played.
    newChopsticks[id] = playedSet.some((c) => c.kind === "chopsticks");
  }
  return {
    ...state,
    played: newPlayed,
    hands: newHands,
    chopsticksReady: newChopsticks,
  };
}

function endRoundIfHandsEmpty(
  state: SushiState,
  ctx: GameContext,
): SushiState {
  const handSizesEqual = state.players.every(
    (id) => (state.hands[id] ?? []).length === 0,
  );
  if (!handSizesEqual) {
    // Pass hands left, clear picks for next pick.
    const passed = rotateHands(state);
    const picks: Record<PlayerId, null> = {};
    for (const id of state.players) picks[id] = null;
    return { ...state, hands: passed, picks };
  }

  // Score the round.
  const { perPlayer } = scoreRound(state.played);
  const breakdown: SushiRoundResult["breakdown"] = {};
  const newScores: Record<PlayerId, number> = { ...state.scores };
  const newPuddings: Record<PlayerId, number> = { ...state.puddings };
  for (const id of state.players) {
    const b = perPlayer[id] ?? {
      tempura: 0,
      sashimi: 0,
      dumpling: 0,
      maki: 0,
      nigiri: 0,
      total: 0,
    };
    breakdown[id] = b;
    newScores[id] = (newScores[id] ?? 0) + b.total;
    const cards = state.played[id] ?? [];
    const pud = cards.filter((c) => c.kind === "pudding").length;
    newPuddings[id] = (newPuddings[id] ?? 0) + pud;
  }

  if (state.round >= ROUNDS) {
    // Final round — apply pudding totals, then game over.
    const puddingDelta = scorePuddings(newPuddings, state.players.length);
    for (const id of state.players) {
      newScores[id] = (newScores[id] ?? 0) + (puddingDelta[id] ?? 0);
    }
    const top = Math.max(...Object.values(newScores));
    const winners = state.players.filter((id) => newScores[id] === top);
    return {
      ...state,
      scores: newScores,
      puddings: newPuddings,
      lastRoundResult: {
        round: state.round,
        breakdown,
        puddingTotal: { ...newPuddings },
      },
      finalScores: { ...newScores },
      winners,
      phase: "gameOver",
      hands: Object.fromEntries(state.players.map((id) => [id, []])),
      played: Object.fromEntries(state.players.map((id) => [id, []])),
    };
  }

  // Roll into next round (deal afresh).
  const nextState: SushiState = {
    ...state,
    round: state.round + 1,
    scores: newScores,
    puddings: newPuddings,
    lastRoundResult: { round: state.round, breakdown },
  };
  return dealNewRound(nextState, ctx);
}

function buildSeats(
  state: SushiState,
  viewer: Viewer,
): Record<PlayerId, SushiPlayerPublic> {
  const out: Record<PlayerId, SushiPlayerPublic> = {};
  for (const id of state.players) {
    out[id] = {
      id,
      played: [...(state.played[id] ?? [])],
      score: state.scores[id] ?? 0,
      puddings: state.puddings[id] ?? 0,
      handSize: (state.hands[id] ?? []).length,
      hasPicked: state.picks[id] !== null,
    };
  }
  void viewer;
  return out;
}

export const sushiGoServerModule: GameModule<
  SushiState,
  SushiMove,
  SushiConfig,
  SushiView
> = {
  type: SUSHIGO_TYPE,
  displayName: "Sushi Go!",
  description:
    "Pass-the-hand drafting. Score sushi sets across three rounds — pudding decides the day.",
  category: "cards-dice",
  minPlayers: 2,
  maxPlayers: 5,

  defaultConfig(): SushiConfig {
    return {};
  },

  validateConfig(cfg: unknown): SushiConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: SushiConfig,
    ctx: GameContext,
  ): SushiState {
    if (players.length < 2 || players.length > 5) {
      throw new Error(`Sushi Go! requires 2–5 players, got ${players.length}`);
    }
    const seated = players.map((p) => p.id);
    const initial: SushiState = {
      players: seated,
      round: 1,
      deck: buildDeck(ctx.rng),
      hands: Object.fromEntries(seated.map((id) => [id, []])) as Record<
        PlayerId,
        Card[]
      >,
      played: Object.fromEntries(seated.map((id) => [id, []])) as Record<
        PlayerId,
        Card[]
      >,
      puddings: Object.fromEntries(seated.map((id) => [id, 0])) as Record<
        PlayerId,
        number
      >,
      scores: Object.fromEntries(seated.map((id) => [id, 0])) as Record<
        PlayerId,
        number
      >,
      picks: Object.fromEntries(seated.map((id) => [id, null])) as Record<
        PlayerId,
        null
      >,
      chopsticksReady: Object.fromEntries(seated.map((id) => [id, false])) as Record<
        PlayerId,
        boolean
      >,
      phase: "pick",
      lastRoundResult: null,
      finalScores: null,
      winners: null,
    };
    return dealNewRound(initial, ctx);
  },

  handleMove(
    state: SushiState,
    move: SushiMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<SushiState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase !== "pick") return { ok: false, reason: "Not picking now" };
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    if (state.picks[actor]) {
      return { ok: false, reason: "You already picked this turn" };
    }

    const m = parsed.data;
    const hand = state.hands[actor] ?? [];
    const primary = hand.find((c) => c.id === m.cardId);
    if (!primary) return { ok: false, reason: "Card not in hand" };

    if (m.secondCardId !== undefined) {
      if (!state.chopsticksReady[actor]) {
        return {
          ok: false,
          reason: "No chopsticks ready to spend",
        };
      }
      if (m.secondCardId === m.cardId) {
        return { ok: false, reason: "Pick two different cards" };
      }
      const second = hand.find((c) => c.id === m.secondCardId);
      if (!second) {
        return { ok: false, reason: "Second card not in hand" };
      }
    }

    const nextPicks: SushiState["picks"] = {
      ...state.picks,
      [actor]: {
        primary: m.cardId,
        secondary: m.secondCardId,
      },
    };
    let next: SushiState = { ...state, picks: nextPicks };
    // If everyone has picked, resolve.
    const everyone = state.players.every(
      (id) => nextPicks[id] !== null,
    );
    if (everyone) {
      next = applyPicks(next);
      next = endRoundIfHandsEmpty(next, ctx);
    }
    return { ok: true, state: next };
  },

  view(state: SushiState, viewer: Viewer): SushiView {
    const seats = buildSeats(state, viewer);
    const isSpectator = viewer === "spectator";

    const myHand = !isSpectator
      ? [...(state.hands[viewer] ?? [])]
      : null;

    const iHavePicked =
      !isSpectator && state.picks[viewer] !== null;

    // "Wasabi pending" = there's an unclaimed Wasabi played, with no nigiri
    // played after it. Useful for the UI to highlight your nigiri pick value.
    const myPlayed = state.played[viewer as string] ?? [];
    let wasabiOpen = 0;
    for (const c of myPlayed) {
      if (c.kind === "wasabi") wasabiOpen++;
      else if (isNigiri(c.kind) && wasabiOpen > 0) wasabiOpen--;
    }
    const iHaveWasabiPending = wasabiOpen > 0;

    return {
      players: [...state.players],
      round: state.round,
      phase: state.phase,
      myHand,
      seats,
      lastRevealed:
        state.phase === "scoring" || state.phase === "gameOver"
          ? Object.fromEntries(
              state.players.map((id) => [id, [...(state.played[id] ?? [])]]),
            )
          : null,
      lastRoundResult: state.lastRoundResult ?? null,
      finalScores: state.finalScores ? { ...state.finalScores } : null,
      winners: state.winners ? [...state.winners] : null,
      me: isSpectator ? null : viewer,
      iHavePicked,
      iHaveWasabiPending,
      iCanUseChopsticks:
        !isSpectator && (state.chopsticksReady[viewer] ?? false),
    };
  },

  phase(state: SushiState): PhaseId {
    return state.phase;
  },

  currentActors(state: SushiState): PlayerId[] {
    if (state.phase !== "pick") return [];
    return state.players.filter((id) => state.picks[id] === null);
  },

  isTerminal(state: SushiState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: SushiState): Outcome | null {
    if (!state.winners) return null;
    const losers = state.players.filter((id) => !state.winners!.includes(id));
    return { kind: "solo", winners: [...state.winners], losers };
  },
};
