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
  DICE_COUNT,
  MAX_ROLLS_PER_TURN,
  YAHTZEE_TYPE,
  cardFilled,
  grandTotal,
  moveSchema,
  scoreFor,
  type Scorecard,
  type YahtzeeConfig,
  type YahtzeeMove,
  type YahtzeeState,
  type YahtzeeView,
} from "./shared";

function emptyDice(): number[] {
  return new Array(DICE_COUNT).fill(0);
}

function emptyKept(): boolean[] {
  return new Array(DICE_COUNT).fill(false);
}

function rollDie(ctx: GameContext): number {
  // ctx.rng() ∈ [0, 1) → 1..6
  return Math.floor(ctx.rng() * 6) + 1;
}

function nextPlayer(players: readonly PlayerId[], current: PlayerId): PlayerId {
  const idx = players.indexOf(current);
  if (idx < 0) return players[0]!;
  return players[(idx + 1) % players.length]!;
}

function allCardsFilled(state: YahtzeeState): boolean {
  for (const pid of state.players) {
    const card = state.scorecards[pid];
    if (!card || !cardFilled(card)) return false;
  }
  return true;
}

export const yahtzeeServerModule: GameModule<
  YahtzeeState,
  YahtzeeMove,
  YahtzeeConfig,
  YahtzeeView
> = {
  type: YAHTZEE_TYPE,
  displayName: "Yahtzee",
  description: "Roll, reroll, lock in — claim the right scorecard slots.",
  minPlayers: 2,
  maxPlayers: 4,

  defaultConfig(): YahtzeeConfig {
    return {};
  },

  validateConfig(cfg: unknown): YahtzeeConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: YahtzeeConfig,
    ctx: GameContext,
  ): YahtzeeState {
    if (players.length < 2 || players.length > 4) {
      throw new Error(
        `yahtzee requires 2–4 players, got ${players.length}`,
      );
    }
    const order = shuffle(
      players.map((p) => p.id),
      ctx.rng,
    );
    const scorecards: Record<PlayerId, Scorecard> = {};
    for (const id of order) scorecards[id] = {};
    return {
      players: order,
      current: order[0]!,
      turnRollNumber: 0,
      dice: emptyDice(),
      kept: emptyKept(),
      scorecards,
      winner: null,
      isDraw: false,
      phase: "playing",
    };
  },

  handleMove(
    state: YahtzeeState,
    move: YahtzeeMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<YahtzeeState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    if (!(actor in state.scorecards)) {
      return { ok: false, reason: "You are not in this match" };
    }

    const data = parsed.data;

    if (data.kind === "roll") {
      if (state.turnRollNumber >= MAX_ROLLS_PER_TURN) {
        return { ok: false, reason: "No rolls left this turn" };
      }
      const isFirstRoll = state.turnRollNumber === 0;
      const nextDice = state.dice.slice();
      const nextKept = data.keepMask.slice();
      for (let i = 0; i < DICE_COUNT; i++) {
        // First roll ignores keepMask — all dice are fresh.
        const keep = !isFirstRoll && data.keepMask[i] === true;
        if (!keep) nextDice[i] = rollDie(ctx);
      }
      // On the first roll, no die is "kept" yet.
      const recordedKept = isFirstRoll ? emptyKept() : nextKept;
      return {
        ok: true,
        state: {
          ...state,
          dice: nextDice,
          kept: recordedKept,
          turnRollNumber: state.turnRollNumber + 1,
        },
      };
    }

    // assign
    if (state.turnRollNumber === 0) {
      return { ok: false, reason: "Roll at least once before assigning" };
    }
    const card = state.scorecards[actor]!;
    if (typeof card[data.category] === "number") {
      return { ok: false, reason: "Category already filled" };
    }
    const nextCard: Scorecard = {
      ...card,
      [data.category]: scoreFor(data.category, state.dice),
    };
    const nextScorecards: Record<PlayerId, Scorecard> = {
      ...state.scorecards,
      [actor]: nextCard,
    };
    const nextState: YahtzeeState = {
      ...state,
      scorecards: nextScorecards,
      dice: emptyDice(),
      kept: emptyKept(),
      turnRollNumber: 0,
      current: nextPlayer(state.players, state.current),
    };
    if (allCardsFilled(nextState)) {
      // Final scoring: highest grand total wins, ties → draw.
      let best = -Infinity;
      let winners: PlayerId[] = [];
      for (const pid of nextState.players) {
        const total = grandTotal(nextState.scorecards[pid]!);
        if (total > best) {
          best = total;
          winners = [pid];
        } else if (total === best) {
          winners.push(pid);
        }
      }
      return {
        ok: true,
        state: {
          ...nextState,
          phase: "gameOver",
          winner: winners.length === 1 ? winners[0]! : null,
          isDraw: winners.length > 1,
        },
      };
    }
    return { ok: true, state: nextState };
  },

  view(state: YahtzeeState, _viewer: Viewer): YahtzeeView {
    const scorecards: Record<PlayerId, Scorecard> = {};
    for (const pid of state.players) {
      scorecards[pid] = { ...(state.scorecards[pid] ?? {}) };
    }
    return {
      players: state.players.slice(),
      current: state.current,
      turnRollNumber: state.turnRollNumber,
      dice: state.dice.slice(),
      kept: state.kept.slice(),
      scorecards,
      winner: state.winner,
      isDraw: state.isDraw,
      phase: state.phase,
    };
  },

  phase(state: YahtzeeState): PhaseId {
    return state.phase;
  },

  currentActors(state: YahtzeeState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return [state.current];
  },

  isTerminal(state: YahtzeeState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: YahtzeeState): Outcome | null {
    if (state.phase !== "gameOver") return null;
    if (state.winner) {
      const losers = state.players.filter((id) => id !== state.winner);
      return { kind: "solo", winners: [state.winner], losers };
    }
    if (state.isDraw) return { kind: "draw" };
    return null;
  },
};
