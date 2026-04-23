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
  TIC_TAC_TOE_TYPE,
  moveSchema,
  type TicTacToeConfig,
  type TicTacToeMove,
  type TicTacToeState,
  type TicTacToeView,
  type Cell,
} from "./shared";

const LINES: readonly [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winningLineFor(cells: readonly Cell[]): readonly [number, number, number] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const v = cells[a];
    if (v && v === cells[b] && v === cells[c]) return line;
  }
  return null;
}

export const ticTacToeServerModule: GameModule<
  TicTacToeState,
  TicTacToeMove,
  TicTacToeConfig,
  TicTacToeView
> = {
  type: TIC_TAC_TOE_TYPE,
  displayName: "Tic-Tac-Toe",
  description: "Classic 3×3 — three in a row wins.",
  category: "classic",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): TicTacToeConfig {
    return {};
  },

  validateConfig(cfg: unknown): TicTacToeConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: TicTacToeConfig,
    ctx: GameContext,
  ): TicTacToeState {
    if (players.length !== 2) {
      throw new Error(`tic-tac-toe requires exactly 2 players, got ${players.length}`);
    }
    // Randomize who goes first so we don't always favor the host.
    const xFirst = ctx.rng() < 0.5;
    const [a, b] = players;
    const xPlayer = xFirst ? a! : b!;
    const oPlayer = xFirst ? b! : a!;
    return {
      cells: new Array(9).fill(null),
      symbols: { [xPlayer.id]: "X", [oPlayer.id]: "O" },
      current: xPlayer.id,
      winner: null,
      isDraw: false,
    };
  },

  handleMove(
    state: TicTacToeState,
    move: TicTacToeMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<TicTacToeState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner || state.isDraw) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    const { cellIndex } = parsed.data;
    if (state.cells[cellIndex] !== null) {
      return { ok: false, reason: "Cell already taken" };
    }
    const symbol = state.symbols[actor];
    if (!symbol) return { ok: false, reason: "You are not in this match" };

    const cells = state.cells.slice() as Cell[];
    cells[cellIndex] = symbol;

    const win = winningLineFor(cells);
    const winner = win ? actor : null;
    const full = cells.every((c) => c !== null);
    const isDraw = !winner && full;

    const nextPlayer = Object.keys(state.symbols).find((id) => id !== actor) ?? actor;

    return {
      ok: true,
      state: {
        cells,
        symbols: state.symbols,
        current: winner || isDraw ? actor : nextPlayer,
        winner,
        isDraw,
      },
    };
  },

  view(state: TicTacToeState, _viewer: Viewer): TicTacToeView {
    const line = winningLineFor(state.cells);
    return {
      cells: state.cells.slice(),
      symbols: { ...state.symbols },
      current: state.current,
      winner: state.winner,
      isDraw: state.isDraw,
      winningLine: line ? [line[0], line[1], line[2]] : null,
    };
  },

  phase(state: TicTacToeState): PhaseId {
    if (state.winner || state.isDraw) return "gameOver";
    return "play";
  },

  currentActors(state: TicTacToeState): PlayerId[] {
    if (state.winner || state.isDraw) return [];
    return [state.current];
  },

  isTerminal(state: TicTacToeState): boolean {
    return state.winner !== null || state.isDraw;
  },

  outcome(state: TicTacToeState): Outcome | null {
    if (state.winner) {
      const losers = Object.keys(state.symbols).filter((id) => id !== state.winner);
      return { kind: "solo", winners: [state.winner], losers };
    }
    if (state.isDraw) return { kind: "draw" };
    return null;
  },
};
