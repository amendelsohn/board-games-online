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
  BOARD_SIZE,
  QUORIDOR_TYPE,
  WALLS_PER_PLAYER,
  canReachGoal,
  goalRow,
  legalPawnDestinations,
  moveSchema,
  posEq,
  wallConflicts,
  type Pos,
  type QuoridorConfig,
  type QuoridorMove,
  type QuoridorState,
  type QuoridorView,
} from "./shared";

export const quoridorServerModule: GameModule<
  QuoridorState,
  QuoridorMove,
  QuoridorConfig,
  QuoridorView
> = {
  type: QUORIDOR_TYPE,
  displayName: "Quoridor",
  description:
    "Race your pawn to the far side — or drop walls to trap the other guy.",
  category: "strategy",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): QuoridorConfig {
    return {};
  },

  validateConfig(cfg: unknown): QuoridorConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: QuoridorConfig,
    ctx: GameContext,
  ): QuoridorState {
    if (players.length !== 2) {
      throw new Error(
        `Quoridor requires exactly 2 players, got ${players.length}`,
      );
    }
    const firstIsA = ctx.rng() < 0.5;
    const [a, b] = players;
    const p1 = firstIsA ? a! : b!;
    const p2 = firstIsA ? b! : a!;
    return {
      players: [p1.id, p2.id],
      pos: {
        [p1.id]: { row: 0, col: Math.floor(BOARD_SIZE / 2) },
        [p2.id]: { row: BOARD_SIZE - 1, col: Math.floor(BOARD_SIZE / 2) },
      },
      wallsLeft: {
        [p1.id]: WALLS_PER_PLAYER,
        [p2.id]: WALLS_PER_PLAYER,
      },
      walls: [],
      current: p1.id,
      winner: null,
      moveNumber: 0,
      lastMove: null,
    };
  },

  handleMove(
    state: QuoridorState,
    move: QuoridorMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<QuoridorState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }

    const m = parsed.data;
    const opponentId = state.players.find((id) => id !== actor)!;
    const myPos = state.pos[actor]!;
    const oppPos = state.pos[opponentId]!;

    if (m.kind === "move") {
      const legal = legalPawnDestinations(myPos, oppPos, state.walls);
      const to = m.to;
      if (!legal.some((p) => posEq(p, to))) {
        return { ok: false, reason: "Not a legal move" };
      }
      const nextPos = { ...state.pos, [actor]: to };
      const myGoal = goalRow(state.players, actor);
      const winner = to.row === myGoal ? actor : null;
      return {
        ok: true,
        state: {
          ...state,
          pos: nextPos,
          current: winner ? actor : opponentId,
          winner,
          moveNumber: state.moveNumber + 1,
          lastMove: { kind: "move", by: actor, from: myPos, to },
        },
      };
    }

    // Wall placement.
    const wall = m.wall;
    if ((state.wallsLeft[actor] ?? 0) <= 0) {
      return { ok: false, reason: "No walls left" };
    }
    if (wallConflicts(wall, state.walls)) {
      return { ok: false, reason: "Wall conflicts with an existing wall" };
    }
    const walls = [...state.walls, wall];
    // Both paths must still be reachable.
    const p1Goal = goalRow(state.players, state.players[0]);
    const p2Goal = goalRow(state.players, state.players[1]);
    if (!canReachGoal(state.pos[state.players[0]]!, p1Goal, walls)) {
      return { ok: false, reason: "Wall would fully block a pawn" };
    }
    if (!canReachGoal(state.pos[state.players[1]]!, p2Goal, walls)) {
      return { ok: false, reason: "Wall would fully block a pawn" };
    }
    return {
      ok: true,
      state: {
        ...state,
        walls,
        wallsLeft: {
          ...state.wallsLeft,
          [actor]: (state.wallsLeft[actor] ?? 0) - 1,
        },
        current: opponentId,
        moveNumber: state.moveNumber + 1,
        lastMove: { kind: "wall", by: actor, wall },
      },
    };
  },

  view(state: QuoridorState, viewer: Viewer): QuoridorView {
    const viewerId = viewer === "spectator" ? null : viewer;
    const actor =
      state.winner === null &&
      viewerId !== null &&
      state.current === viewerId
        ? viewerId
        : null;

    let legalMoves: Pos[] = [];
    if (actor !== null) {
      const opp = state.players.find((id) => id !== actor)!;
      legalMoves = legalPawnDestinations(
        state.pos[actor]!,
        state.pos[opp]!,
        state.walls,
      );
    }

    return {
      players: [state.players[0], state.players[1]],
      pos: Object.fromEntries(
        Object.entries(state.pos).map(([k, v]) => [k, { ...v }]),
      ),
      wallsLeft: { ...state.wallsLeft },
      walls: state.walls.map((w) => ({ ...w })),
      current: state.current,
      winner: state.winner,
      moveNumber: state.moveNumber,
      lastMove: state.lastMove
        ? typeof state.lastMove === "object" && state.lastMove.kind === "move"
          ? {
              kind: "move",
              by: state.lastMove.by,
              from: { ...state.lastMove.from },
              to: { ...state.lastMove.to },
            }
          : {
              kind: "wall",
              by: state.lastMove.by,
              wall: { ...state.lastMove.wall },
            }
        : null,
      legalMoves,
    };
  },

  phase(state: QuoridorState): PhaseId {
    return state.winner ? "gameOver" : "play";
  },

  currentActors(state: QuoridorState): PlayerId[] {
    return state.winner ? [] : [state.current];
  },

  isTerminal(state: QuoridorState): boolean {
    return state.winner !== null;
  },

  outcome(state: QuoridorState): Outcome | null {
    if (!state.winner) return null;
    const losers = state.players.filter((id) => id !== state.winner);
    return { kind: "solo", winners: [state.winner], losers };
  },
};
