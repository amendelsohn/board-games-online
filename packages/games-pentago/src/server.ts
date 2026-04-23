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
  PENTAGO_TYPE,
  boardFull,
  find5InRow,
  idx,
  moveSchema,
  rotateQuadrant,
  type PentagoConfig,
  type PentagoMove,
  type PentagoState,
  type PentagoView,
  type Stone,
} from "./shared";

function emptyBoard() {
  return new Array(BOARD_SIZE * BOARD_SIZE).fill(null) as (Stone | null)[];
}

function nextSeat(
  players: PlayerId[],
  from: PlayerId,
): PlayerId {
  const i = players.indexOf(from);
  if (i === -1) return players[0]!;
  return players[(i + 1) % players.length]!;
}

export const pentagoServerModule: GameModule<
  PentagoState,
  PentagoMove,
  PentagoConfig,
  PentagoView
> = {
  type: PENTAGO_TYPE,
  displayName: "Pentago",
  description:
    "Place a marble, then twist a quadrant. First to five in a row wins.",
  category: "strategy",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): PentagoConfig {
    return {};
  },

  validateConfig(cfg: unknown): PentagoConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: PentagoConfig,
    ctx: GameContext,
  ): PentagoState {
    if (players.length !== 2) {
      throw new Error(`Pentago requires exactly 2 players, got ${players.length}`);
    }
    const seated = players.map((p) => p.id);
    // Randomly assign white (first to move) and black.
    const firstIdx = Math.floor(ctx.rng() * 2);
    const firstId = seated[firstIdx]!;
    const secondId = seated[1 - firstIdx]!;
    const colors: Record<PlayerId, Stone> = {
      [firstId]: "white",
      [secondId]: "black",
    };
    return {
      players: seated,
      colors,
      board: emptyBoard(),
      current: firstId,
      phase: "place",
      turn: 1,
      lastPlacement: null,
      lastRotation: null,
      winningLine: null,
      winners: null,
      draw: false,
    };
  },

  handleMove(
    state: PentagoState,
    move: PentagoMove,
    actor: PlayerId,
  ): MoveResult<PentagoState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") return { ok: false, reason: "Game is over" };
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    if (state.current !== actor) {
      return { ok: false, reason: "Not your turn" };
    }

    const m = parsed.data;
    const myStone = state.colors[actor];
    if (!myStone) return { ok: false, reason: "No color assigned" };

    if (state.phase === "place") {
      if (m.kind !== "place") {
        return { ok: false, reason: "Place a marble first" };
      }
      const i = idx(m.row, m.col);
      if (state.board[i] !== null) {
        return { ok: false, reason: "Cell occupied" };
      }
      const next = [...state.board];
      next[i] = myStone;
      // After placement, check for win immediately (rules: a 5-in-row from
      // either step ends the game). Even if the player has won at this point,
      // they STILL need to rotate? Standard Pentago: the rotation is mandatory,
      // so the win check happens after the rotate. To keep it simple and clean
      // we follow that — rotate is required, then evaluate.
      return {
        ok: true,
        state: {
          ...state,
          board: next,
          phase: "rotate",
          lastPlacement: { row: m.row, col: m.col, stone: myStone },
        },
      };
    }

    // rotate phase
    if (m.kind !== "rotate") {
      return { ok: false, reason: "Rotate a quadrant to finish your turn" };
    }
    const newBoard = rotateQuadrant(state.board, m.quadrant, m.direction);

    // Check both colors — Pentago tradition: if both colors achieve 5 simultaneously
    // (possible because rotation can create lines for both), it's a draw.
    const myWin = find5InRow(newBoard, myStone);
    const opponent = state.players.find((p) => p !== actor)!;
    const oppStone = state.colors[opponent]!;
    const oppWin = find5InRow(newBoard, oppStone);

    if (myWin && oppWin) {
      return {
        ok: true,
        state: {
          ...state,
          board: newBoard,
          phase: "gameOver",
          turn: state.turn + 1,
          lastRotation: { quadrant: m.quadrant, direction: m.direction },
          // Show *something* highlighted — pick the active player's line.
          winningLine: myWin,
          winners: null,
          draw: true,
        },
      };
    }
    if (myWin) {
      return {
        ok: true,
        state: {
          ...state,
          board: newBoard,
          phase: "gameOver",
          turn: state.turn + 1,
          lastRotation: { quadrant: m.quadrant, direction: m.direction },
          winningLine: myWin,
          winners: [actor],
          draw: false,
        },
      };
    }
    if (oppWin) {
      return {
        ok: true,
        state: {
          ...state,
          board: newBoard,
          phase: "gameOver",
          turn: state.turn + 1,
          lastRotation: { quadrant: m.quadrant, direction: m.direction },
          winningLine: oppWin,
          winners: [opponent],
          draw: false,
        },
      };
    }

    if (boardFull(newBoard)) {
      return {
        ok: true,
        state: {
          ...state,
          board: newBoard,
          phase: "gameOver",
          turn: state.turn + 1,
          lastRotation: { quadrant: m.quadrant, direction: m.direction },
          winningLine: null,
          winners: null,
          draw: true,
        },
      };
    }

    return {
      ok: true,
      state: {
        ...state,
        board: newBoard,
        phase: "place",
        turn: state.turn + 1,
        current: nextSeat(state.players, actor),
        lastRotation: { quadrant: m.quadrant, direction: m.direction },
      },
    };
  },

  view(state: PentagoState, viewer: Viewer): PentagoView {
    return {
      players: [...state.players],
      colors: { ...state.colors },
      board: [...state.board],
      current: state.current,
      phase: state.phase,
      turn: state.turn,
      lastPlacement: state.lastPlacement
        ? { ...state.lastPlacement }
        : null,
      lastRotation: state.lastRotation
        ? { ...state.lastRotation }
        : null,
      winningLine: state.winningLine ? [...state.winningLine] : null,
      winners: state.winners ? [...state.winners] : null,
      draw: state.draw,
      me: viewer === "spectator" ? null : viewer,
    };
  },

  phase(state: PentagoState): PhaseId {
    return state.phase;
  },

  currentActors(state: PentagoState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return [state.current];
  },

  isTerminal(state: PentagoState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: PentagoState): Outcome | null {
    if (state.phase !== "gameOver") return null;
    if (state.draw && !state.winners) return { kind: "draw" };
    if (state.winners && state.winners.length > 0) {
      const losers = state.players.filter((id) => !state.winners!.includes(id));
      return { kind: "solo", winners: [...state.winners], losers };
    }
    return { kind: "draw" };
  },
};
