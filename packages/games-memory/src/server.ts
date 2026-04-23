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
  CARD_COUNT,
  MEMORY_TYPE,
  PAIR_COUNT,
  PEEK_MS,
  SYMBOLS,
  TIMER_KEY_PEEK,
  moveSchema,
  type MemoryCard,
  type MemoryCardView,
  type MemoryConfig,
  type MemoryMove,
  type MemoryState,
  type MemoryView,
} from "./shared";

function nextPlayer(order: readonly PlayerId[], current: PlayerId): PlayerId {
  const idx = order.indexOf(current);
  if (idx < 0) return order[0]!;
  return order[(idx + 1) % order.length]!;
}

function resolveTerminal(
  state: MemoryState,
): { winner: PlayerId | null; isDraw: boolean } {
  let best = -1;
  let winners: PlayerId[] = [];
  for (const pid of state.players) {
    const s = state.scores[pid] ?? 0;
    if (s > best) {
      best = s;
      winners = [pid];
    } else if (s === best) {
      winners.push(pid);
    }
  }
  if (winners.length === 1) return { winner: winners[0]!, isDraw: false };
  return { winner: null, isDraw: true };
}

function clearPeekAndAdvance(state: MemoryState): MemoryState {
  return {
    ...state,
    revealed: [],
    current: nextPlayer(state.players, state.current),
    phase: "playing",
  };
}

export const memoryServerModule: GameModule<
  MemoryState,
  MemoryMove,
  MemoryConfig,
  MemoryView
> = {
  type: MEMORY_TYPE,
  displayName: "Memory",
  description: "Flip two cards at a time — find pairs, remember the rest.",
  category: "classic",
  minPlayers: 2,
  maxPlayers: 4,

  defaultConfig(): MemoryConfig {
    return {};
  },

  validateConfig(cfg: unknown): MemoryConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: MemoryConfig,
    ctx: GameContext,
  ): MemoryState {
    if (players.length < 2 || players.length > 4) {
      throw new Error(
        `memory requires 2–4 players, got ${players.length}`,
      );
    }
    if (SYMBOLS.length < PAIR_COUNT) {
      throw new Error("memory: symbol set too small for PAIR_COUNT");
    }
    const pairs = SYMBOLS.slice(0, PAIR_COUNT).flatMap((s) => [s, s]);
    const deck = shuffle(pairs, ctx.rng);
    const cards: MemoryCard[] = deck.map((symbol) => ({
      symbol,
      owner: null,
    }));

    const order = players.map((p) => p.id);
    const startIdx = Math.floor(ctx.rng() * order.length);
    const current = order[startIdx]!;
    const scores: Record<PlayerId, number> = {};
    for (const pid of order) scores[pid] = 0;

    return {
      cards,
      revealed: [],
      players: order,
      current,
      scores,
      phase: "playing",
      lastFlipAt: ctx.now,
      winner: null,
      isDraw: false,
    };
  },

  handleMove(
    state: MemoryState,
    move: MemoryMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<MemoryState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };

    const m = parsed.data;

    if (m.kind === "clearPeek") {
      if (state.phase !== "peek") {
        return { ok: false, reason: "Nothing to dismiss" };
      }
      ctx.cancelTimer(TIMER_KEY_PEEK);
      return { ok: true, state: clearPeekAndAdvance(state) };
    }

    // kind === "flip"
    if (state.phase !== "playing") {
      return { ok: false, reason: "Dismiss the revealed pair first" };
    }
    const { cellIndex } = m;
    if (cellIndex < 0 || cellIndex >= CARD_COUNT) {
      return { ok: false, reason: "Card out of bounds" };
    }
    if (state.revealed.length >= 2) {
      return { ok: false, reason: "Two cards already flipped" };
    }
    const card = state.cards[cellIndex];
    if (!card) return { ok: false, reason: "Card out of bounds" };
    if (card.owner !== null) {
      return { ok: false, reason: "That pair has already been claimed" };
    }
    if (state.revealed.includes(cellIndex)) {
      return { ok: false, reason: "Card is already flipped" };
    }

    const revealed = [...state.revealed, cellIndex];

    if (revealed.length < 2) {
      return {
        ok: true,
        state: {
          ...state,
          revealed,
          lastFlipAt: ctx.now,
        },
      };
    }

    // Two cards now face-up: resolve match-or-miss.
    const [aIdx, bIdx] = revealed as [number, number];
    const a = state.cards[aIdx]!;
    const b = state.cards[bIdx]!;

    if (a.symbol === b.symbol) {
      const cards = state.cards.slice() as MemoryCard[];
      cards[aIdx] = { ...a, owner: actor };
      cards[bIdx] = { ...b, owner: actor };
      const scores = { ...state.scores, [actor]: (state.scores[actor] ?? 0) + 1 };
      const claimed = cards.every((c) => c.owner !== null);

      const base: MemoryState = {
        ...state,
        cards,
        revealed: [],
        scores,
        lastFlipAt: ctx.now,
      };

      if (claimed) {
        const end: MemoryState = { ...base, phase: "gameOver" };
        const { winner, isDraw } = resolveTerminal(end);
        return {
          ok: true,
          state: { ...end, winner, isDraw },
        };
      }

      // Match → same player goes again.
      return { ok: true, state: base };
    }

    // Miss → enter peek phase. Both cards stay revealed until the peek timer
    // fires or the current player sends `clearPeek`.
    ctx.scheduleTimer(TIMER_KEY_PEEK, ctx.now + PEEK_MS);
    return {
      ok: true,
      state: {
        ...state,
        revealed,
        lastFlipAt: ctx.now,
        phase: "peek",
      },
    };
  },

  onTimer(
    state: MemoryState,
    key: string,
    _ctx: GameContext,
  ): MoveResult<MemoryState> {
    if (key !== TIMER_KEY_PEEK) {
      return { ok: false, reason: `Unknown timer ${key}` };
    }
    if (state.phase !== "peek") {
      return { ok: false, reason: "Not in peek phase" };
    }
    return { ok: true, state: clearPeekAndAdvance(state) };
  },

  view(state: MemoryState, _viewer: Viewer): MemoryView {
    const revealedSet = new Set(state.revealed);
    const cards: MemoryCardView[] = state.cards.map((card, i) => {
      // A card's symbol is visible to everyone when (a) it's claimed
      // (owner != null), or (b) it's currently in the revealed list for this
      // turn. Otherwise it's face-down and the symbol is hidden.
      if (card.owner !== null || revealedSet.has(i)) {
        return { symbol: card.symbol, owner: card.owner };
      }
      return { symbol: null, owner: null };
    });
    return {
      cards,
      revealed: [...state.revealed],
      players: [...state.players],
      current: state.current,
      scores: { ...state.scores },
      phase: state.phase,
      peekMs: PEEK_MS,
      lastFlipAt: state.lastFlipAt,
      winner: state.winner,
      isDraw: state.isDraw,
    };
  },

  phase(state: MemoryState): PhaseId {
    return state.phase;
  },

  currentActors(state: MemoryState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return [state.current];
  },

  isTerminal(state: MemoryState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: MemoryState): Outcome | null {
    if (state.phase !== "gameOver") return null;
    if (state.isDraw) return { kind: "draw" };
    if (state.winner) {
      const losers = state.players.filter((id) => id !== state.winner);
      return { kind: "solo", winners: [state.winner], losers };
    }
    return null;
  },
};
