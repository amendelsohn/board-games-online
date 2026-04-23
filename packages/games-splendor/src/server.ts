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
import { ALL_CARDS, ALL_NOBLES } from "./data";
import {
  GOLD_SUPPLY,
  POINTS_TO_WIN,
  RESERVE_LIMIT,
  SPLENDOR_TYPE,
  TOKEN_LIMIT,
  emptyGems,
  emptyTokens,
  gemSupply,
  moveSchema,
  nobleEligible,
  payForCard,
  tokenTotal,
  type Card,
  type GemWithGold,
  type Noble,
  type PlayerPublic,
  type SplendorConfig,
  type SplendorLastAction,
  type SplendorMove,
  type SplendorState,
  type SplendorView,
  type Tier,
} from "./shared";

function shuffle<T>(arr: readonly T[], ctx: GameContext): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function deal(slots: (Card | null)[], deck: Card[]): void {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] == null) {
      slots[i] = deck.shift() ?? null;
    }
  }
}

function seatFreshSeat(): SplendorState["seats"][string] {
  return {
    tokens: emptyTokens(),
    bonuses: emptyGems(),
    points: 0,
    owned: [],
    reserved: [],
    nobles: [],
  };
}

function nextSeat(players: PlayerId[], from: PlayerId): PlayerId {
  const idx = players.indexOf(from);
  return players[(idx + 1) % players.length]!;
}

function addTokens(
  base: Record<GemWithGold, number>,
  delta: Partial<Record<GemWithGold, number>>,
): Record<GemWithGold, number> {
  const out: Record<GemWithGold, number> = { ...base };
  for (const [k, v] of Object.entries(delta)) {
    const key = k as GemWithGold;
    out[key] = (out[key] ?? 0) + (v ?? 0);
  }
  return out;
}
function subTokens(
  base: Record<GemWithGold, number>,
  delta: Partial<Record<GemWithGold, number>>,
): Record<GemWithGold, number> {
  const out: Record<GemWithGold, number> = { ...base };
  for (const [k, v] of Object.entries(delta)) {
    const key = k as GemWithGold;
    out[key] = (out[key] ?? 0) - (v ?? 0);
  }
  return out;
}

function parseReturnTokens(
  r: unknown,
): Partial<Record<GemWithGold, number>> | null {
  if (r == null) return {};
  if (typeof r !== "object") return null;
  const out: Partial<Record<GemWithGold, number>> = {};
  for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
    if (typeof v !== "number" || v < 0 || !Number.isInteger(v)) return null;
    if (k !== "white" && k !== "blue" && k !== "green" && k !== "red" && k !== "black" && k !== "gold") {
      return null;
    }
    out[k as GemWithGold] = v;
  }
  return out;
}

function applyReturnOverflow(
  seatTokens: Record<GemWithGold, number>,
  supply: Record<GemWithGold, number>,
  returned: Partial<Record<GemWithGold, number>>,
): { seatTokens: Record<GemWithGold, number>; supply: Record<GemWithGold, number> } | null {
  const nextSeat = { ...seatTokens };
  const nextSupply = { ...supply };
  for (const [k, v] of Object.entries(returned)) {
    if (!v) continue;
    const key = k as GemWithGold;
    if ((nextSeat[key] ?? 0) < v) return null;
    nextSeat[key] = (nextSeat[key] ?? 0) - v;
    nextSupply[key] = (nextSupply[key] ?? 0) + v;
  }
  return { seatTokens: nextSeat, supply: nextSupply };
}

function checkEndOfTurn(state: SplendorState): SplendorState {
  // If the player who started the final-round has been reached again, game ends.
  if (state.finalRoundTrigger === null) return state;
  const trigger = state.finalRoundTrigger;
  // Current is the player about to act. If we've returned to the trigger, end.
  if (state.current === trigger) {
    const best = Math.max(...state.players.map((id) => state.seats[id]!.points));
    const tied = state.players.filter((id) => state.seats[id]!.points === best);
    // Tiebreaker: fewest cards bought.
    const minCards = Math.min(
      ...tied.map((id) => state.seats[id]!.owned.length),
    );
    const winners = tied.filter(
      (id) => state.seats[id]!.owned.length === minCards,
    );
    return { ...state, phase: "gameOver", winners };
  }
  return state;
}

function claimNobleIfAny(
  state: SplendorState,
  actor: PlayerId,
): { state: SplendorState; claimed: Noble | null } {
  const seat = state.seats[actor]!;
  const eligible = state.nobles.filter((n) => nobleEligible(seat.bonuses, n));
  if (eligible.length === 0) return { state, claimed: null };
  const pick = eligible[0]!;
  const newSeat = {
    ...seat,
    nobles: [...seat.nobles, pick],
    points: seat.points + pick.points,
  };
  return {
    state: {
      ...state,
      nobles: state.nobles.filter((n) => n.id !== pick.id),
      seats: { ...state.seats, [actor]: newSeat },
    },
    claimed: pick,
  };
}

function afterAction(
  state: SplendorState,
  actor: PlayerId,
  lastAction: SplendorLastAction,
): SplendorState {
  // Check final-round trigger (first time someone crosses 15 pts).
  const seat = state.seats[actor]!;
  const nextTrigger =
    state.finalRoundTrigger === null && seat.points >= POINTS_TO_WIN
      ? actor
      : state.finalRoundTrigger;
  const advanced: SplendorState = {
    ...state,
    current: nextSeat(state.players, actor),
    turn: state.turn + 1,
    lastAction,
    finalRoundTrigger: nextTrigger,
  };
  return checkEndOfTurn(advanced);
}

export const splendorServerModule: GameModule<
  SplendorState,
  SplendorMove,
  SplendorConfig,
  SplendorView
> = {
  type: SPLENDOR_TYPE,
  displayName: "Splendor",
  description:
    "Build a gem empire — take tokens, buy cards, win the favour of nobles. First to 15 points wins.",
  category: "strategy",
  minPlayers: 2,
  maxPlayers: 4,

  defaultConfig(): SplendorConfig {
    return {};
  },

  validateConfig(cfg: unknown): SplendorConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: SplendorConfig,
    ctx: GameContext,
  ): SplendorState {
    if (players.length < 2 || players.length > 4) {
      throw new Error(
        `Splendor requires 2–4 players, got ${players.length}`,
      );
    }
    const seated = players.map((p) => p.id);
    const n = seated.length;

    const tier1 = shuffle(ALL_CARDS.filter((c) => c.tier === 1), ctx);
    const tier2 = shuffle(ALL_CARDS.filter((c) => c.tier === 2), ctx);
    const tier3 = shuffle(ALL_CARDS.filter((c) => c.tier === 3), ctx);

    const display = {
      1: [null, null, null, null] as (Card | null)[],
      2: [null, null, null, null] as (Card | null)[],
      3: [null, null, null, null] as (Card | null)[],
    };
    deal(display[1], tier1);
    deal(display[2], tier2);
    deal(display[3], tier3);

    const nobleCount = n + 1;
    const nobles = shuffle(ALL_NOBLES, ctx).slice(0, nobleCount);

    const supplyColors = gemSupply(n);
    const tokens: Record<GemWithGold, number> = {
      ...supplyColors,
      gold: GOLD_SUPPLY,
    };

    const seats: SplendorState["seats"] = {};
    for (const id of seated) seats[id] = seatFreshSeat();

    const first = seated[Math.floor(ctx.rng() * n)]!;
    return {
      players: seated,
      tokens,
      display,
      decks: { 1: tier1, 2: tier2, 3: tier3 },
      nobles,
      seats,
      current: first,
      phase: "play",
      finalRoundTrigger: null,
      turn: 0,
      lastAction: null,
      winners: null,
    };
  },

  handleMove(
    state: SplendorState,
    move: SplendorMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<SplendorState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase !== "play") {
      return { ok: false, reason: "Game is over" };
    }
    if (state.current !== actor) {
      return { ok: false, reason: "Not your turn" };
    }
    const seat = state.seats[actor];
    if (!seat) return { ok: false, reason: "Not in this match" };

    const m = parsed.data;

    // ---------- Take three ----------
    if (m.kind === "takeThree") {
      const gems = m.gems;
      const unique = new Set(gems);
      if (unique.size !== gems.length) {
        return { ok: false, reason: "Must take three *different* gems" };
      }
      for (const g of gems) {
        if ((state.tokens[g] ?? 0) <= 0) {
          return { ok: false, reason: `No ${g} tokens in supply` };
        }
      }
      let newSupply = { ...state.tokens };
      let newSeatTokens = { ...seat.tokens };
      for (const g of gems) {
        newSupply[g] -= 1;
        newSeatTokens[g] += 1;
      }
      // Enforce 10-token limit by honoring returnTokens.
      const totalAfter = tokenTotal(newSeatTokens);
      const overflow = Math.max(0, totalAfter - TOKEN_LIMIT);
      const ret = parseReturnTokens(m.returnTokens);
      if (ret == null) {
        return { ok: false, reason: "Invalid returnTokens map" };
      }
      const retSum = Object.values(ret).reduce(
        (a: number, b: number | undefined) => a + (b ?? 0),
        0,
      );
      if (retSum !== overflow) {
        return {
          ok: false,
          reason:
            overflow > 0
              ? `Must return ${overflow} tokens (over 10 limit)`
              : "No tokens need returning",
        };
      }
      // Don't let the player return the same tokens they just took to exploit; it's fine — returning is just discarding.
      if (overflow > 0) {
        const applied = applyReturnOverflow(newSeatTokens, newSupply, ret);
        if (!applied) {
          return { ok: false, reason: "Cannot return tokens you don't own" };
        }
        newSeatTokens = applied.seatTokens;
        newSupply = applied.supply;
      }

      const nextSeatObj = { ...seat, tokens: newSeatTokens };
      const interim: SplendorState = {
        ...state,
        tokens: newSupply,
        seats: { ...state.seats, [actor]: nextSeatObj },
      };
      const takenRecord: Partial<Record<GemWithGold, number>> = {};
      for (const g of gems) takenRecord[g] = 1;
      const lastAction: SplendorLastAction = {
        kind: "takeTokens",
        by: actor,
        tokens: takenRecord,
        returned: overflow > 0 ? ret : undefined,
      };
      return { ok: true, state: afterAction(interim, actor, lastAction) };
    }

    // ---------- Take two ----------
    if (m.kind === "takeTwo") {
      const g = m.gem;
      if ((state.tokens[g] ?? 0) < 4) {
        return {
          ok: false,
          reason: "Need at least 4 tokens in the supply to take 2 of one color",
        };
      }
      let newSupply = { ...state.tokens };
      let newSeatTokens = { ...seat.tokens };
      newSupply[g] -= 2;
      newSeatTokens[g] += 2;
      const overflow = Math.max(0, tokenTotal(newSeatTokens) - TOKEN_LIMIT);
      const ret = parseReturnTokens(m.returnTokens);
      if (ret == null) {
        return { ok: false, reason: "Invalid returnTokens map" };
      }
      const retSum = Object.values(ret).reduce(
        (a: number, b: number | undefined) => a + (b ?? 0),
        0,
      );
      if (retSum !== overflow) {
        return {
          ok: false,
          reason:
            overflow > 0
              ? `Must return ${overflow} tokens (over 10 limit)`
              : "No tokens need returning",
        };
      }
      if (overflow > 0) {
        const applied = applyReturnOverflow(newSeatTokens, newSupply, ret);
        if (!applied) {
          return { ok: false, reason: "Cannot return tokens you don't own" };
        }
        newSeatTokens = applied.seatTokens;
        newSupply = applied.supply;
      }
      const nextSeatObj = { ...seat, tokens: newSeatTokens };
      const interim: SplendorState = {
        ...state,
        tokens: newSupply,
        seats: { ...state.seats, [actor]: nextSeatObj },
      };
      const lastAction: SplendorLastAction = {
        kind: "takeTokens",
        by: actor,
        tokens: { [g]: 2 },
        returned: overflow > 0 ? ret : undefined,
      };
      return { ok: true, state: afterAction(interim, actor, lastAction) };
    }

    // ---------- Reserve ----------
    if (m.kind === "reserve") {
      if (seat.reserved.length >= RESERVE_LIMIT) {
        return { ok: false, reason: "Reserve is full (3)" };
      }
      const tier = m.tier as Tier;
      let reserved: Card | null = null;
      let fromDeck = false;
      let nextDisplay = { ...state.display };
      let nextDecks = { ...state.decks };
      if (m.slot == null) {
        // Reserve top of deck.
        if (nextDecks[tier].length === 0) {
          return { ok: false, reason: "That deck is empty" };
        }
        const d = [...nextDecks[tier]];
        reserved = d.shift()!;
        nextDecks[tier] = d;
        fromDeck = true;
      } else {
        const slot = m.slot;
        const displaySlots = [...nextDisplay[tier]];
        const c = displaySlots[slot];
        if (c == null) {
          return { ok: false, reason: "That slot is empty" };
        }
        reserved = c;
        displaySlots[slot] = null;
        // Refill.
        const d = [...nextDecks[tier]];
        if (d.length > 0) {
          displaySlots[slot] = d.shift()!;
          nextDecks[tier] = d;
        }
        nextDisplay[tier] = displaySlots;
      }
      const goldAvailable = state.tokens.gold > 0;
      let newSupply = { ...state.tokens };
      let newSeatTokens = { ...seat.tokens };
      if (goldAvailable) {
        newSupply.gold -= 1;
        newSeatTokens.gold += 1;
      }
      const overflow = Math.max(0, tokenTotal(newSeatTokens) - TOKEN_LIMIT);
      const ret = parseReturnTokens(m.returnTokens);
      if (ret == null) {
        return { ok: false, reason: "Invalid returnTokens map" };
      }
      const retSum = Object.values(ret).reduce(
        (a: number, b: number | undefined) => a + (b ?? 0),
        0,
      );
      if (retSum !== overflow) {
        return {
          ok: false,
          reason:
            overflow > 0
              ? `Must return ${overflow} tokens (over 10 limit)`
              : "No tokens need returning",
        };
      }
      if (overflow > 0) {
        const applied = applyReturnOverflow(newSeatTokens, newSupply, ret);
        if (!applied) {
          return { ok: false, reason: "Cannot return tokens you don't own" };
        }
        newSeatTokens = applied.seatTokens;
        newSupply = applied.supply;
      }
      const nextSeatObj = {
        ...seat,
        tokens: newSeatTokens,
        reserved: [...seat.reserved, reserved!],
      };
      const interim: SplendorState = {
        ...state,
        tokens: newSupply,
        display: nextDisplay,
        decks: nextDecks,
        seats: { ...state.seats, [actor]: nextSeatObj },
      };
      const lastAction: SplendorLastAction = {
        kind: "reserve",
        by: actor,
        cardId: reserved!.id,
        tier,
        fromDeck,
        goldGained: goldAvailable,
        returned: overflow > 0 ? ret : undefined,
      };
      return { ok: true, state: afterAction(interim, actor, lastAction) };
    }

    // ---------- Buy ----------
    if (m.kind === "buy") {
      let card: Card;
      let fromReserve = false;
      const nextDisplay = { ...state.display };
      const nextDecks = { ...state.decks };
      let nextReserved = seat.reserved;
      if (m.source === "display") {
        if (m.tier == null || m.slot == null) {
          return {
            ok: false,
            reason: "Display buy requires tier and slot",
          };
        }
        const tier: Tier = m.tier;
        const slot = m.slot;
        const displaySlots = [...nextDisplay[tier]];
        const c = displaySlots[slot];
        if (c == null) {
          return { ok: false, reason: "That slot is empty" };
        }
        card = c;
        displaySlots[slot] = null;
        const d = [...nextDecks[tier]];
        if (d.length > 0) {
          displaySlots[slot] = d.shift()!;
          nextDecks[tier] = d;
        }
        nextDisplay[tier] = displaySlots;
      } else {
        // from reserve
        if (!m.cardId) {
          return { ok: false, reason: "Reserve buy requires cardId" };
        }
        const idx = seat.reserved.findIndex((c) => c.id === m.cardId);
        if (idx < 0) {
          return { ok: false, reason: "That card isn't in your reserve" };
        }
        card = seat.reserved[idx]!;
        nextReserved = seat.reserved.filter((_, i) => i !== idx);
        fromReserve = true;
      }

      const pay = payForCard(
        card,
        seat.tokens,
        seat.bonuses,
        m.gold as Record<string, number> | undefined,
      );
      if (!pay.ok) {
        return {
          ok: false,
          reason: `You can't afford this card (missing ${pay.missing})`,
        };
      }

      const newSeatTokens = subTokens(seat.tokens, pay.spend);
      const newSupplyTokens = addTokens(state.tokens, pay.spend);
      const newBonuses = {
        ...seat.bonuses,
        [card.bonus]: (seat.bonuses[card.bonus] ?? 0) + 1,
      };
      const newSeat = {
        ...seat,
        tokens: newSeatTokens,
        bonuses: newBonuses,
        owned: [...seat.owned, card],
        reserved: nextReserved,
        points: seat.points + card.points,
      };
      let interim: SplendorState = {
        ...state,
        tokens: newSupplyTokens,
        display: nextDisplay,
        decks: nextDecks,
        seats: { ...state.seats, [actor]: newSeat },
      };
      // Noble check.
      const { state: afterNoble, claimed } = claimNobleIfAny(interim, actor);
      interim = afterNoble;

      const paidRecord: Partial<Record<GemWithGold, number>> = {};
      for (const [k, v] of Object.entries(pay.spend)) {
        if (v > 0) paidRecord[k as GemWithGold] = v;
      }
      const lastAction: SplendorLastAction = {
        kind: "buy",
        by: actor,
        cardId: card.id,
        points: card.points,
        bonus: card.bonus,
        paid: paidRecord,
        fromReserve,
        nobleClaimed: claimed,
      };
      return { ok: true, state: afterAction(interim, actor, lastAction) };
    }

    return { ok: false, reason: "Unknown move" };
  },

  view(state: SplendorState, viewer: Viewer): SplendorView {
    const isSpectator = viewer === "spectator";
    const seats: Record<PlayerId, PlayerPublic> = {};
    for (const id of state.players) {
      const s = state.seats[id]!;
      const showReserve = !isSpectator && id === viewer;
      seats[id] = {
        id,
        tokens: { ...s.tokens },
        bonuses: { ...s.bonuses },
        points: s.points,
        cardCount: s.owned.length,
        nobles: s.nobles.map((n) => ({ ...n, req: { ...n.req } })),
        reservedCount: s.reserved.length,
        reserved: showReserve ? s.reserved.map((c) => clone(c)) : null,
      };
    }
    return {
      players: [...state.players],
      tokens: { ...state.tokens },
      display: {
        1: state.display[1].map((c) => (c ? clone(c) : null)),
        2: state.display[2].map((c) => (c ? clone(c) : null)),
        3: state.display[3].map((c) => (c ? clone(c) : null)),
      },
      deckCounts: {
        1: state.decks[1].length,
        2: state.decks[2].length,
        3: state.decks[3].length,
      },
      nobles: state.nobles.map((n) => ({ ...n, req: { ...n.req } })),
      seats,
      current: state.current,
      phase: state.phase,
      finalRoundTrigger: state.finalRoundTrigger,
      turn: state.turn,
      lastAction: cloneAction(state.lastAction),
      winners: state.winners ? [...state.winners] : null,
      me: isSpectator ? null : viewer,
    };
  },

  phase(state: SplendorState): PhaseId {
    return state.phase;
  },

  currentActors(state: SplendorState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return [state.current];
  },

  isTerminal(state: SplendorState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: SplendorState): Outcome | null {
    if (state.phase !== "gameOver" || !state.winners) return null;
    const winners = state.winners;
    const losers = state.players.filter((id) => !winners.includes(id));
    if (winners.length === 1) {
      return { kind: "solo", winners, losers };
    }
    return { kind: "draw" };
  },
};

function clone(c: Card): Card {
  return { ...c, cost: { ...c.cost } };
}

function cloneAction(a: SplendorLastAction | null): SplendorLastAction | null {
  if (!a) return null;
  if (a.kind === "takeTokens") {
    return {
      ...a,
      tokens: { ...a.tokens },
      returned: a.returned ? { ...a.returned } : undefined,
    };
  }
  if (a.kind === "reserve") {
    return { ...a, returned: a.returned ? { ...a.returned } : undefined };
  }
  return {
    ...a,
    paid: { ...a.paid },
    nobleClaimed: a.nobleClaimed
      ? { ...a.nobleClaimed, req: { ...a.nobleClaimed.req } }
      : null,
  };
}

// Re-export for consumer convenience.
export { GEMS, POINTS_TO_WIN } from "./shared";
