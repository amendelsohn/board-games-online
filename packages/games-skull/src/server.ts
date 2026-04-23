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
  DISCS_PER_PLAYER,
  FLOWERS_PER_PLAYER,
  POINTS_TO_WIN,
  SKULLS_PER_PLAYER,
  SKULL_TYPE,
  isEliminated,
  moveSchema,
  totalDiscsOnTable,
  type DiscKind,
  type SkullConfig,
  type SkullFlip,
  type SkullHand,
  type SkullMove,
  type SkullRoundResult,
  type SkullState,
  type SkullView,
} from "./shared";

function freshHand(): SkullHand {
  return { flowers: FLOWERS_PER_PLAYER, skulls: SKULLS_PER_PLAYER };
}

/** Next seat clockwise that still has any discs. Returns `from` if nobody else qualifies. */
function nextAlive(
  players: PlayerId[],
  alive: (id: PlayerId) => boolean,
  from: PlayerId,
): PlayerId {
  const idx = players.indexOf(from);
  if (idx === -1) return from;
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const pid = players[(idx + step) % n]!;
    if (alive(pid)) return pid;
  }
  return from;
}

function alivePredicate(state: SkullState): (id: PlayerId) => boolean {
  return (id) =>
    !isEliminated(state.hand[id], state.stacks[id]?.length ?? 0);
}

function everyonePlaced(state: SkullState): boolean {
  // Bidding is only legal once every still-in player has at least one disc stacked.
  for (const id of state.players) {
    const stack = state.stacks[id] ?? [];
    const hand = state.hand[id];
    if (isEliminated(hand, stack.length)) continue;
    if (stack.length === 0) return false;
  }
  return true;
}

function aliveCount(state: SkullState): number {
  return state.players.filter(alivePredicate(state)).length;
}

function resetRound(state: SkullState, starter: PlayerId): SkullState {
  const hand: Record<PlayerId, SkullHand> = {};
  const stacks: Record<PlayerId, DiscKind[]> = {};
  const flippedFromStack: Record<PlayerId, number> = {};
  for (const id of state.players) {
    const prevHand = state.hand[id];
    const prevStackLen = state.stacks[id]?.length ?? 0;
    if (isEliminated(prevHand, prevStackLen)) {
      hand[id] = { flowers: 0, skulls: 0 };
      stacks[id] = [];
      flippedFromStack[id] = 0;
      continue;
    }
    // Reconstruct a fresh hand minus any permanently-lost discs.
    const total = (prevHand?.flowers ?? 0) + (prevHand?.skulls ?? 0) + prevStackLen;
    const lost = DISCS_PER_PLAYER - total;
    // Preference: flower losses first so the skull stays in the game.
    let flowers = FLOWERS_PER_PLAYER;
    let skulls = SKULLS_PER_PLAYER;
    let toSubtract = Math.max(0, lost);
    if (toSubtract > 0 && flowers > 0) {
      const remove = Math.min(flowers, toSubtract);
      flowers -= remove;
      toSubtract -= remove;
    }
    if (toSubtract > 0 && skulls > 0) {
      const remove = Math.min(skulls, toSubtract);
      skulls -= remove;
      toSubtract -= remove;
    }
    hand[id] = { flowers, skulls };
    stacks[id] = [];
    flippedFromStack[id] = 0;
  }
  return {
    ...state,
    hand,
    stacks,
    current: starter,
    phase: "placing",
    currentBid: null,
    passed: [],
    challenger: null,
    flips: [],
    flippedFromStack,
    nextStarter: null,
    lastResult: null,
  };
}

/** Choose a disc for the challenger to lose — preference for skulls? No — random across *all* remaining discs. */
function loseRandomDisc(
  state: SkullState,
  who: PlayerId,
  ctx: GameContext,
): { nextState: SkullState; lost: DiscKind } {
  const stack = [...(state.stacks[who] ?? [])];
  const handObj = state.hand[who] ?? { flowers: 0, skulls: 0 };

  // Build a bag of references: stack discs (by index) + hand entries.
  type Slot =
    | { where: "stack"; index: number }
    | { where: "hand"; kind: DiscKind };
  const bag: Slot[] = [];
  stack.forEach((_, i) => bag.push({ where: "stack", index: i }));
  for (let i = 0; i < handObj.flowers; i++)
    bag.push({ where: "hand", kind: "flower" });
  for (let i = 0; i < handObj.skulls; i++)
    bag.push({ where: "hand", kind: "skull" });

  if (bag.length === 0) {
    return { nextState: state, lost: "flower" };
  }

  const pick = bag[Math.floor(ctx.rng() * bag.length)]!;
  let lost: DiscKind;
  let nextStack = stack;
  let nextHand = { ...handObj };

  if (pick.where === "stack") {
    lost = stack[pick.index]!;
    nextStack = stack.filter((_, i) => i !== pick.index);
  } else {
    lost = pick.kind;
    if (lost === "flower") nextHand.flowers -= 1;
    else nextHand.skulls -= 1;
  }

  return {
    nextState: {
      ...state,
      stacks: { ...state.stacks, [who]: nextStack },
      hand: { ...state.hand, [who]: nextHand },
    },
    lost,
  };
}

function revealEveryone(state: SkullState): Record<PlayerId, DiscKind[]> {
  const out: Record<PlayerId, DiscKind[]> = {};
  for (const id of state.players) {
    out[id] = [...(state.stacks[id] ?? [])];
  }
  return out;
}

/** Called when exactly one bidder remains during bidding phase. Transitions to flipping. */
function beginFlipping(state: SkullState, bidder: PlayerId): SkullState {
  const flippedFromStack: Record<PlayerId, number> = {};
  for (const id of state.players) flippedFromStack[id] = 0;
  return {
    ...state,
    phase: "flipping",
    current: bidder,
    challenger: bidder,
    flips: [],
    flippedFromStack,
  };
}

export const skullServerModule: GameModule<
  SkullState,
  SkullMove,
  SkullConfig,
  SkullView
> = {
  type: SKULL_TYPE,
  displayName: "Skull",
  description:
    "Bluff or fold. Hide a skull in your stack — bet your friends flip flowers.",
  category: "party",
  minPlayers: 3,
  maxPlayers: 6,

  defaultConfig(): SkullConfig {
    return {};
  },

  validateConfig(cfg: unknown): SkullConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: SkullConfig,
    ctx: GameContext,
  ): SkullState {
    if (players.length < 3 || players.length > 6) {
      throw new Error(`Skull requires 3–6 players, got ${players.length}`);
    }
    const seated = players.map((p) => p.id);
    const hand: Record<PlayerId, SkullHand> = {};
    const stacks: Record<PlayerId, DiscKind[]> = {};
    const points: Record<PlayerId, number> = {};
    const flippedFromStack: Record<PlayerId, number> = {};
    for (const id of seated) {
      hand[id] = freshHand();
      stacks[id] = [];
      points[id] = 0;
      flippedFromStack[id] = 0;
    }
    const first = seated[Math.floor(ctx.rng() * seated.length)]!;
    return {
      players: seated,
      hand,
      stacks,
      points,
      current: first,
      phase: "placing",
      currentBid: null,
      passed: [],
      challenger: null,
      flips: [],
      flippedFromStack,
      nextStarter: null,
      lastResult: null,
      winner: null,
    };
  },

  handleMove(
    state: SkullState,
    move: SkullMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<SkullState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") return { ok: false, reason: "Game is over" };
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    if (
      isEliminated(state.hand[actor], state.stacks[actor]?.length ?? 0) &&
      state.phase !== "roundOver"
    ) {
      return { ok: false, reason: "You are out of the game" };
    }

    const m = parsed.data;
    const alive = alivePredicate(state);

    if (state.phase === "placing") {
      if (state.current !== actor) {
        return { ok: false, reason: "Not your turn" };
      }

      if (m.kind === "place") {
        const h = state.hand[actor]!;
        if (m.disc === "flower" && h.flowers <= 0) {
          return { ok: false, reason: "No flowers left in hand" };
        }
        if (m.disc === "skull" && h.skulls <= 0) {
          return { ok: false, reason: "No skull left in hand" };
        }
        const stack = [...(state.stacks[actor] ?? [])];
        stack.push(m.disc);
        const nextHand: SkullHand = {
          flowers: h.flowers - (m.disc === "flower" ? 1 : 0),
          skulls: h.skulls - (m.disc === "skull" ? 1 : 0),
        };
        return {
          ok: true,
          state: {
            ...state,
            hand: { ...state.hand, [actor]: nextHand },
            stacks: { ...state.stacks, [actor]: stack },
            current: nextAlive(state.players, alive, actor),
          },
        };
      }

      if (m.kind === "bid") {
        if (!everyonePlaced(state)) {
          return {
            ok: false,
            reason: "Everyone still in must place at least one disc first",
          };
        }
        const totalDiscs = totalDiscsOnTable(state);
        if (m.count < 1 || m.count > totalDiscs) {
          return { ok: false, reason: `Bid must be 1..${totalDiscs}` };
        }
        const onlyOne = aliveCount(state) === 1;
        if (onlyOne) return { ok: false, reason: "Cannot bid alone" };
        const bidder = actor;
        const hasChallenge = m.count === totalDiscs;
        if (hasChallenge) {
          // Immediate flipping — all others auto-passed.
          const passed = state.players.filter(
            (id) => id !== bidder && alive(id),
          );
          const next = {
            ...state,
            phase: "bidding" as const,
            currentBid: { count: m.count, by: bidder },
            passed,
          };
          return { ok: true, state: beginFlipping(next, bidder) };
        }
        return {
          ok: true,
          state: {
            ...state,
            phase: "bidding",
            currentBid: { count: m.count, by: bidder },
            passed: [],
            current: nextAlive(state.players, alive, actor),
          },
        };
      }

      return {
        ok: false,
        reason: "Place a disc or open a bid",
      };
    }

    if (state.phase === "bidding") {
      if (state.current !== actor) {
        return { ok: false, reason: "Not your turn to bid" };
      }
      if (state.passed.includes(actor)) {
        return { ok: false, reason: "You have already passed this round" };
      }

      if (m.kind === "bid") {
        const totalDiscs = totalDiscsOnTable(state);
        const prev = state.currentBid;
        if (prev === null) {
          return { ok: false, reason: "No live bid — invalid state" };
        }
        if (m.count <= prev.count) {
          return { ok: false, reason: "Bid must raise the current bid" };
        }
        if (m.count > totalDiscs) {
          return { ok: false, reason: `Bid cannot exceed ${totalDiscs}` };
        }
        const nextBid = { count: m.count, by: actor };
        // If you match the max, others auto-pass and you challenge now.
        if (m.count === totalDiscs) {
          const passed = state.players.filter(
            (id) => id !== actor && alive(id),
          );
          return {
            ok: true,
            state: beginFlipping(
              { ...state, currentBid: nextBid, passed },
              actor,
            ),
          };
        }
        // Advance to the next non-passed alive player.
        let next = nextAlive(state.players, alive, actor);
        const passedSet = new Set(state.passed);
        // Skip anyone who's already passed.
        {
          let guard = 0;
          while (passedSet.has(next) && guard < state.players.length) {
            next = nextAlive(state.players, alive, next);
            guard++;
          }
        }
        return {
          ok: true,
          state: {
            ...state,
            currentBid: nextBid,
            current: next,
          },
        };
      }

      if (m.kind === "pass") {
        const passed = [...state.passed, actor];
        const livePlayers = state.players.filter(alive);
        const remaining = livePlayers.filter((id) => !passed.includes(id));
        if (remaining.length === 1) {
          const bidder = state.currentBid?.by ?? remaining[0]!;
          return {
            ok: true,
            state: beginFlipping({ ...state, passed }, bidder),
          };
        }
        // Next un-passed player clockwise from actor.
        let next = nextAlive(state.players, alive, actor);
        const passedSet = new Set(passed);
        {
          let guard = 0;
          while (passedSet.has(next) && guard < state.players.length) {
            next = nextAlive(state.players, alive, next);
            guard++;
          }
        }
        return {
          ok: true,
          state: { ...state, passed, current: next },
        };
      }

      return { ok: false, reason: "Bid or pass" };
    }

    if (state.phase === "flipping") {
      if (state.challenger !== actor) {
        return { ok: false, reason: "Only the challenger flips" };
      }
      if (m.kind !== "flip") {
        return { ok: false, reason: "You must flip a disc" };
      }
      const target = m.target;
      if (!state.players.includes(target)) {
        return { ok: false, reason: "Unknown target" };
      }
      const ownFlipped = state.flippedFromStack[actor] ?? 0;
      const ownStackLen = state.stacks[actor]?.length ?? 0;
      const ownRemaining = ownStackLen - ownFlipped;
      if (ownRemaining > 0 && target !== actor) {
        return {
          ok: false,
          reason: "Flip your own stack first",
        };
      }
      const targetFlipped = state.flippedFromStack[target] ?? 0;
      const targetStackLen = state.stacks[target]?.length ?? 0;
      if (targetFlipped >= targetStackLen) {
        return { ok: false, reason: "That stack is fully flipped" };
      }
      // Flip the top-most un-flipped disc of that stack = index (stackLen - 1 - flipped).
      const stack = state.stacks[target]!;
      const discIndex = stack.length - 1 - targetFlipped;
      const disc = stack[discIndex]!;
      const flip: SkullFlip = { owner: target, disc };

      const nextFlips = [...state.flips, flip];
      const nextFlippedFromStack = {
        ...state.flippedFromStack,
        [target]: targetFlipped + 1,
      };

      if (disc === "skull") {
        // Failure — challenger loses a random disc.
        const { nextState: afterLoss, lost } = loseRandomDisc(
          {
            ...state,
            flips: nextFlips,
            flippedFromStack: nextFlippedFromStack,
          },
          actor,
          ctx,
        );
        return finalizeRound(afterLoss, "failure", actor, lost);
      }

      const bidCount = state.currentBid!.count;
      if (nextFlips.length >= bidCount) {
        // Success!
        const afterPoint: SkullState = {
          ...state,
          flips: nextFlips,
          flippedFromStack: nextFlippedFromStack,
          points: { ...state.points, [actor]: (state.points[actor] ?? 0) + 1 },
        };
        return finalizeRound(afterPoint, "success", actor, null);
      }

      return {
        ok: true,
        state: {
          ...state,
          flips: nextFlips,
          flippedFromStack: nextFlippedFromStack,
        },
      };
    }

    if (state.phase === "roundOver") {
      if (m.kind !== "startNextRound") {
        return { ok: false, reason: "Advance to the next round first" };
      }
      const starter = state.nextStarter!;
      if (actor !== starter) {
        return { ok: false, reason: "Only the round starter advances" };
      }
      return { ok: true, state: resetRound(state, starter) };
    }

    return { ok: false, reason: "Unknown phase" };
  },

  view(state: SkullState, viewer: Viewer): SkullView {
    const isSpectator = viewer === "spectator";

    const handCount: Record<PlayerId, number> = {};
    const stackCount: Record<PlayerId, number> = {};
    for (const id of state.players) {
      const h = state.hand[id];
      handCount[id] = (h?.flowers ?? 0) + (h?.skulls ?? 0);
      stackCount[id] = state.stacks[id]?.length ?? 0;
    }

    const myHand: SkullHand | null =
      !isSpectator && state.hand[viewer]
        ? { ...state.hand[viewer]! }
        : null;
    const myStack: DiscKind[] =
      !isSpectator && state.stacks[viewer] ? [...state.stacks[viewer]!] : [];

    // During flipping, all flipped discs are public.
    const flipped: SkullFlip[] | null =
      state.phase === "flipping"
        ? state.flips.map((f) => ({ ...f }))
        : null;

    return {
      players: [...state.players],
      myHand,
      handCount,
      myStack,
      stackCount,
      flipped,
      flippedFromStack: { ...state.flippedFromStack },
      points: { ...state.points },
      current: state.current,
      phase: state.phase,
      currentBid: state.currentBid ? { ...state.currentBid } : null,
      passed: [...state.passed],
      challenger: state.challenger,
      nextStarter: state.nextStarter,
      lastResult: state.lastResult
        ? cloneResult(state.lastResult)
        : null,
      winner: state.winner,
    };
  },

  phase(state: SkullState): PhaseId {
    return state.phase;
  },

  currentActors(state: SkullState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return [state.current];
  },

  isTerminal(state: SkullState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: SkullState): Outcome | null {
    if (!state.winner) return null;
    const losers = state.players.filter((id) => id !== state.winner);
    return { kind: "solo", winners: [state.winner], losers };
  },
};

function cloneResult(r: SkullRoundResult): SkullRoundResult {
  const revealed: Record<PlayerId, DiscKind[]> = {};
  for (const [k, v] of Object.entries(r.revealed)) revealed[k] = [...v];
  return {
    ...r,
    flips: r.flips.map((f) => ({ ...f })),
    revealed,
  };
}

function finalizeRound(
  state: SkullState,
  outcome: "success" | "failure",
  challenger: PlayerId,
  lostDisc: DiscKind | null,
): MoveResult<SkullState> {
  const bid = state.currentBid?.count ?? 0;
  const scorer = outcome === "success" ? challenger : null;
  const revealed = revealEveryone(state);

  // Check terminal conditions on the state *after* the disc loss / point gain.
  const alive = state.players.filter((id) => {
    const h = state.hand[id];
    const sl = state.stacks[id]?.length ?? 0;
    return !isEliminated(h, sl);
  });

  const winnerFromPoints =
    (state.points[challenger] ?? 0) >= POINTS_TO_WIN && outcome === "success"
      ? challenger
      : null;
  const winnerFromLastStanding = alive.length <= 1 ? (alive[0] ?? null) : null;
  const winner = winnerFromPoints ?? winnerFromLastStanding;

  const result: SkullRoundResult = {
    outcome,
    challenger,
    bid,
    flips: state.flips.map((f) => ({ ...f })),
    lostDisc,
    scorer,
    revealed,
  };

  if (winner) {
    return {
      ok: true,
      state: {
        ...state,
        phase: "gameOver",
        winner,
        currentBid: null,
        challenger: null,
        lastResult: result,
        nextStarter: null,
      },
    };
  }

  // Next starter: the player who scored, or the next alive seat after the
  // challenger (so losses keep the table moving).
  const aliveSet = new Set(alive);
  const nextStarter =
    outcome === "success" && aliveSet.has(challenger)
      ? challenger
      : nextAlive(state.players, (id) => aliveSet.has(id), challenger);

  return {
    ok: true,
    state: {
      ...state,
      phase: "roundOver",
      currentBid: null,
      challenger: null,
      current: nextStarter,
      nextStarter,
      lastResult: result,
    },
  };
}
