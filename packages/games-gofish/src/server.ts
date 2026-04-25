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
  GO_FISH_TYPE,
  RANKS,
  SUITS,
  moveSchema,
  type AskLogEntry,
  type Card,
  type GoFishConfig,
  type GoFishMove,
  type GoFishPlayerView,
  type GoFishState,
  type GoFishView,
  type Rank,
} from "./shared";

// ------------------------- Helpers -------------------------

function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      cards.push({ rank, suit });
    }
  }
  return cards;
}

function handDealSize(playerCount: number): number {
  return playerCount >= 4 ? 5 : 7;
}

/** Remove all cards of a given rank from `hand`, returning moved + remainder. */
function extractRank(
  hand: readonly Card[],
  rank: Rank,
): { moved: Card[]; kept: Card[] } {
  const moved: Card[] = [];
  const kept: Card[] = [];
  for (const c of hand) {
    if (c.rank === rank) moved.push(c);
    else kept.push(c);
  }
  return { moved, kept };
}

/** Count cards of each rank in a hand. */
function rankCounts(hand: readonly Card[]): Map<Rank, number> {
  const m = new Map<Rank, number>();
  for (const c of hand) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

/** Pull any newly-completed books out of a hand, returning the claimed ranks + trimmed hand. */
function harvestBooks(hand: readonly Card[]): {
  hand: Card[];
  claimed: Rank[];
} {
  const counts = rankCounts(hand);
  const claimed: Rank[] = [];
  for (const [rank, n] of counts) {
    if (n === 4) claimed.push(rank);
  }
  if (claimed.length === 0) return { hand: hand.slice(), claimed };
  const trimmed = hand.filter((c) => !claimed.includes(c.rank));
  return { hand: trimmed, claimed };
}

function nextPlayerFrom(
  players: readonly PlayerId[],
  from: PlayerId,
): PlayerId {
  const idx = players.indexOf(from);
  return players[(idx + 1) % players.length]!;
}

/** True if the game should end. */
function checkTerminal(state: GoFishState): boolean {
  const totalBooks = Object.values(state.books).reduce(
    (acc, b) => acc + b.length,
    0,
  );
  if (totalBooks >= RANKS.length) return true;
  // Game also ends when no one can act: deck empty AND every hand empty.
  if (state.deck.length === 0) {
    return state.players.every(
      (id) => (state.hands[id] ?? []).length === 0,
    );
  }
  return false;
}

/**
 * Settle the turn-start so the seat-of-play can actually play:
 *  - If the seat's hand is empty and the deck has cards, auto-draw one
 *    card so the player has something to ask with.
 *  - If the seat's hand is empty and the deck is also empty, skip to the
 *    next player who can act.
 *
 * Bounded by `players.length` to guarantee termination in the (already
 * terminal) "nobody can act" case — checkTerminal handles game-over.
 */
function settleTurnStart(
  start: PlayerId,
  players: readonly PlayerId[],
  hands: Record<PlayerId, Card[]>,
  deck: Card[],
): { current: PlayerId; deck: Card[] } {
  let current = start;
  let workingDeck = deck;
  for (let steps = 0; steps < players.length; steps++) {
    const hand = hands[current] ?? [];
    if (hand.length > 0) {
      return { current, deck: workingDeck };
    }
    if (workingDeck.length > 0) {
      const drawn = workingDeck[workingDeck.length - 1]!;
      workingDeck = workingDeck.slice(0, -1);
      hands[current] = [...hand, drawn];
      // Drawing a single card into an empty hand cannot complete a book,
      // so no harvest needed — they now hold exactly one card and can ask.
      return { current, deck: workingDeck };
    }
    // Hand empty AND deck empty — skip this player.
    current = nextPlayerFrom(players, current);
  }
  return { current, deck: workingDeck };
}

function winnersOf(state: GoFishState): PlayerId[] {
  let max = -1;
  const winners: PlayerId[] = [];
  for (const id of state.players) {
    const n = state.books[id]?.length ?? 0;
    if (n > max) {
      max = n;
      winners.length = 0;
      winners.push(id);
    } else if (n === max) {
      winners.push(id);
    }
  }
  return winners;
}

// ------------------------- Module -------------------------

export const goFishServerModule: GameModule<
  GoFishState,
  GoFishMove,
  GoFishConfig,
  GoFishView
> = {
  type: GO_FISH_TYPE,
  displayName: "Go Fish",
  description: "Collect four of a kind by asking — or go fish.",
  category: "cards-dice",
  minPlayers: 2,
  maxPlayers: 6,

  defaultConfig(): GoFishConfig {
    return {};
  },

  validateConfig(cfg: unknown): GoFishConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: GoFishConfig,
    ctx: GameContext,
  ): GoFishState {
    if (players.length < 2 || players.length > 6) {
      throw new Error(
        `Go Fish requires 2–6 players, got ${players.length}`,
      );
    }

    const order = players.map((p) => p.id);
    const deck = shuffle(buildDeck(), ctx.rng);
    const dealSize = handDealSize(order.length);

    const hands: Record<PlayerId, Card[]> = {};
    const books: Record<PlayerId, Rank[]> = {};
    for (const id of order) {
      hands[id] = [];
      books[id] = [];
    }
    // Deal round-robin so the distribution is even if deck size ever changes.
    for (let round = 0; round < dealSize; round++) {
      for (const id of order) {
        const card = deck.shift();
        if (card) hands[id]!.push(card);
      }
    }

    // Any rank that happens to have been dealt as a complete set becomes
    // an immediate book for that player.
    for (const id of order) {
      const { hand, claimed } = harvestBooks(hands[id]!);
      hands[id] = hand;
      if (claimed.length > 0) books[id] = [...books[id]!, ...claimed];
    }

    // If the opening hand-out happened to leave the first seat empty
    // (e.g. they were dealt a single complete book), make sure they can
    // still act on turn one.
    const settled = settleTurnStart(order[0]!, order, hands, deck);

    return {
      players: order,
      hands,
      books,
      deck: settled.deck,
      current: settled.current,
      phase: "play",
      lastAction: null,
    };
  },

  handleMove(
    state: GoFishState,
    move: GoFishMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<GoFishState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    if (state.current !== actor) {
      return { ok: false, reason: "Not your turn" };
    }

    const data = parsed.data;
    if (data.kind !== "ask") return { ok: false, reason: "Unknown move" };

    const { targetPlayer, rank } = data;
    if (targetPlayer === actor) {
      return { ok: false, reason: "You cannot ask yourself" };
    }
    if (!state.players.includes(targetPlayer)) {
      return { ok: false, reason: "Target is not in this match" };
    }

    const actorHand = state.hands[actor] ?? [];
    const targetHand = state.hands[targetPlayer] ?? [];

    // Rule: you can only ask for a rank you already hold at least one of.
    if (!actorHand.some((c) => c.rank === rank)) {
      return { ok: false, reason: "You must hold a card of that rank to ask" };
    }

    const hands: Record<PlayerId, Card[]> = { ...state.hands };
    const books: Record<PlayerId, Rank[]> = { ...state.books };
    let deck = state.deck.slice();
    let gotCount = 0;
    let drewMatched: boolean | null = null;

    const { moved, kept } = extractRank(targetHand, rank);
    if (moved.length > 0) {
      // Transfer to asker.
      hands[targetPlayer] = kept;
      hands[actor] = [...actorHand, ...moved];
      gotCount = moved.length;
    } else {
      // "Go fish" — draw one from the pile if available.
      if (deck.length > 0) {
        const drawn = deck[deck.length - 1]!;
        deck = deck.slice(0, -1);
        hands[actor] = [...actorHand, drawn];
        drewMatched = drawn.rank === rank;
      }
    }

    // Harvest any books the asker completed (either via transfer or a lucky draw).
    const harvested = harvestBooks(hands[actor]!);
    hands[actor] = harvested.hand;
    if (harvested.claimed.length > 0) {
      books[actor] = [...(books[actor] ?? []), ...harvested.claimed];
    }

    // Turn passes unless the asker got cards or drew the requested rank.
    const continuesTurn =
      gotCount > 0 || drewMatched === true;
    const nextCurrent = continuesTurn
      ? actor
      : nextPlayerFrom(state.players, actor);

    // Settle turn-start: if the next-up seat is empty-handed but the deck
    // has cards, they auto-draw; if both are empty, skip to a seat that
    // can still act. Avoids the soft-lock where every ask is rejected
    // because the active player holds nothing.
    const settled = settleTurnStart(
      nextCurrent,
      state.players,
      hands,
      deck,
    );

    const lastAction: AskLogEntry = {
      kind: "ask",
      asker: actor,
      target: targetPlayer,
      rank,
      gotCount,
      ...(drewMatched !== null ? { drew: { matched: drewMatched } } : {}),
      booksClaimed: harvested.claimed,
    };

    let nextState: GoFishState = {
      ...state,
      hands,
      books,
      deck: settled.deck,
      current: settled.current,
      lastAction,
    };

    if (checkTerminal(nextState)) {
      nextState = { ...nextState, phase: "gameOver" };
    }

    return { ok: true, state: nextState };
  },

  view(state: GoFishState, viewer: Viewer): GoFishView {
    const isTerminal = state.phase === "gameOver";
    const isSpectator = viewer === "spectator";

    const perPlayer: Record<PlayerId, GoFishPlayerView> = {};
    for (const id of state.players) {
      const hand = state.hands[id] ?? [];
      // Full hands are revealed only to the owning player, or to everyone
      // once the match is over.
      const showHand = isTerminal || (!isSpectator && id === viewer);
      perPlayer[id] = {
        id,
        hand: showHand ? hand.map((c) => ({ ...c })) : null,
        handCount: hand.length,
        books: [...(state.books[id] ?? [])],
      };
    }

    return {
      phase: state.phase,
      players: [...state.players],
      current: state.current,
      deckCount: state.deck.length,
      perPlayer,
      lastAction: state.lastAction
        ? {
            ...state.lastAction,
            booksClaimed: [...state.lastAction.booksClaimed],
          }
        : null,
      winners: isTerminal ? winnersOf(state) : null,
    };
  },

  phase(state: GoFishState): PhaseId {
    return state.phase;
  },

  currentActors(state: GoFishState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return [state.current];
  },

  isTerminal(state: GoFishState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: GoFishState): Outcome | null {
    if (state.phase !== "gameOver") return null;
    const winners = winnersOf(state);
    if (winners.length === 0) return { kind: "draw" };
    if (winners.length === state.players.length) {
      // Everyone tied — zero books all round, treat as draw.
      const allZero = state.players.every(
        (id) => (state.books[id]?.length ?? 0) === 0,
      );
      if (allZero) return { kind: "draw" };
    }
    const losers = state.players.filter((id) => !winners.includes(id));
    return { kind: "solo", winners, losers };
  },
};
