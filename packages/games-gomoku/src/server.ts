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
  GOMOKU_TYPE,
  TOTAL_CELLS,
  cellAt,
  moveSchema,
  type Cell,
  type GomokuConfig,
  type GomokuMove,
  type GomokuState,
  type GomokuView,
  type Stone,
} from "./shared";

const DIRS: readonly [number, number][] = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diag down-right
  [1, -1],  // diag down-left
];

/**
 * Freestyle five-in-a-row: any run of 5+ stones through the last-placed
 * stone wins. We only need to scan the four lines through that stone.
 */
function findWinningLine(
  cells: readonly Cell[],
  row: number,
  col: number,
): number[] | null {
  const stone = cellAt(cells, row, col);
  if (!stone) return null;
  for (const [dr, dc] of DIRS) {
    const line: number[] = [row * BOARD_SIZE + col];
    for (let k = 1; k < BOARD_SIZE; k++) {
      const r = row + dr * k;
      const c = col + dc * k;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (cellAt(cells, r, c) !== stone) break;
      line.push(r * BOARD_SIZE + c);
    }
    for (let k = 1; k < BOARD_SIZE; k++) {
      const r = row - dr * k;
      const c = col - dc * k;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (cellAt(cells, r, c) !== stone) break;
      line.unshift(r * BOARD_SIZE + c);
    }
    if (line.length >= 5) return line;
  }
  return null;
}

export const gomokuServerModule: GameModule<
  GomokuState,
  GomokuMove,
  GomokuConfig,
  GomokuView
> = {
  type: GOMOKU_TYPE,
  displayName: "Gomoku",
  description: "Freestyle five-in-a-row on a 15×15 board.",
  category: "strategy",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): GomokuConfig {
    return {};
  },

  validateConfig(cfg: unknown): GomokuConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: GomokuConfig,
    ctx: GameContext,
  ): GomokuState {
    if (players.length !== 2) {
      throw new Error(`gomoku requires exactly 2 players, got ${players.length}`);
    }
    const blackFirst = ctx.rng() < 0.5;
    const [a, b] = players;
    const black = blackFirst ? a! : b!;
    const white = blackFirst ? b! : a!;
    return {
      cells: new Array(TOTAL_CELLS).fill(null),
      colors: { [black.id]: "B", [white.id]: "W" } as Record<PlayerId, Stone>,
      current: black.id,
      winner: null,
      isDraw: false,
      lastMove: null,
      winningLine: null,
    };
  },

  handleMove(
    state: GomokuState,
    move: GomokuMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<GomokuState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner || state.isDraw) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    const { row, col } = parsed.data;
    if (cellAt(state.cells, row, col) !== null) {
      return { ok: false, reason: "Cell already taken" };
    }
    const stone = state.colors[actor];
    if (!stone) return { ok: false, reason: "You are not in this match" };

    const cells = state.cells.slice() as Cell[];
    cells[row * BOARD_SIZE + col] = stone;

    const winningLine = findWinningLine(cells, row, col);
    const winner = winningLine ? actor : null;
    const full = cells.every((c) => c !== null);
    const isDraw = !winner && full;

    const nextPlayer =
      Object.keys(state.colors).find((id) => id !== actor) ?? actor;

    return {
      ok: true,
      state: {
        cells,
        colors: state.colors,
        current: winner || isDraw ? actor : nextPlayer,
        winner,
        isDraw,
        lastMove: { row, col },
        winningLine,
      },
    };
  },

  view(state: GomokuState, _viewer: Viewer): GomokuView {
    return {
      cells: state.cells.slice(),
      colors: { ...state.colors },
      current: state.current,
      winner: state.winner,
      isDraw: state.isDraw,
      lastMove: state.lastMove,
      winningLine: state.winningLine ? state.winningLine.slice() : null,
    };
  },

  phase(state: GomokuState): PhaseId {
    return state.winner || state.isDraw ? "gameOver" : "play";
  },

  currentActors(state: GomokuState): PlayerId[] {
    return state.winner || state.isDraw ? [] : [state.current];
  },

  isTerminal(state: GomokuState): boolean {
    return state.winner !== null || state.isDraw;
  },

  outcome(state: GomokuState): Outcome | null {
    if (state.winner) {
      const losers = Object.keys(state.colors).filter(
        (id) => id !== state.winner,
      );
      return { kind: "solo", winners: [state.winner], losers };
    }
    if (state.isDraw) return { kind: "draw" };
    return null;
  },
};
