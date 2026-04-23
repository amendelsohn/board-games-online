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
  CHEQUE_VALUES,
  FORSALE_TYPE,
  PROPERTY_COUNT,
  finalScoreOf,
  moveSchema,
  startingCoins,
  type ChequeResolveEntry,
  type ForSaleConfig,
  type ForSaleMove,
  type ForSaleState,
  type ForSaleView,
  type PropertyResolveEntry,
} from "./shared";

function shuffle<T>(arr: readonly T[], ctx: GameContext): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function truncateToMultiple(arr: number[], n: number): number[] {
  const overflow = arr.length % n;
  if (overflow === 0) return arr;
  return arr.slice(0, arr.length - overflow);
}

function dealProperties(state: ForSaleState, n: number): ForSaleState {
  const dealt = state.propertyDeck.slice(0, n);
  return {
    ...state,
    propertyDeck: state.propertyDeck.slice(n),
    faceUpProperties: dealt.sort((a, b) => a - b),
    bids: Object.fromEntries(state.players.map((p) => [p, 0])),
    currentBid: 0,
    currentBidder: null,
    passedThisRound: [],
    current: state.startPlayer,
  };
}

function dealCheques(state: ForSaleState, n: number): ForSaleState {
  const dealt = state.chequeDeck.slice(0, n);
  return {
    ...state,
    chequeDeck: state.chequeDeck.slice(n),
    faceUpCheques: dealt.sort((a, b) => b - a),
    chequePlays: Object.fromEntries(state.players.map((p) => [p, null])),
  };
}

function nextSeatClockwise(
  players: PlayerId[],
  from: PlayerId,
  skip: (id: PlayerId) => boolean,
): PlayerId {
  const idx = players.indexOf(from);
  if (idx === -1) return from;
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const pid = players[(idx + step) % n]!;
    if (!skip(pid)) return pid;
  }
  return from;
}

function finalizeProperty(state: ForSaleState): ForSaleState {
  // Start next property round OR transition to cheque phase.
  if (state.propertyDeck.length === 0) {
    // Move to cheque phase
    return startChequePhase(state);
  }
  const nextStart = nextSeatClockwise(state.players, state.startPlayer, () => false);
  const n = state.players.length;
  return dealProperties(
    { ...state, startPlayer: nextStart, current: nextStart },
    n,
  );
}

function startChequePhase(state: ForSaleState): ForSaleState {
  const n = state.players.length;
  const dealt = state.chequeDeck.slice(0, n);
  return {
    ...state,
    phase: "cheque",
    faceUpProperties: [],
    bids: Object.fromEntries(state.players.map((p) => [p, 0])),
    currentBid: 0,
    currentBidder: null,
    passedThisRound: [],
    chequeDeck: state.chequeDeck.slice(n),
    faceUpCheques: dealt.sort((a, b) => b - a),
    chequePlays: Object.fromEntries(state.players.map((p) => [p, null])),
  };
}

function finalizeChequeRound(state: ForSaleState): ForSaleState {
  // Sort submissions by property desc; assign cheques in desc order.
  const entries = state.players.map((p) => ({
    player: p,
    property: state.chequePlays[p]!,
  }));
  entries.sort((a, b) => b.property - a.property);

  const cheques = [...state.faceUpCheques].sort((a, b) => b - a);
  const plays: ChequeResolveEntry[] = [];
  const newProperties = { ...state.properties };
  const newCheques = { ...state.cheques };
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const cheque = cheques[i] ?? 0;
    plays.push({
      player: entry.player,
      property: entry.property,
      cheque,
    });
    newProperties[entry.player] = (newProperties[entry.player] ?? []).filter(
      (c) => c !== entry.property,
    );
    newCheques[entry.player] = [
      ...(newCheques[entry.player] ?? []),
      cheque,
    ];
  }

  const next: ForSaleState = {
    ...state,
    properties: newProperties,
    cheques: newCheques,
    lastResolve: { kind: "cheque", plays },
  };

  if (state.chequeDeck.length === 0) {
    return finalizeGame(next);
  }

  return dealCheques(next, state.players.length);
}

function finalizeGame(state: ForSaleState): ForSaleState {
  const finalScores: Record<PlayerId, number> = {};
  let best = -Infinity;
  for (const id of state.players) {
    const s = finalScoreOf(state.coins[id] ?? 0, state.cheques[id] ?? []);
    finalScores[id] = s;
    if (s > best) best = s;
  }
  const winners = state.players.filter((id) => finalScores[id] === best);
  return {
    ...state,
    phase: "gameOver",
    finalScores,
    winners,
  };
}

export const forSaleServerModule: GameModule<
  ForSaleState,
  ForSaleMove,
  ForSaleConfig,
  ForSaleView
> = {
  type: FORSALE_TYPE,
  displayName: "For Sale",
  description:
    "A tight auction — buy low, flip high. 3–6 players, ~20 minutes.",
  category: "cards-dice",
  minPlayers: 3,
  maxPlayers: 6,

  defaultConfig(): ForSaleConfig {
    return {};
  },

  validateConfig(cfg: unknown): ForSaleConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: ForSaleConfig,
    ctx: GameContext,
  ): ForSaleState {
    if (players.length < 3 || players.length > 6) {
      throw new Error(`For Sale requires 3–6 players, got ${players.length}`);
    }
    const seated = players.map((p) => p.id);
    const n = seated.length;
    const propertiesAll = Array.from({ length: PROPERTY_COUNT }, (_, i) => i + 1);
    const shuffledProps = truncateToMultiple(shuffle(propertiesAll, ctx), n);
    const shuffledCheques = truncateToMultiple(
      shuffle(CHEQUE_VALUES, ctx),
      n,
    );

    const coins: Record<PlayerId, number> = {};
    const properties: Record<PlayerId, number[]> = {};
    const cheques: Record<PlayerId, number[]> = {};
    const coinAmount = startingCoins(n);
    for (const id of seated) {
      coins[id] = coinAmount;
      properties[id] = [];
      cheques[id] = [];
    }

    const startPlayer = seated[Math.floor(ctx.rng() * n)]!;
    const initial: ForSaleState = {
      players: seated,
      phase: "property",
      coins,
      properties,
      cheques,
      propertyDeck: shuffledProps,
      chequeDeck: shuffledCheques,
      startPlayer,
      faceUpProperties: [],
      bids: Object.fromEntries(seated.map((p) => [p, 0])),
      currentBid: 0,
      currentBidder: null,
      passedThisRound: [],
      current: startPlayer,
      faceUpCheques: [],
      chequePlays: Object.fromEntries(seated.map((p) => [p, null])),
      lastResolve: null,
      finalScores: null,
      winners: null,
    };
    return dealProperties(initial, n);
  },

  handleMove(
    state: ForSaleState,
    move: ForSaleMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<ForSaleState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver")
      return { ok: false, reason: "Game is over" };
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }

    const m = parsed.data;

    if (state.phase === "property") {
      if (state.current !== actor) {
        return { ok: false, reason: "Not your turn" };
      }
      if (state.passedThisRound.includes(actor)) {
        return { ok: false, reason: "You already passed this round" };
      }

      if (m.kind === "bid") {
        if (m.amount <= state.currentBid) {
          return { ok: false, reason: "Bid must raise the current bid" };
        }
        const coins = state.coins[actor] ?? 0;
        if (m.amount > coins) {
          return { ok: false, reason: "Not enough coins" };
        }
        const bids = { ...state.bids, [actor]: m.amount };
        const next = nextSeatClockwise(state.players, actor, (id) =>
          state.passedThisRound.includes(id),
        );
        return {
          ok: true,
          state: {
            ...state,
            bids,
            currentBid: m.amount,
            currentBidder: actor,
            current: next,
          },
        };
      }

      if (m.kind === "pass") {
        // Pay half (ceil) of actor's round bid; receive lowest face-up card.
        const myBid = state.bids[actor] ?? 0;
        const pay = Math.ceil(myBid / 2);
        const lowest = state.faceUpProperties[0]!;
        const faceUpProperties = state.faceUpProperties.slice(1);
        const newCoins = {
          ...state.coins,
          [actor]: (state.coins[actor] ?? 0) - pay,
        };
        const takes: PropertyResolveEntry[] =
          state.lastResolve?.kind === "property"
            ? [...state.lastResolve.takes]
            : [];
        takes.push({ player: actor, card: lowest, paid: pay });

        const newProperties = {
          ...state.properties,
          [actor]: [...(state.properties[actor] ?? []), lowest],
        };
        const passedThisRound = [...state.passedThisRound, actor];
        const unpassed = state.players.filter(
          (id) => !passedThisRound.includes(id),
        );

        // Starting a fresh resolve record for this round: only keep entries
        // belonging to the current round. Previous-round entries shouldn't
        // leak. We detect by currentBid reset / passedThisRound[0] match.
        const roundStarted = state.passedThisRound.length === 0;
        const resolveTakes = roundStarted
          ? [{ player: actor, card: lowest, paid: pay }]
          : takes;

        let next: ForSaleState = {
          ...state,
          coins: newCoins,
          properties: newProperties,
          faceUpProperties,
          passedThisRound,
          lastResolve: { kind: "property", takes: resolveTakes },
        };

        if (unpassed.length === 1) {
          // Final bidder auto-wins remaining face-up cards (should be 1).
          const lastBidder = unpassed[0]!;
          if (next.faceUpProperties.length > 0 && next.currentBidder) {
            const highest = next.faceUpProperties[next.faceUpProperties.length - 1]!;
            const paid = next.currentBid;
            next = {
              ...next,
              faceUpProperties: next.faceUpProperties.slice(0, -1),
              properties: {
                ...next.properties,
                [lastBidder]: [...(next.properties[lastBidder] ?? []), highest],
              },
              coins: {
                ...next.coins,
                [lastBidder]: (next.coins[lastBidder] ?? 0) - paid,
              },
              lastResolve: {
                kind: "property",
                takes: [
                  ...resolveTakes,
                  { player: lastBidder, card: highest, paid },
                ],
              },
            };
          } else if (next.faceUpProperties.length > 0 && !next.currentBidder) {
            // Edge case: nobody bid — remaining card goes to the sole unpassed player for 0.
            const leftover = next.faceUpProperties[0]!;
            next = {
              ...next,
              faceUpProperties: [],
              properties: {
                ...next.properties,
                [lastBidder]: [...(next.properties[lastBidder] ?? []), leftover],
              },
              lastResolve: {
                kind: "property",
                takes: [
                  ...resolveTakes,
                  { player: lastBidder, card: leftover, paid: 0 },
                ],
              },
            };
          }
          next = finalizeProperty(next);
          return { ok: true, state: next };
        }

        // Advance to next unpassed player clockwise from whoever just passed.
        const nextPlayer = nextSeatClockwise(state.players, actor, (id) =>
          passedThisRound.includes(id),
        );
        return {
          ok: true,
          state: { ...next, current: nextPlayer },
        };
      }

      return { ok: false, reason: "Bid or pass" };
    }

    if (state.phase === "cheque") {
      if (m.kind !== "playProperty") {
        return { ok: false, reason: "Play a property this phase" };
      }
      if (state.chequePlays[actor] !== null) {
        return { ok: false, reason: "You already played a property" };
      }
      const myProps = state.properties[actor] ?? [];
      if (!myProps.includes(m.card)) {
        return { ok: false, reason: "You don't own that property" };
      }
      const chequePlays: Record<PlayerId, number | null> = {
        ...state.chequePlays,
        [actor]: m.card,
      };
      const allSubmitted = state.players.every(
        (id) => chequePlays[id] != null,
      );
      if (!allSubmitted) {
        return { ok: true, state: { ...state, chequePlays } };
      }
      const nextState = finalizeChequeRound({ ...state, chequePlays });
      return { ok: true, state: nextState };
    }

    return { ok: false, reason: "Unknown phase" };
  },

  view(state: ForSaleState, viewer: Viewer): ForSaleView {
    const isSpectator = viewer === "spectator";
    const myProperties =
      !isSpectator && state.properties[viewer]
        ? [...state.properties[viewer]!]
        : [];
    const mySelection =
      !isSpectator && state.chequePlays[viewer] != null
        ? state.chequePlays[viewer]!
        : null;

    const propertyCount: Record<PlayerId, number> = {};
    const chequeCount: Record<PlayerId, number> = {};
    for (const id of state.players) {
      propertyCount[id] = state.properties[id]?.length ?? 0;
      chequeCount[id] = state.cheques[id]?.length ?? 0;
    }
    const submitted: Record<PlayerId, boolean> = {};
    for (const id of state.players) {
      submitted[id] = state.chequePlays[id] != null;
    }

    return {
      players: [...state.players],
      phase: state.phase,
      coins: { ...state.coins },
      propertyCount,
      chequeCount,
      cheques: Object.fromEntries(
        Object.entries(state.cheques).map(([k, v]) => [k, [...v]]),
      ),
      propertyDeckSize: state.propertyDeck.length,
      chequeDeckSize: state.chequeDeck.length,
      myProperties: myProperties.sort((a, b) => a - b),
      faceUpProperties: [...state.faceUpProperties],
      bids: { ...state.bids },
      currentBid: state.currentBid,
      currentBidder: state.currentBidder,
      passedThisRound: [...state.passedThisRound],
      current: state.current,
      startPlayer: state.startPlayer,
      faceUpCheques: [...state.faceUpCheques],
      submitted,
      mySelection,
      lastResolve: state.lastResolve
        ? state.lastResolve.kind === "property"
          ? {
              kind: "property",
              takes: state.lastResolve.takes.map((t) => ({ ...t })),
            }
          : {
              kind: "cheque",
              plays: state.lastResolve.plays.map((p) => ({ ...p })),
            }
        : null,
      finalScores: state.finalScores ? { ...state.finalScores } : null,
      winners: state.winners ? [...state.winners] : null,
    };
  },

  phase(state: ForSaleState): PhaseId {
    return state.phase;
  },

  currentActors(state: ForSaleState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    if (state.phase === "property") return [state.current];
    // Cheque: everyone who hasn't played yet.
    return state.players.filter((id) => state.chequePlays[id] == null);
  },

  isTerminal(state: ForSaleState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: ForSaleState): Outcome | null {
    if (state.phase !== "gameOver" || !state.winners) return null;
    const winners = state.winners;
    const losers = state.players.filter((id) => !winners.includes(id));
    if (winners.length === 1) {
      return { kind: "solo", winners, losers };
    }
    // Multi-winner tie — report as draw so the lobby UI shows the shared top.
    return { kind: "draw" };
  },
};
