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
  CONNECT_FOUR_TYPE,
  COLS,
  ROWS,
  cellAt,
  dropRow,
  moveSchema,
  type Cell,
  type ConnectFourConfig,
  type ConnectFourMove,
  type ConnectFourState,
  type ConnectFourView,
  type Color,
} from "./shared";

const DIRS: readonly [number, number][] = [
  [0, 1],   // horizontal
  [1, 0],   // vertical
  [1, 1],   // diag down-right
  [1, -1],  // diag down-left
];

function findWinningCells(
  cells: readonly Cell[],
  row: number,
  col: number,
): number[] | null {
  const color = cellAt(cells, row, col);
  if (!color) return null;
  for (const [dr, dc] of DIRS) {
    const line: number[] = [row * COLS + col];
    // Walk forward + backward from this cell along the direction.
    for (let k = 1; k < 4; k++) {
      const r = row + dr * k;
      const c = col + dc * k;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (cellAt(cells, r, c) !== color) break;
      line.push(r * COLS + c);
    }
    for (let k = 1; k < 4; k++) {
      const r = row - dr * k;
      const c = col - dc * k;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
      if (cellAt(cells, r, c) !== color) break;
      line.unshift(r * COLS + c);
    }
    if (line.length >= 4) return line.slice(0, 4);
  }
  return null;
}

export const connectFourServerModule: GameModule<
  ConnectFourState,
  ConnectFourMove,
  ConnectFourConfig,
  ConnectFourView
> = {
  type: CONNECT_FOUR_TYPE,
  displayName: "Connect Four",
  description: "Drop discs into a 6×7 grid. First to line up four wins.",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): ConnectFourConfig {
    return {};
  },

  validateConfig(cfg: unknown): ConnectFourConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: ConnectFourConfig,
    ctx: GameContext,
  ): ConnectFourState {
    if (players.length !== 2) {
      throw new Error(`connect-four requires exactly 2 players, got ${players.length}`);
    }
    const redFirst = ctx.rng() < 0.5;
    const [a, b] = players;
    const red = redFirst ? a! : b!;
    const yellow = redFirst ? b! : a!;
    return {
      cells: new Array(ROWS * COLS).fill(null),
      colors: { [red.id]: "R", [yellow.id]: "Y" } as Record<PlayerId, Color>,
      current: red.id,
      winner: null,
      isDraw: false,
      lastMove: null,
    };
  },

  handleMove(
    state: ConnectFourState,
    move: ConnectFourMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<ConnectFourState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner || state.isDraw) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    const { col } = parsed.data;
    const row = dropRow(state.cells, col);
    if (row < 0) return { ok: false, reason: "Column is full" };
    const color = state.colors[actor];
    if (!color) return { ok: false, reason: "You are not in this match" };

    const cells = state.cells.slice() as Cell[];
    cells[row * COLS + col] = color;

    const winningCells = findWinningCells(cells, row, col);
    const winner = winningCells ? actor : null;
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
      },
    };
  },

  view(state: ConnectFourState, _viewer: Viewer): ConnectFourView {
    const winning = state.lastMove
      ? findWinningCells(state.cells, state.lastMove.row, state.lastMove.col)
      : null;
    return {
      cells: state.cells.slice(),
      colors: { ...state.colors },
      current: state.current,
      winner: state.winner,
      isDraw: state.isDraw,
      lastMove: state.lastMove,
      winningCells: winning,
    };
  },

  phase(state: ConnectFourState): PhaseId {
    return state.winner || state.isDraw ? "gameOver" : "play";
  },

  currentActors(state: ConnectFourState): PlayerId[] {
    return state.winner || state.isDraw ? [] : [state.current];
  },

  isTerminal(state: ConnectFourState): boolean {
    return state.winner !== null || state.isDraw;
  },

  outcome(state: ConnectFourState): Outcome | null {
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
