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
  CELL_COUNT,
  CHECKERS_TYPE,
  crownRow,
  idx,
  isKing,
  isPlayable,
  jumpsFrom,
  moveSchema,
  pieceColor,
  simpleMovesFrom,
  type Cell,
  type CheckersConfig,
  type CheckersMove,
  type CheckersState,
  type CheckersView,
  type Color,
  type Piece,
  type Square,
  type StepOption,
} from "./shared";

function buildInitialBoard(): Cell[] {
  const cells: Cell[] = new Array(CELL_COUNT).fill(null);
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!isPlayable(row, col)) continue;
      if (row < 3) cells[idx(row, col)] = "b"; // Black occupies rows 0-2
      else if (row > 4) cells[idx(row, col)] = "r"; // Red occupies rows 5-7
    }
  }
  return cells;
}

/** Every playable square that holds a piece of the given color. */
function squaresOfColor(cells: readonly Cell[], color: Color): Square[] {
  const out: Square[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const p = cells[idx(row, col)];
      if (p && pieceColor(p) === color) out.push({ row, col });
    }
  }
  return out;
}

interface LegalSet {
  /** If any piece of this color has a jump, only jumps are legal. */
  hasCaptures: boolean;
  steps: StepOption[];
}

/** Compute legal steps for a color, optionally restricted to a single origin square. */
function legalStepsFor(
  cells: readonly Cell[],
  color: Color,
  restrictFrom: Square | null,
): LegalSet {
  const origins = restrictFrom ? [restrictFrom] : squaresOfColor(cells, color);
  const allJumps: StepOption[] = [];
  for (const sq of origins) allJumps.push(...jumpsFrom(cells, sq));
  if (allJumps.length > 0) {
    return { hasCaptures: true, steps: allJumps };
  }
  if (restrictFrom) {
    // Mid-multi-jump: if no further jumps, the turn ends; there are no legal
    // "simple moves" to continue from this square.
    return { hasCaptures: false, steps: [] };
  }
  const allSimple: StepOption[] = [];
  for (const sq of origins) allSimple.push(...simpleMovesFrom(cells, sq));
  return { hasCaptures: false, steps: allSimple };
}

function sameSquare(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

function opponentOf(state: CheckersState, actor: PlayerId): PlayerId {
  const ids = Object.keys(state.colors);
  return ids.find((id) => id !== actor) ?? actor;
}

function promoteIfCrowned(piece: Piece, to: Square): Piece {
  const color = pieceColor(piece);
  if (isKing(piece)) return piece;
  if (to.row === crownRow(color)) return color === "r" ? "R" : "B";
  return piece;
}

export const checkersServerModule: GameModule<
  CheckersState,
  CheckersMove,
  CheckersConfig,
  CheckersView
> = {
  type: CHECKERS_TYPE,
  displayName: "Checkers",
  description: "Diagonal hops, forced jumps, crown your kings.",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): CheckersConfig {
    return {};
  },

  validateConfig(cfg: unknown): CheckersConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: CheckersConfig,
    ctx: GameContext,
  ): CheckersState {
    if (players.length !== 2) {
      throw new Error(`checkers requires exactly 2 players, got ${players.length}`);
    }
    const redFirst = ctx.rng() < 0.5;
    const [a, b] = players;
    const red = redFirst ? a! : b!;
    const black = redFirst ? b! : a!;
    return {
      cells: buildInitialBoard(),
      colors: { [red.id]: "r", [black.id]: "b" },
      current: red.id,
      mustContinueFrom: null,
      winner: null,
      lastMove: null,
    };
  },

  handleMove(
    state: CheckersState,
    move: CheckersMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<CheckersState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    const myColor = state.colors[actor];
    if (!myColor) return { ok: false, reason: "You are not in this match" };

    const { from, to } = parsed.data;
    if (!isPlayable(from.row, from.col) || !isPlayable(to.row, to.col)) {
      return { ok: false, reason: "Pieces only move on dark squares" };
    }
    const piece = state.cells[idx(from.row, from.col)];
    if (!piece) return { ok: false, reason: "No piece to move" };
    if (pieceColor(piece) !== myColor) {
      return { ok: false, reason: "That piece is not yours" };
    }

    if (state.mustContinueFrom && !sameSquare(state.mustContinueFrom, from)) {
      return {
        ok: false,
        reason: "Must continue jumping with the same piece",
      };
    }

    const legal = legalStepsFor(
      state.cells,
      myColor,
      state.mustContinueFrom,
    );
    const chosen = legal.steps.find(
      (s) => sameSquare(s.from, from) && sameSquare(s.to, to),
    );
    if (!chosen) {
      if (legal.hasCaptures) {
        return { ok: false, reason: "A capture is available and must be taken" };
      }
      return { ok: false, reason: "Illegal move" };
    }

    const nextCells = state.cells.slice() as Cell[];
    nextCells[idx(from.row, from.col)] = null;
    if (chosen.captured) {
      nextCells[idx(chosen.captured.row, chosen.captured.col)] = null;
    }
    const landed = promoteIfCrowned(piece, to);
    const crownedThisStep = landed !== piece;
    nextCells[idx(to.row, to.col)] = landed;

    // If this was a jump and the piece didn't just get crowned, the player
    // must continue jumping iff there are further captures from the landing square.
    let nextMustContinueFrom: Square | null = null;
    if (chosen.captured && !crownedThisStep) {
      const further = jumpsFrom(nextCells, to);
      if (further.length > 0) nextMustContinueFrom = to;
    }

    const opponent = opponentOf(state, actor);
    const nextCurrent = nextMustContinueFrom ? actor : opponent;

    // Win check: the player about to move has no legal moves.
    let winner: PlayerId | null = null;
    if (!nextMustContinueFrom) {
      const oppColor = state.colors[opponent]!;
      const oppLegal = legalStepsFor(nextCells, oppColor, null);
      if (oppLegal.steps.length === 0) winner = actor;
    }

    return {
      ok: true,
      state: {
        cells: nextCells,
        colors: state.colors,
        current: winner ? actor : nextCurrent,
        mustContinueFrom: winner ? null : nextMustContinueFrom,
        winner,
        lastMove: { from, to },
      },
    };
  },

  view(state: CheckersState, _viewer: Viewer): CheckersView {
    return {
      cells: state.cells.slice(),
      colors: { ...state.colors },
      current: state.current,
      mustContinueFrom: state.mustContinueFrom
        ? { ...state.mustContinueFrom }
        : null,
      winner: state.winner,
      lastMove: state.lastMove
        ? { from: { ...state.lastMove.from }, to: { ...state.lastMove.to } }
        : null,
    };
  },

  phase(state: CheckersState): PhaseId {
    if (state.winner) return "gameOver";
    return "play";
  },

  currentActors(state: CheckersState): PlayerId[] {
    if (state.winner) return [];
    return [state.current];
  },

  isTerminal(state: CheckersState): boolean {
    return state.winner !== null;
  },

  outcome(state: CheckersState): Outcome | null {
    if (!state.winner) return null;
    const losers = Object.keys(state.colors).filter((id) => id !== state.winner);
    return { kind: "solo", winners: [state.winner], losers };
  },
};
