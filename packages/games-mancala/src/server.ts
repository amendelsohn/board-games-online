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
  MANCALA_TYPE,
  PITS_PER_SIDE,
  initialBoard,
  moveSchema,
  pitIndex,
  sideEmpty,
  sow,
  sweepSide,
  storeIndex,
  type MancalaConfig,
  type MancalaMove,
  type MancalaState,
  type MancalaView,
  type Side,
} from "./shared";

export const mancalaServerModule: GameModule<
  MancalaState,
  MancalaMove,
  MancalaConfig,
  MancalaView
> = {
  type: MANCALA_TYPE,
  displayName: "Mancala",
  description: "Sow stones, capture the opposite pit, fill your store.",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): MancalaConfig {
    return {};
  },

  validateConfig(cfg: unknown): MancalaConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: MancalaConfig,
    ctx: GameContext,
  ): MancalaState {
    if (players.length !== 2) {
      throw new Error(`mancala requires exactly 2 players, got ${players.length}`);
    }
    const aFirst = ctx.rng() < 0.5;
    const [p0, p1] = players;
    const a = aFirst ? p0! : p1!;
    const b = aFirst ? p1! : p0!;
    const sides: Record<PlayerId, Side> = { [a.id]: "A", [b.id]: "B" };
    // Side A always goes first in our setup; we randomize which player is A.
    return {
      board: initialBoard(),
      players: [a.id, b.id],
      sides,
      current: a.id,
      winner: null,
      isDraw: false,
      lastMove: null,
      lastCaptured: null,
    };
  },

  handleMove(
    state: MancalaState,
    move: MancalaMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<MancalaState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner || state.isDraw) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    const side = state.sides[actor];
    if (!side) return { ok: false, reason: "You are not in this match" };

    const { pitIndex: rel } = parsed.data;
    if (rel < 0 || rel >= PITS_PER_SIDE) {
      return { ok: false, reason: "Pit out of range" };
    }
    const abs = pitIndex(side, rel);
    if ((state.board[abs] ?? 0) <= 0) {
      return { ok: false, reason: "Pit is empty" };
    }

    const result = sow(state.board, side, rel);
    let board = result.next;
    // `pit` = your own pit where the last stone landed (capturing pit);
    // `pickupPit` = opponent pit whose stones were scooped into your store.
    const lastCaptured = result.captured
      ? {
          pit: result.captured.landingPit,
          pickupPit: result.captured.oppositePit,
        }
      : null;

    // Check end-of-game: game ends when either side has no stones in its playing pits.
    const aEmpty = sideEmpty(board, "A");
    const bEmpty = sideEmpty(board, "B");
    const terminal = aEmpty || bEmpty;

    if (terminal) {
      if (aEmpty && !bEmpty) board = sweepSide(board, "B");
      else if (bEmpty && !aEmpty) board = sweepSide(board, "A");
      // If both sides are simultaneously empty (possible after a capture), no sweep needed.
      const aScore = board[storeIndex("A")] ?? 0;
      const bScore = board[storeIndex("B")] ?? 0;
      const aId = state.players.find((id) => state.sides[id] === "A")!;
      const bId = state.players.find((id) => state.sides[id] === "B")!;
      const winner =
        aScore > bScore ? aId : bScore > aScore ? bId : null;
      const isDraw = winner === null;
      return {
        ok: true,
        state: {
          ...state,
          board,
          current: actor,
          winner,
          isDraw,
          lastMove: { pit: abs, by: actor },
          lastCaptured,
        },
      };
    }

    const nextActor = result.extraTurn
      ? actor
      : state.players.find((id) => id !== actor) ?? actor;

    return {
      ok: true,
      state: {
        ...state,
        board,
        current: nextActor,
        winner: null,
        isDraw: false,
        lastMove: { pit: abs, by: actor },
        lastCaptured,
      },
    };
  },

  view(state: MancalaState, _viewer: Viewer): MancalaView {
    return {
      board: state.board.slice(),
      players: [state.players[0], state.players[1]],
      sides: { ...state.sides },
      current: state.current,
      winner: state.winner,
      isDraw: state.isDraw,
      lastMove: state.lastMove,
      lastCaptured: state.lastCaptured,
    };
  },

  phase(state: MancalaState): PhaseId {
    return state.winner || state.isDraw ? "gameOver" : "play";
  },

  currentActors(state: MancalaState): PlayerId[] {
    return state.winner || state.isDraw ? [] : [state.current];
  },

  isTerminal(state: MancalaState): boolean {
    return state.winner !== null || state.isDraw;
  },

  outcome(state: MancalaState): Outcome | null {
    if (state.winner) {
      const losers = state.players.filter((id) => id !== state.winner);
      return { kind: "solo", winners: [state.winner], losers };
    }
    if (state.isDraw) return { kind: "draw" };
    return null;
  },
};
