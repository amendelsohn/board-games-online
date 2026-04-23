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
  CARDS_REMOVED,
  CARD_MAX,
  CARD_MIN,
  NOTHANKS_TYPE,
  moveSchema,
  scoreCards,
  startingChips,
  type NoThanksConfig,
  type NoThanksMove,
  type NoThanksPlayerPublic,
  type NoThanksState,
  type NoThanksView,
} from "./shared";

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function nextSeat(players: PlayerId[], from: PlayerId): PlayerId {
  const i = players.indexOf(from);
  if (i === -1) return players[0]!;
  return players[(i + 1) % players.length]!;
}

function buildSeats(state: NoThanksState): Record<PlayerId, NoThanksPlayerPublic> {
  const out: Record<PlayerId, NoThanksPlayerPublic> = {};
  for (const id of state.players) {
    const cards = [...(state.cards[id] ?? [])].sort((a, b) => a - b);
    out[id] = {
      id,
      cards,
      chips: state.chips[id] ?? 0,
      score: state.finalScores ? state.finalScores[id] ?? null : null,
    };
  }
  return out;
}

function endGame(state: NoThanksState): NoThanksState {
  const finalScores: Record<PlayerId, number> = {};
  for (const id of state.players) {
    finalScores[id] = scoreCards(state.cards[id] ?? [], state.chips[id] ?? 0);
  }
  // Lowest score wins; ties share the win.
  const lowest = Math.min(...Object.values(finalScores));
  const winners = state.players.filter((id) => finalScores[id] === lowest);
  return {
    ...state,
    phase: "gameOver",
    currentCard: null,
    chipsOnCard: 0,
    finalScores,
    winners,
  };
}

export const noThanksServerModule: GameModule<
  NoThanksState,
  NoThanksMove,
  NoThanksConfig,
  NoThanksView
> = {
  type: NOTHANKS_TYPE,
  displayName: "No Thanks!",
  description:
    "Take the card or pay a chip to pass. Lowest score wins — runs only count once.",
  category: "cards-dice",
  minPlayers: 3,
  maxPlayers: 7,

  defaultConfig(): NoThanksConfig {
    return {};
  },

  validateConfig(cfg: unknown): NoThanksConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: NoThanksConfig,
    ctx: GameContext,
  ): NoThanksState {
    if (players.length < 3 || players.length > 7) {
      throw new Error(`No Thanks! requires 3–7 players, got ${players.length}`);
    }
    const seated = players.map((p) => p.id);

    // Build full deck, shuffle, drop 9.
    const all: number[] = [];
    for (let v = CARD_MIN; v <= CARD_MAX; v++) all.push(v);
    const shuffledDeck = shuffled(all, ctx.rng);
    const deck = shuffledDeck.slice(CARDS_REMOVED);
    const startingCard = deck.shift() ?? null;

    const chips: Record<PlayerId, number> = {};
    const cards: Record<PlayerId, number[]> = {};
    const startChips = startingChips(seated.length);
    for (const id of seated) {
      chips[id] = startChips;
      cards[id] = [];
    }

    const first = seated[Math.floor(ctx.rng() * seated.length)]!;

    return {
      players: seated,
      deck,
      currentCard: startingCard,
      chipsOnCard: 0,
      chips,
      cards,
      current: first,
      phase: "play",
      lastAction: null,
      finalScores: null,
      winners: null,
    };
  },

  handleMove(
    state: NoThanksState,
    move: NoThanksMove,
    actor: PlayerId,
  ): MoveResult<NoThanksState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase !== "play") return { ok: false, reason: "Game is over" };
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    if (state.current !== actor) {
      return { ok: false, reason: "Not your turn" };
    }
    if (state.currentCard === null) {
      return { ok: false, reason: "No card on offer" };
    }

    const m = parsed.data;
    const card = state.currentCard;

    if (m.kind === "pass") {
      const myChips = state.chips[actor] ?? 0;
      if (myChips <= 0) {
        return { ok: false, reason: "No chips to pass" };
      }
      const nextChips = { ...state.chips, [actor]: myChips - 1 };
      const nextChipsOnCard = state.chipsOnCard + 1;
      return {
        ok: true,
        state: {
          ...state,
          chips: nextChips,
          chipsOnCard: nextChipsOnCard,
          current: nextSeat(state.players, actor),
          lastAction: { kind: "pass", by: actor, card, chipsAdded: 1 },
        },
      };
    }

    // take
    const taken = card;
    const chipsTaken = state.chipsOnCard;
    const myCards = [...(state.cards[actor] ?? []), taken];
    const myChips = (state.chips[actor] ?? 0) + chipsTaken;
    const nextCards = { ...state.cards, [actor]: myCards };
    const nextChips = { ...state.chips, [actor]: myChips };

    if (state.deck.length === 0) {
      // Deck exhausted — end immediately after this take.
      return {
        ok: true,
        state: endGame({
          ...state,
          cards: nextCards,
          chips: nextChips,
          currentCard: null,
          chipsOnCard: 0,
          lastAction: { kind: "take", by: actor, card: taken, chipsTaken },
        }),
      };
    }

    const newDeck = state.deck.slice(1);
    const next = state.deck[0]!;
    return {
      ok: true,
      state: {
        ...state,
        deck: newDeck,
        currentCard: next,
        chipsOnCard: 0,
        cards: nextCards,
        chips: nextChips,
        // Whoever takes the card opens the next offer.
        current: actor,
        lastAction: { kind: "take", by: actor, card: taken, chipsTaken },
      },
    };
  },

  view(state: NoThanksState, viewer: Viewer): NoThanksView {
    const seats = buildSeats(state);
    return {
      players: [...state.players],
      currentCard: state.currentCard,
      chipsOnCard: state.chipsOnCard,
      deckCount: state.deck.length,
      seats,
      current: state.current,
      phase: state.phase,
      finalScores: state.finalScores ? { ...state.finalScores } : null,
      winners: state.winners ? [...state.winners] : null,
      lastAction: state.lastAction,
      me: viewer === "spectator" ? null : viewer,
    };
  },

  phase(state: NoThanksState): PhaseId {
    return state.phase;
  },

  currentActors(state: NoThanksState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return [state.current];
  },

  isTerminal(state: NoThanksState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: NoThanksState): Outcome | null {
    if (!state.winners) return null;
    const losers = state.players.filter((id) => !state.winners!.includes(id));
    return { kind: "solo", winners: [...state.winners], losers };
  },
};
