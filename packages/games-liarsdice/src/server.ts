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
  DICE_PER_PLAYER,
  DIE_FACES,
  LIARS_DICE_TYPE,
  isStrictRaise,
  moveSchema,
  type Face,
  type LiarsDiceBidOnTable,
  type LiarsDiceConfig,
  type LiarsDiceMove,
  type LiarsDiceReveal,
  type LiarsDiceState,
  type LiarsDiceView,
} from "./shared";

function rollDie(ctx: GameContext): number {
  return Math.floor(ctx.rng() * DIE_FACES) + 1;
}

function rollCup(n: number, ctx: GameContext): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rollDie(ctx));
  return out;
}

/**
 * Count actual matches across all cups. Ones are wild for any non-one face;
 * when the bid is face=1, ones count as ones (no wild).
 */
function countActual(dice: Record<PlayerId, number[]>, face: Face): number {
  let n = 0;
  for (const hand of Object.values(dice)) {
    for (const d of hand) {
      if (d === face) n++;
      else if (face !== 1 && d === 1) n++;
    }
  }
  return n;
}

/** Next seat that still has dice, clockwise from `from`. */
function nextAlive(
  players: PlayerId[],
  diceCount: Record<PlayerId, number>,
  from: PlayerId,
): PlayerId {
  const idx = players.indexOf(from);
  if (idx === -1) throw new Error("nextAlive: unknown player");
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const pid = players[(idx + step) % n]!;
    if (diceCount[pid]! > 0) return pid;
  }
  return from;
}

/**
 * A reveal fires when the challenger is someone *other than* the bidder,
 * so the starter of the next round is: the bidder if they lost a die, the
 * challenger if they lost a die, or the spot-on caller regardless.
 */
function pickNextStarter(
  players: PlayerId[],
  diceCount: Record<PlayerId, number>,
  preferred: PlayerId,
  fallback: PlayerId,
): PlayerId {
  if ((diceCount[preferred] ?? 0) > 0) return preferred;
  return nextAlive(players, diceCount, fallback);
}

export const liarsDiceServerModule: GameModule<
  LiarsDiceState,
  LiarsDiceMove,
  LiarsDiceConfig,
  LiarsDiceView
> = {
  type: LIARS_DICE_TYPE,
  displayName: "Liar's Dice",
  description: "Bid on hidden dice, call bluffs, outlast your opponents.",
  category: "cards-dice",
  minPlayers: 2,
  maxPlayers: 6,

  defaultConfig(): LiarsDiceConfig {
    return {};
  },

  validateConfig(cfg: unknown): LiarsDiceConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: LiarsDiceConfig,
    ctx: GameContext,
  ): LiarsDiceState {
    if (players.length < 2 || players.length > 6) {
      throw new Error(
        `Liar's Dice requires 2–6 players, got ${players.length}`,
      );
    }
    const seated = players.map((p) => p.id);
    const dice: Record<PlayerId, number[]> = {};
    const diceCount: Record<PlayerId, number> = {};
    for (const id of seated) {
      dice[id] = rollCup(DICE_PER_PLAYER, ctx);
      diceCount[id] = DICE_PER_PLAYER;
    }
    const first = seated[Math.floor(ctx.rng() * seated.length)]!;
    return {
      players: seated,
      dice,
      diceCount,
      currentBid: null,
      current: first,
      phase: "bidding",
      lastReveal: null,
      winner: null,
    };
  },

  handleMove(
    state: LiarsDiceState,
    move: LiarsDiceMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<LiarsDiceState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    if ((state.diceCount[actor] ?? 0) === 0) {
      return { ok: false, reason: "You are out of the game" };
    }

    const m = parsed.data;

    if (state.phase === "bidding") {
      if (state.current !== actor) {
        return { ok: false, reason: "Not your turn" };
      }
      if (m.kind === "startNextRound") {
        return { ok: false, reason: "No reveal to clear" };
      }

      if (m.kind === "bid") {
        if (state.currentBid === null) {
          // Opening bid: any count >= 1, face 1..6.
          const newBid: LiarsDiceBidOnTable = {
            count: m.count,
            face: m.face,
            by: actor,
          };
          return {
            ok: true,
            state: {
              ...state,
              currentBid: newBid,
              current: nextAlive(state.players, state.diceCount, actor),
            },
          };
        }
        if (
          !isStrictRaise(
            { count: state.currentBid.count, face: state.currentBid.face },
            { count: m.count, face: m.face },
          )
        ) {
          return { ok: false, reason: "Not a legal raise" };
        }
        const newBid: LiarsDiceBidOnTable = {
          count: m.count,
          face: m.face,
          by: actor,
        };
        return {
          ok: true,
          state: {
            ...state,
            currentBid: newBid,
            current: nextAlive(state.players, state.diceCount, actor),
          },
        };
      }

      if (m.kind === "challenge" || m.kind === "spotOn") {
        if (state.currentBid === null) {
          return {
            ok: false,
            reason: "No bid to challenge — make the opening bid",
          };
        }
        if (m.kind === "challenge" && state.currentBid.by === actor) {
          return { ok: false, reason: "You cannot challenge your own bid" };
        }
        return resolveReveal(state, actor, m.kind);
      }

      return { ok: false, reason: "Unknown move" };
    }

    if (state.phase === "reveal") {
      if (m.kind !== "startNextRound") {
        return { ok: false, reason: "Advance to the next round first" };
      }
      if (state.current !== actor) {
        return { ok: false, reason: "Only the round starter can advance" };
      }
      // Re-roll everyone's cups.
      const dice: Record<PlayerId, number[]> = {};
      for (const id of state.players) {
        const n = state.diceCount[id] ?? 0;
        dice[id] = n > 0 ? rollCup(n, ctx) : [];
      }
      return {
        ok: true,
        state: {
          ...state,
          dice,
          currentBid: null,
          lastReveal: null,
          phase: "bidding",
        },
      };
    }

    return { ok: false, reason: "Unknown phase" };
  },

  view(state: LiarsDiceState, viewer: Viewer): LiarsDiceView {
    const isSpectator = viewer === "spectator";
    const inReveal = state.phase === "reveal";

    // During reveal the cups are public; lastReveal.dice is the canonical
    // snapshot. Everyone — including spectators — sees it. Outside reveal,
    // cups stay private: spectators see nothing and every other player only
    // sees their own dice via `myDice`.
    const revealedDice = inReveal && state.lastReveal
      ? { ...state.lastReveal.dice }
      : null;

    const myDice: number[] | null = isSpectator
      ? null
      : state.dice[viewer] ? [...state.dice[viewer]!] : null;

    return {
      players: [...state.players],
      diceCount: { ...state.diceCount },
      myDice,
      revealedDice,
      currentBid: state.currentBid ? { ...state.currentBid } : null,
      current: state.current,
      phase: state.phase,
      lastReveal: state.lastReveal ? cloneReveal(state.lastReveal) : null,
      winner: state.winner,
    };
  },

  phase(state: LiarsDiceState): PhaseId {
    return state.phase;
  },

  currentActors(state: LiarsDiceState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return [state.current];
  },

  isTerminal(state: LiarsDiceState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: LiarsDiceState): Outcome | null {
    if (!state.winner) return null;
    const losers = state.players.filter((id) => id !== state.winner);
    return { kind: "solo", winners: [state.winner], losers };
  },
};

function cloneReveal(r: LiarsDiceReveal): LiarsDiceReveal {
  const dice: Record<PlayerId, number[]> = {};
  for (const [k, v] of Object.entries(r.dice)) dice[k] = [...v];
  return { ...r, dice, bid: { ...r.bid } };
}

function resolveReveal(
  state: LiarsDiceState,
  actor: PlayerId,
  kind: "challenge" | "spotOn",
): MoveResult<LiarsDiceState> {
  const bid = state.currentBid!;
  const actual = countActual(state.dice, bid.face);

  let loser: PlayerId;
  let winner: PlayerId | null = null;
  let resolution: LiarsDiceReveal["resolution"];
  const nextCount = { ...state.diceCount };

  if (kind === "challenge") {
    // Challenger wins iff actual < bid.count.
    if (actual >= bid.count) {
      loser = actor;
      resolution = "challengerLost";
      nextCount[actor] = Math.max(0, (nextCount[actor] ?? 0) - 1);
    } else {
      loser = bid.by;
      resolution = "bidderLost";
      nextCount[bid.by] = Math.max(0, (nextCount[bid.by] ?? 0) - 1);
    }
  } else {
    // spotOn — caller gains if actual == bid.count, else loses.
    if (actual === bid.count) {
      loser = actor; // nominal field — used for next-starter preference
      winner = actor;
      resolution = "spotOnWin";
      // Cap gain at DICE_PER_PLAYER.
      nextCount[actor] = Math.min(
        DICE_PER_PLAYER,
        (nextCount[actor] ?? 0) + 1,
      );
    } else {
      loser = actor;
      resolution = "spotOnLost";
      nextCount[actor] = Math.max(0, (nextCount[actor] ?? 0) - 1);
    }
  }

  // Rebuild dice: keep cups only for players who still have dice; hand sizes
  // are not re-shaped yet — rerolling happens on `startNextRound`. Drain any
  // cups that went to zero so we never carry stale dice.
  const dice: Record<PlayerId, number[]> = {};
  for (const id of state.players) {
    const n = nextCount[id] ?? 0;
    dice[id] = n > 0 ? [...(state.dice[id] ?? [])] : [];
  }

  // Next round starter: prefer the "loser" side if they still have dice; the
  // challenger/caller is always the actor, so that's our safe fallback.
  const preferred = loser;
  const fallback = actor;
  const stillAlive = state.players.filter((id) => (nextCount[id] ?? 0) > 0);

  // Check for terminal state (<=1 alive).
  if (stillAlive.length <= 1) {
    const soloWinner = stillAlive[0] ?? null;
    const reveal: LiarsDiceReveal = {
      dice: Object.fromEntries(
        state.players.map((id) => [id, [...(state.dice[id] ?? [])]]),
      ),
      resolution,
      loser,
      winner,
      bid: { ...bid },
      actual,
      nextStarter: soloWinner ?? actor,
    };
    return {
      ok: true,
      state: {
        ...state,
        dice,
        diceCount: nextCount,
        currentBid: null,
        phase: "gameOver",
        lastReveal: reveal,
        current: soloWinner ?? actor,
        winner: soloWinner,
      },
    };
  }

  // Choose the preferred starter if they still have dice; otherwise the
  // next alive seat clockwise from them.
  const nextStarter =
    (nextCount[preferred] ?? 0) > 0
      ? preferred
      : pickNextStarter(state.players, nextCount, preferred, fallback);
  // Guard: pickNextStarter falls back to `fallback`'s seat; still, if that
  // player has been eliminated (possible in edge cases), step from their seat.
  const finalStarter =
    (nextCount[nextStarter] ?? 0) > 0
      ? nextStarter
      : nextAlive(state.players, nextCount, nextStarter);

  const reveal: LiarsDiceReveal = {
    dice: Object.fromEntries(
      state.players.map((id) => [id, [...(state.dice[id] ?? [])]]),
    ),
    resolution,
    loser,
    winner,
    bid: { ...bid },
    actual,
    nextStarter: finalStarter,
  };

  return {
    ok: true,
    state: {
      ...state,
      dice,
      diceCount: nextCount,
      currentBid: null,
      phase: "reveal",
      lastReveal: reveal,
      current: finalStarter,
    },
  };
}
