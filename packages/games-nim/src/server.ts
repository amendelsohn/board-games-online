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
  INITIAL_PILES,
  NIM_TYPE,
  moveSchema,
  type NimConfig,
  type NimMove,
  type NimState,
  type NimView,
} from "./shared";

export const nimServerModule: GameModule<NimState, NimMove, NimConfig, NimView> = {
  type: NIM_TYPE,
  displayName: "Nim",
  description: "Take from one pile at a time — don't be the one left with nothing.",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): NimConfig {
    return {};
  },

  validateConfig(cfg: unknown): NimConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: NimConfig,
    ctx: GameContext,
  ): NimState {
    if (players.length !== 2) {
      throw new Error(`nim requires exactly 2 players, got ${players.length}`);
    }
    const firstIsA = ctx.rng() < 0.5;
    const [a, b] = players;
    const first = firstIsA ? a! : b!;
    const second = firstIsA ? b! : a!;
    return {
      piles: INITIAL_PILES.slice(),
      current: first.id,
      players: [first.id, second.id],
      winner: null,
      lastMove: null,
    };
  },

  handleMove(
    state: NimState,
    move: NimMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<NimState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }

    const { pile, count } = parsed.data;
    if (pile < 0 || pile > 2) return { ok: false, reason: "Invalid pile" };
    const available = state.piles[pile] ?? 0;
    if (available <= 0) return { ok: false, reason: "Pile is empty" };
    if (count < 1) return { ok: false, reason: "Must take at least 1 stone" };
    if (count > available) {
      return { ok: false, reason: `Pile only has ${available} stones` };
    }

    const piles = state.piles.slice();
    piles[pile] = available - count;

    const allEmpty = piles.every((n) => n === 0);
    // Normal play: the player who takes the last stone wins.
    const winner = allEmpty ? actor : null;

    const nextPlayer =
      state.players.find((id) => id !== actor) ?? actor;

    return {
      ok: true,
      state: {
        piles,
        current: winner ? actor : nextPlayer,
        players: state.players,
        winner,
        lastMove: { pile, count, by: actor },
      },
    };
  },

  view(state: NimState, _viewer: Viewer): NimView {
    return {
      piles: state.piles.slice(),
      current: state.current,
      players: [state.players[0], state.players[1]],
      winner: state.winner,
      lastMove: state.lastMove ? { ...state.lastMove } : null,
    };
  },

  phase(state: NimState): PhaseId {
    return state.winner ? "gameOver" : "play";
  },

  currentActors(state: NimState): PlayerId[] {
    return state.winner ? [] : [state.current];
  },

  isTerminal(state: NimState): boolean {
    return state.winner !== null;
  },

  outcome(state: NimState): Outcome | null {
    if (!state.winner) return null;
    const losers = state.players.filter((id) => id !== state.winner);
    return { kind: "solo", winners: [state.winner], losers };
  },
};
