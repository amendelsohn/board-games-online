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
  COLORS,
  FUSE_TOKENS_MAX,
  HANABI_TYPE,
  INFO_TOKENS_MAX,
  RANKS,
  RANK_COUNTS,
  emptyStacks,
  freshKnowledge,
  handSize,
  moveSchema,
  scoreFireworks,
  type CardKnowledge,
  type HanabiCard,
  type HanabiColor,
  type HanabiConfig,
  type HanabiHandCardView,
  type HanabiMove,
  type HanabiRank,
  type HanabiState,
  type HanabiView,
} from "./shared";

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function buildDeck(rng: () => number): HanabiCard[] {
  const cards: HanabiCard[] = [];
  let counter = 0;
  for (const color of COLORS) {
    for (const rank of RANKS) {
      const count = RANK_COUNTS[rank];
      for (let i = 0; i < count; i++) {
        cards.push({ id: `${color}-${rank}-${counter++}`, color, rank });
      }
    }
  }
  return shuffled(cards, rng);
}

function nextSeat(players: PlayerId[], from: PlayerId): PlayerId {
  const i = players.indexOf(from);
  if (i === -1) return players[0]!;
  return players[(i + 1) % players.length]!;
}

function dealHand(deck: HanabiCard[], n: number): {
  hand: HanabiCard[];
  rest: HanabiCard[];
} {
  return { hand: deck.slice(0, n), rest: deck.slice(n) };
}

function applyHintToCard(
  k: CardKnowledge,
  hint:
    | { type: "color"; color: HanabiColor }
    | { type: "rank"; rank: HanabiRank },
  matched: boolean,
): CardKnowledge {
  if (hint.type === "color") {
    if (matched) {
      return {
        ...k,
        possibleColors: [hint.color],
        toldColors: k.toldColors.includes(hint.color)
          ? k.toldColors
          : [...k.toldColors, hint.color],
      };
    }
    return {
      ...k,
      possibleColors: k.possibleColors.filter((c) => c !== hint.color),
    };
  }
  // rank
  if (matched) {
    return {
      ...k,
      possibleRanks: [hint.rank],
      toldRanks: k.toldRanks.includes(hint.rank)
        ? k.toldRanks
        : [...k.toldRanks, hint.rank],
    };
  }
  return {
    ...k,
    possibleRanks: k.possibleRanks.filter((r) => r !== hint.rank),
  };
}

function endIfTerminal(state: HanabiState): HanabiState {
  // Fuses out → game over with 0 score (rule variant: score still counts —
  // we use the strict variant: 3rd fuse = 0 score, end immediately).
  if (state.fuses >= FUSE_TOKENS_MAX) {
    return {
      ...state,
      phase: "gameOver",
      score: 0,
    };
  }
  // All fives played → max score.
  const score = scoreFireworks(state.played);
  if (score === COLORS.length * 5) {
    return {
      ...state,
      phase: "gameOver",
      score,
    };
  }
  // Final round counter exhausted.
  if (state.finalRoundTurnsLeft === 0) {
    return {
      ...state,
      phase: "gameOver",
      score,
    };
  }
  return state;
}

function maybeStartFinalCountdown(state: HanabiState): HanabiState {
  if (state.deck.length === 0 && state.finalRoundTurnsLeft < 0) {
    return { ...state, finalRoundTurnsLeft: state.players.length };
  }
  return state;
}

function decFinalCountdown(state: HanabiState): HanabiState {
  if (state.finalRoundTurnsLeft > 0) {
    return { ...state, finalRoundTurnsLeft: state.finalRoundTurnsLeft - 1 };
  }
  return state;
}

export const hanabiServerModule: GameModule<
  HanabiState,
  HanabiMove,
  HanabiConfig,
  HanabiView
> = {
  type: HANABI_TYPE,
  displayName: "Hanabi",
  description:
    "Co-op fireworks. You see everyone's hand but your own — give clues, play your gut.",
  category: "cards-dice",
  minPlayers: 2,
  maxPlayers: 5,

  defaultConfig(): HanabiConfig {
    return {};
  },

  validateConfig(cfg: unknown): HanabiConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: HanabiConfig,
    ctx: GameContext,
  ): HanabiState {
    if (players.length < 2 || players.length > 5) {
      throw new Error(`Hanabi requires 2–5 players, got ${players.length}`);
    }
    const seated = players.map((p) => p.id);
    let deck = buildDeck(ctx.rng);
    const hands: Record<PlayerId, HanabiCard[]> = {};
    const knowledge: Record<string, CardKnowledge> = {};
    const hs = handSize(seated.length);
    for (const id of seated) {
      const dealt = dealHand(deck, hs);
      hands[id] = dealt.hand;
      deck = dealt.rest;
      for (const c of dealt.hand) knowledge[c.id] = freshKnowledge();
    }
    const first = seated[Math.floor(ctx.rng() * seated.length)]!;
    return {
      players: seated,
      hands,
      knowledge,
      deck,
      played: emptyStacks(),
      discard: [],
      info: INFO_TOKENS_MAX,
      fuses: 0,
      current: first,
      phase: "play",
      finalRoundTurnsLeft: -1,
      score: null,
      lastAction: null,
    };
  },

  handleMove(
    state: HanabiState,
    move: HanabiMove,
    actor: PlayerId,
  ): MoveResult<HanabiState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase !== "play") return { ok: false, reason: "Game is over" };
    if (state.current !== actor) {
      return { ok: false, reason: "Not your turn" };
    }
    const m = parsed.data;
    const myHand = state.hands[actor] ?? [];

    if (m.kind === "play" || m.kind === "discard") {
      if (m.slot < 0 || m.slot >= myHand.length) {
        return { ok: false, reason: "Invalid slot" };
      }
      const card = myHand[m.slot]!;
      // Remove card from hand, draw replacement if any.
      const handAfter = [...myHand];
      handAfter.splice(m.slot, 1);
      let newDeck = state.deck;
      let drew: HanabiCard | null = null;
      if (newDeck.length > 0) {
        drew = newDeck[0]!;
        newDeck = newDeck.slice(1);
        handAfter.push(drew);
      }

      const newKnowledge = { ...state.knowledge };
      delete newKnowledge[card.id];
      if (drew) newKnowledge[drew.id] = freshKnowledge();

      if (m.kind === "play") {
        const top = state.played[card.color] ?? 0;
        const success = card.rank === ((top as number) + 1);
        const newPlayed = { ...state.played };
        let newDiscard = state.discard;
        let newFuses = state.fuses;
        let newInfo = state.info;
        if (success) {
          newPlayed[card.color] = card.rank;
          if (card.rank === 5 && newInfo < INFO_TOKENS_MAX) {
            newInfo += 1; // Completing a 5 returns an info token.
          }
        } else {
          newDiscard = [...state.discard, card];
          newFuses += 1;
        }
        let next: HanabiState = {
          ...state,
          hands: { ...state.hands, [actor]: handAfter },
          deck: newDeck,
          knowledge: newKnowledge,
          played: newPlayed,
          discard: newDiscard,
          info: newInfo,
          fuses: newFuses,
          current: nextSeat(state.players, actor),
          lastAction: {
            kind: "play",
            by: actor,
            card,
            slot: m.slot,
            success,
            drew,
          },
        };
        next = maybeStartFinalCountdown(next);
        next = decFinalCountdown(next);
        next = endIfTerminal(next);
        return { ok: true, state: next };
      }

      // discard
      if (state.info >= INFO_TOKENS_MAX) {
        return {
          ok: false,
          reason: "All info tokens are available — can't discard",
        };
      }
      let next: HanabiState = {
        ...state,
        hands: { ...state.hands, [actor]: handAfter },
        deck: newDeck,
        knowledge: newKnowledge,
        discard: [...state.discard, card],
        info: state.info + 1,
        current: nextSeat(state.players, actor),
        lastAction: {
          kind: "discard",
          by: actor,
          card,
          slot: m.slot,
          drew,
        },
      };
      next = maybeStartFinalCountdown(next);
      next = decFinalCountdown(next);
      next = endIfTerminal(next);
      return { ok: true, state: next };
    }

    // hint
    if (state.info <= 0) {
      return { ok: false, reason: "No info tokens" };
    }
    if (m.target === actor) {
      return { ok: false, reason: "Hint someone else" };
    }
    if (!state.players.includes(m.target)) {
      return { ok: false, reason: "Unknown target" };
    }
    const targetHand = state.hands[m.target] ?? [];
    const newKnowledge = { ...state.knowledge };
    let positions: number[] = [];
    if (m.kind === "hintColor") {
      positions = targetHand
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.color === m.color)
        .map(({ i }) => i);
      if (positions.length === 0) {
        return {
          ok: false,
          reason: "Hint must touch at least one card",
        };
      }
      for (const c of targetHand) {
        const k = newKnowledge[c.id] ?? freshKnowledge();
        newKnowledge[c.id] = applyHintToCard(
          k,
          { type: "color", color: m.color },
          c.color === m.color,
        );
      }
    } else {
      positions = targetHand
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.rank === m.rank)
        .map(({ i }) => i);
      if (positions.length === 0) {
        return {
          ok: false,
          reason: "Hint must touch at least one card",
        };
      }
      for (const c of targetHand) {
        const k = newKnowledge[c.id] ?? freshKnowledge();
        newKnowledge[c.id] = applyHintToCard(
          k,
          { type: "rank", rank: m.rank },
          c.rank === m.rank,
        );
      }
    }
    let next: HanabiState = {
      ...state,
      knowledge: newKnowledge,
      info: state.info - 1,
      current: nextSeat(state.players, actor),
      lastAction: {
        kind: "hint",
        by: actor,
        target: m.target,
        hint:
          m.kind === "hintColor"
            ? { type: "color", color: m.color }
            : { type: "rank", rank: m.rank },
        positions,
      },
    };
    next = maybeStartFinalCountdown(next);
    next = decFinalCountdown(next);
    next = endIfTerminal(next);
    return { ok: true, state: next };
  },

  view(state: HanabiState, viewer: Viewer): HanabiView {
    const isSpectator = viewer === "spectator";
    const hands: Record<PlayerId, HanabiHandCardView[]> = {};
    for (const id of state.players) {
      const cards = state.hands[id] ?? [];
      hands[id] = cards.map((c) => {
        const k = state.knowledge[c.id] ?? freshKnowledge();
        // The viewer cannot see their OWN cards; everyone else's are visible.
        const hideIdentity = !isSpectator && id === viewer;
        return {
          id: c.id,
          color: hideIdentity ? null : c.color,
          rank: hideIdentity ? null : c.rank,
          knowledge: { ...k },
        };
      });
    }

    // Strip "drew" from lastAction unless viewer is the actor.
    let stripped = state.lastAction;
    if (stripped && stripped.kind !== "hint") {
      if (isSpectator || stripped.by !== viewer) {
        stripped = { ...stripped, drew: undefined };
      }
    }

    return {
      players: [...state.players],
      hands,
      played: { ...state.played },
      discard: [...state.discard],
      deckCount: state.deck.length,
      info: state.info,
      fuses: state.fuses,
      current: state.current,
      phase: state.phase,
      finalRoundTurnsLeft: state.finalRoundTurnsLeft,
      score: state.score,
      lastAction: stripped,
      me: isSpectator ? null : viewer,
    };
  },

  phase(state: HanabiState): PhaseId {
    return state.phase;
  },

  currentActors(state: HanabiState): PlayerId[] {
    if (state.phase !== "play") return [];
    return [state.current];
  },

  isTerminal(state: HanabiState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: HanabiState): Outcome | null {
    if (state.phase !== "gameOver") return null;
    // Co-op: everyone wins or everyone loses. Use "team" with a single team.
    const score = state.score ?? 0;
    if (score >= 25) {
      return { kind: "team", winningTeam: "fireworks", losingTeams: [] };
    }
    return { kind: "draw" };
  },
};
