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
  DECK_COMPOSITION,
  LOVE_LETTER_TYPE,
  moveSchema,
  type GuardGuessRank,
  type LogEntry,
  type LoveLetterConfig,
  type LoveLetterMove,
  type LoveLetterPlayerView,
  type LoveLetterState,
  type LoveLetterView,
  type Rank,
} from "./shared";

// ------------------------- Helpers -------------------------

function isAlive(state: LoveLetterState, id: PlayerId): boolean {
  return !state.eliminated.includes(id);
}

function nextAlive(state: LoveLetterState, from: PlayerId): PlayerId {
  const order = state.players;
  const startIdx = order.indexOf(from);
  for (let i = 1; i <= order.length; i++) {
    const candidate = order[(startIdx + i) % order.length]!;
    if (isAlive(state, candidate)) return candidate;
  }
  // Shouldn't happen — isTerminal guards this.
  return from;
}

function survivors(state: LoveLetterState): PlayerId[] {
  return state.players.filter((id) => isAlive(state, id));
}

function removeFromHand(hand: Rank[], index: 0 | 1): { played: Rank; kept: Rank[] } {
  const played = hand[index]!;
  const kept = hand.slice();
  kept.splice(index, 1);
  return { played, kept };
}

/** Draw one card off the top of the deck (mutates deck copy). */
function drawFromDeck(deck: Rank[]): { card: Rank | null; deck: Rank[] } {
  if (deck.length === 0) return { card: null, deck };
  const next = deck.slice();
  const card = next.shift()!;
  return { card, deck: next };
}

/** Valid targets for "another player" effects. */
function eligibleOthers(state: LoveLetterState, actor: PlayerId): PlayerId[] {
  return state.players.filter(
    (id) =>
      id !== actor &&
      isAlive(state, id) &&
      !state.immunities.includes(id),
  );
}

/** Valid targets for self-or-other effects (Prince). */
function eligibleAnyIncludingSelf(
  state: LoveLetterState,
  actor: PlayerId,
): PlayerId[] {
  // Prince can target self regardless of own Handmaid (you can't protect
  // yourself from your own play). Others must not be Handmaid-immune.
  return state.players.filter((id) => {
    if (!isAlive(state, id)) return false;
    if (id === actor) return true;
    return !state.immunities.includes(id);
  });
}

function eliminate(
  state: LoveLetterState,
  id: PlayerId,
  card: Rank,
  cause: "guard" | "baron" | "princess" | "prince-princess",
): LoveLetterState {
  const hands = { ...state.hands, [id]: [] as Rank[] };
  const eliminated = state.eliminated.includes(id)
    ? state.eliminated
    : [...state.eliminated, id];
  const log: LogEntry[] = [
    ...state.log,
    { kind: "eliminated", player: id, card, cause },
  ];
  return { ...state, hands, eliminated, log };
}

/**
 * Advance to the next alive player's turn, auto-drawing for them.
 * Clears the incoming player's Handmaid immunity (it ends "at the start
 * of your next turn").
 *
 * Also checks terminal conditions: one survivor, or deck empty + whoever's
 * next has no card to draw.
 */
function endTurnAndAdvance(
  state: LoveLetterState,
): LoveLetterState {
  // Terminal: single survivor.
  const alive = survivors(state);
  if (alive.length <= 1) {
    return {
      ...state,
      phase: "gameOver",
      winner: alive[0] ?? null,
      isDraw: alive.length === 0,
    };
  }

  const next = nextAlive(state, state.current);

  // Clear incoming player's Handmaid immunity.
  const immunities = state.immunities.filter((id) => id !== next);

  // Try to auto-draw for them.
  const { card, deck } = drawFromDeck(state.deck);

  if (card === null) {
    // Deck exhausted: reveal remaining hands, determine winner.
    const contenders = alive.filter((id) => state.hands[id]!.length > 0);
    // At this point, the just-finished actor has exactly 1 card (after playing
    // one of their two), and the incoming player still has their 1. Everyone
    // alive should have 1.
    const revealEntry: LogEntry = {
      kind: "finalReveal",
      hands: Object.fromEntries(
        contenders.map((id) => [id, state.hands[id]![0]!]),
      ),
    };
    const log = [...state.log, revealEntry];

    let maxRank = -1;
    const maxHolders: PlayerId[] = [];
    for (const id of contenders) {
      const r = state.hands[id]![0]!;
      if (r > maxRank) {
        maxRank = r;
        maxHolders.length = 0;
        maxHolders.push(id);
      } else if (r === maxRank) {
        maxHolders.push(id);
      }
    }

    if (maxHolders.length === 1) {
      return {
        ...state,
        deck,
        immunities,
        log,
        phase: "gameOver",
        winner: maxHolders[0]!,
        isDraw: false,
      };
    }
    return {
      ...state,
      deck,
      immunities,
      log,
      phase: "gameOver",
      winner: null,
      isDraw: true,
    };
  }

  // Normal next turn: incoming player now holds 2 cards.
  const nextHand = [...state.hands[next]!, card];
  return {
    ...state,
    current: next,
    deck,
    immunities,
    hands: { ...state.hands, [next]: nextHand },
  };
}

// ------------------------- Effects -------------------------

interface EffectContext {
  state: LoveLetterState;
  actor: PlayerId;
  /** The card the actor chose to play. Already removed from their hand. */
  played: Rank;
  /** Target from the move (validated), or undefined. */
  target?: PlayerId;
  /** Guard guess, if any. */
  guess?: GuardGuessRank;
}

type EffectResult =
  | { ok: true; state: LoveLetterState }
  | { ok: false; reason: string };

function applyGuard(ec: EffectContext): EffectResult {
  const { state, actor, target, guess } = ec;
  const others = eligibleOthers(state, actor);

  if (others.length === 0) {
    // Everyone else immune (or nobody else alive) — fizzle.
    const log: LogEntry[] = [
      ...state.log,
      { kind: "play", actor, card: 1, fizzled: true },
    ];
    return { ok: true, state: { ...state, log } };
  }

  if (!target) return { ok: false, reason: "Guard needs a target" };
  if (!others.includes(target)) {
    return { ok: false, reason: "Invalid Guard target" };
  }
  if (!guess) return { ok: false, reason: "Guard needs a card name" };
  // Zod schema already rejects a Guard guess of 1.

  const targetCard = state.hands[target]![0]!;
  const correct = targetCard === guess;

  const playLog: LogEntry = {
    kind: "play",
    actor,
    card: 1,
    target,
    guess,
    guessCorrect: correct,
  };
  let next: LoveLetterState = { ...state, log: [...state.log, playLog] };
  if (correct) {
    next = eliminate(next, target, targetCard, "guard");
  }
  return { ok: true, state: next };
}

function applyPriest(ec: EffectContext): EffectResult {
  const { state, actor, target } = ec;
  const others = eligibleOthers(state, actor);

  if (others.length === 0) {
    const log: LogEntry[] = [
      ...state.log,
      { kind: "play", actor, card: 2, fizzled: true },
    ];
    return { ok: true, state: { ...state, log } };
  }

  if (!target) return { ok: false, reason: "Priest needs a target" };
  if (!others.includes(target)) {
    return { ok: false, reason: "Invalid Priest target" };
  }

  const revealedCard = state.hands[target]![0]!;
  const log: LogEntry[] = [
    ...state.log,
    { kind: "play", actor, card: 2, target },
    { kind: "priestReveal", looker: actor, target, revealedCard },
  ];
  return { ok: true, state: { ...state, log } };
}

function applyBaron(ec: EffectContext): EffectResult {
  const { state, actor, target } = ec;
  const others = eligibleOthers(state, actor);

  if (others.length === 0) {
    const log: LogEntry[] = [
      ...state.log,
      { kind: "play", actor, card: 3, fizzled: true },
    ];
    return { ok: true, state: { ...state, log } };
  }

  if (!target) return { ok: false, reason: "Baron needs a target" };
  if (!others.includes(target)) {
    return { ok: false, reason: "Invalid Baron target" };
  }

  const actorCard = state.hands[actor]![0]!;
  const targetCard = state.hands[target]![0]!;

  let loser: PlayerId | null;
  if (actorCard > targetCard) loser = target;
  else if (targetCard > actorCard) loser = actor;
  else loser = null;

  const log: LogEntry[] = [
    ...state.log,
    { kind: "play", actor, card: 3, target },
    {
      kind: "baronReveal",
      actor,
      target,
      actorCard,
      targetCard,
      loser,
    },
  ];

  let next: LoveLetterState = { ...state, log };
  if (loser !== null) {
    const loserCard = loser === actor ? actorCard : targetCard;
    next = eliminate(next, loser, loserCard, "baron");
  }
  return { ok: true, state: next };
}

function applyHandmaid(ec: EffectContext): EffectResult {
  const { state, actor } = ec;
  const immunities = state.immunities.includes(actor)
    ? state.immunities
    : [...state.immunities, actor];
  const log: LogEntry[] = [
    ...state.log,
    { kind: "play", actor, card: 4 },
    { kind: "handmaidImmune", actor },
  ];
  return { ok: true, state: { ...state, immunities, log } };
}

function applyPrince(ec: EffectContext): EffectResult {
  const { state, actor, target } = ec;
  const eligible = eligibleAnyIncludingSelf(state, actor);
  // For Prince with no legal non-self targets, actor may target themselves —
  // but only if it doesn't force a Countess break. `eligible` always includes
  // self, so this is never truly empty.
  if (!target) return { ok: false, reason: "Prince needs a target" };
  if (!eligible.includes(target)) {
    return { ok: false, reason: "Invalid Prince target" };
  }

  const discarded = state.hands[target]![0]!;

  const basePlayLog: LogEntry = {
    kind: "play",
    actor,
    card: 5,
    target,
  };

  // Princess forces elimination.
  if (discarded === 8) {
    let next: LoveLetterState = {
      ...state,
      hands: { ...state.hands, [target]: [] },
      log: [
        ...state.log,
        basePlayLog,
        {
          kind: "princeDiscard",
          actor,
          target,
          discarded,
          drewFromBurned: false,
        },
      ],
    };
    next = eliminate(next, target, discarded, "prince-princess");
    return { ok: true, state: next };
  }

  // Otherwise draw a replacement from the deck (or burned card if empty).
  const { card: drawn, deck } = drawFromDeck(state.deck);
  let newHand: Rank[];
  let drewFromBurned = false;
  let newBurned = state.burned;
  let newDeck = deck;

  if (drawn !== null) {
    newHand = [drawn];
  } else {
    // Use burned face-down card as the replacement.
    newHand = [state.burned];
    drewFromBurned = true;
    // Mark burned as "consumed" — we don't have a separate field; simply
    // leave `burned` as-is since it's no longer secret (nor is it needed
    // again). State design keeps burned for the view reveal.
    newBurned = state.burned;
    newDeck = deck;
  }

  const log: LogEntry[] = [
    ...state.log,
    basePlayLog,
    {
      kind: "princeDiscard",
      actor,
      target,
      discarded,
      drewFromBurned,
    },
  ];

  return {
    ok: true,
    state: {
      ...state,
      hands: { ...state.hands, [target]: newHand },
      deck: newDeck,
      burned: newBurned,
      log,
    },
  };
}

function applyKing(ec: EffectContext): EffectResult {
  const { state, actor, target } = ec;
  const others = eligibleOthers(state, actor);

  if (others.length === 0) {
    const log: LogEntry[] = [
      ...state.log,
      { kind: "play", actor, card: 6, fizzled: true },
    ];
    return { ok: true, state: { ...state, log } };
  }

  if (!target) return { ok: false, reason: "King needs a target" };
  if (!others.includes(target)) {
    return { ok: false, reason: "Invalid King target" };
  }

  const actorCard = state.hands[actor]![0]!;
  const targetCard = state.hands[target]![0]!;
  const hands = {
    ...state.hands,
    [actor]: [targetCard] as Rank[],
    [target]: [actorCard] as Rank[],
  };
  const log: LogEntry[] = [
    ...state.log,
    { kind: "play", actor, card: 6, target },
    { kind: "swap", actor, target },
  ];
  return { ok: true, state: { ...state, hands, log } };
}

function applyCountess(ec: EffectContext): EffectResult {
  const { state, actor } = ec;
  const log: LogEntry[] = [
    ...state.log,
    { kind: "play", actor, card: 7 },
  ];
  return { ok: true, state: { ...state, log } };
}

function applyPrincess(ec: EffectContext): EffectResult {
  const { state, actor } = ec;
  // Discarding the Princess (willingly) = immediate elimination.
  const log: LogEntry[] = [
    ...state.log,
    { kind: "play", actor, card: 8 },
  ];
  let next: LoveLetterState = { ...state, log };
  next = eliminate(next, actor, 8, "princess");
  return { ok: true, state: next };
}

function applyEffect(ec: EffectContext): EffectResult {
  switch (ec.played) {
    case 1:
      return applyGuard(ec);
    case 2:
      return applyPriest(ec);
    case 3:
      return applyBaron(ec);
    case 4:
      return applyHandmaid(ec);
    case 5:
      return applyPrince(ec);
    case 6:
      return applyKing(ec);
    case 7:
      return applyCountess(ec);
    case 8:
      return applyPrincess(ec);
    default:
      return { ok: false, reason: "Unknown card" };
  }
}

// ------------------------- Module -------------------------

export const loveLetterServerModule: GameModule<
  LoveLetterState,
  LoveLetterMove,
  LoveLetterConfig,
  LoveLetterView
> = {
  type: LOVE_LETTER_TYPE,
  displayName: "Love Letter",
  description: "Deduction by card, elimination by guess — the last heart wins.",
  category: "party",
  minPlayers: 2,
  maxPlayers: 4,

  defaultConfig(): LoveLetterConfig {
    return {};
  },

  validateConfig(cfg: unknown): LoveLetterConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: LoveLetterConfig,
    ctx: GameContext,
  ): LoveLetterState {
    if (players.length < 2 || players.length > 4) {
      throw new Error(
        `Love Letter requires 2–4 players, got ${players.length}`,
      );
    }

    const deck = shuffle(DECK_COMPOSITION, ctx.rng);
    // Burn one face-down.
    const burned = deck.shift()!;
    // 2-player: reveal three face-up.
    const revealed: Rank[] = [];
    if (players.length === 2) {
      revealed.push(deck.shift()!, deck.shift()!, deck.shift()!);
    }
    // Deal one to each player.
    const hands: Record<PlayerId, Rank[]> = {};
    const order = shuffle(players, ctx.rng).map((p) => p.id);
    for (const id of order) {
      hands[id] = [deck.shift()!];
    }
    // First player: random via rng (already randomized in order — pick index 0
    // then auto-draw them a 2nd card).
    const firstIdx = Math.floor(ctx.rng() * order.length);
    const first = order[firstIdx]!;
    // Auto-draw for the first player: they now hold 2 cards.
    const firstDraw = deck.shift()!;
    hands[first] = [...hands[first]!, firstDraw];

    return {
      players: order,
      hands,
      burned,
      revealed,
      deck,
      current: first,
      phase: "play",
      immunities: [],
      eliminated: [],
      log: [],
      winner: null,
      isDraw: false,
    };
  },

  handleMove(
    state: LoveLetterState,
    move: LoveLetterMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<LoveLetterState> {
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
    if (!isAlive(state, actor)) {
      return { ok: false, reason: "You are eliminated" };
    }

    const hand = state.hands[actor] ?? [];
    if (hand.length !== 2) {
      // createInitialState + endTurnAndAdvance always hand the current actor
      // 2 cards (or end the game). If we see 1, the deck ran out mid-turn —
      // shouldn't happen given we end the game on deck-out.
      return { ok: false, reason: "Unexpected hand size" };
    }

    const { cardIndex, target, guardGuess } = parsed.data;
    const { played, kept } = removeFromHand(hand, cardIndex);

    // Countess forced-play: if the actor holds Countess (7) and also a
    // King (6) or Prince (5), they must play Countess. I.e. `played` must
    // be 7 in that case.
    const holdsCountess = hand.includes(7);
    const holdsKingOrPrince = hand.includes(6) || hand.includes(5);
    if (holdsCountess && holdsKingOrPrince && played !== 7) {
      return {
        ok: false,
        reason: "You must play the Countess when holding the King or Prince",
      };
    }

    // Princess (8) self-discard: allowed, but the effect eliminates the actor.
    // No further target validation needed here — applyPrincess handles it.

    // After the actor removes `played` from their hand, their hand is `kept`
    // (length 1). Effects that read "the actor's card" (Baron, King) need
    // this intermediate state.
    const preEffect: LoveLetterState = {
      ...state,
      hands: { ...state.hands, [actor]: kept },
    };

    const ec: EffectContext = {
      state: preEffect,
      actor,
      played,
      target,
      guess: guardGuess,
    };
    const result = applyEffect(ec);
    if (!result.ok) return { ok: false, reason: result.reason };

    // Advance the turn.
    const advanced = endTurnAndAdvance(result.state);
    return { ok: true, state: advanced };
  },

  view(state: LoveLetterState, viewer: Viewer): LoveLetterView {
    const isTerminal = state.phase === "gameOver";
    const isSpectator = viewer === "spectator";

    const perPlayer: Record<PlayerId, LoveLetterPlayerView> = {};
    for (const id of state.players) {
      const hand = state.hands[id] ?? [];
      const eliminated = state.eliminated.includes(id);
      const showHand =
        isTerminal || (!isSpectator && id === viewer);
      perPlayer[id] = {
        id,
        handCount: hand.length,
        hand: showHand ? [...hand] : null,
        eliminated,
        immune: state.immunities.includes(id),
      };
    }

    const redactedLog: LogEntry[] = state.log.map((e) =>
      redactLogEntry(e, viewer, isTerminal),
    );

    return {
      phase: state.phase,
      players: [...state.players],
      current: state.current,
      deckCount: state.deck.length,
      revealed: [...state.revealed],
      perPlayer,
      log: redactedLog,
      burned: isTerminal ? state.burned : null,
      winner: state.winner,
      isDraw: state.isDraw,
    };
  },

  phase(state: LoveLetterState): PhaseId {
    return state.phase;
  },

  currentActors(state: LoveLetterState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return [state.current];
  },

  isTerminal(state: LoveLetterState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: LoveLetterState): Outcome | null {
    if (state.phase !== "gameOver") return null;
    if (state.isDraw) return { kind: "draw" };
    if (state.winner) {
      const losers = state.players.filter((id) => id !== state.winner);
      return { kind: "solo", winners: [state.winner], losers };
    }
    return { kind: "draw" };
  },
};

/**
 * Private parts of log entries are stripped per viewer. Guard guesses
 * (and their correctness), eliminations, Baron winners, Prince discards,
 * and swaps are all public. Priest reveals are private to looker+target.
 * Baron hand values are private to the two involved.
 */
function redactLogEntry(
  entry: LogEntry,
  viewer: Viewer,
  isTerminal: boolean,
): LogEntry {
  if (entry.kind === "priestReveal") {
    const isParticipant =
      viewer !== "spectator" &&
      (viewer === entry.looker || viewer === entry.target);
    if (!isParticipant && !isTerminal) {
      return { ...entry, revealedCard: null };
    }
    return { ...entry };
  }
  if (entry.kind === "baronReveal") {
    const isParticipant =
      viewer !== "spectator" &&
      (viewer === entry.actor || viewer === entry.target);
    if (!isParticipant && !isTerminal) {
      return { ...entry, actorCard: null, targetCard: null };
    }
    return { ...entry };
  }
  return entry;
}
