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
  REVERSI_TYPE,
  SIZE,
  countDiscs,
  flipsFor,
  initialCells,
  legalMovesFor,
  moveSchema,
  opposite,
  type Cell,
  type Disc,
  type ReversiConfig,
  type ReversiMove,
  type ReversiState,
  type ReversiView,
} from "./shared";

function playerIdFor(
  colors: Record<PlayerId, Disc>,
  disc: Disc,
): PlayerId | null {
  for (const [id, d] of Object.entries(colors)) {
    if (d === disc) return id;
  }
  return null;
}

function finalize(
  state: ReversiState,
  cells: readonly Cell[],
  nextDisc: Disc,
  lastMove: { row: number; col: number } | null,
  passCount: number,
): ReversiState {
  const scores = countDiscs(cells);
  const full = scores.B + scores.W === SIZE * SIZE;
  const terminal = passCount >= 2 || full;

  if (terminal) {
    let winner: PlayerId | null = null;
    let isDraw = false;
    if (scores.B > scores.W) {
      winner = playerIdFor(state.colors, "B");
    } else if (scores.W > scores.B) {
      winner = playerIdFor(state.colors, "W");
    } else {
      isDraw = true;
    }
    return {
      cells,
      colors: state.colors,
      current: state.current,
      passCount,
      winner,
      isDraw,
      scores,
      lastMove,
    };
  }

  const nextPlayer = playerIdFor(state.colors, nextDisc) ?? state.current;
  return {
    cells,
    colors: state.colors,
    current: nextPlayer,
    passCount,
    winner: null,
    isDraw: false,
    scores,
    lastMove,
  };
}

export const reversiServerModule: GameModule<
  ReversiState,
  ReversiMove,
  ReversiConfig,
  ReversiView
> = {
  type: REVERSI_TYPE,
  displayName: "Reversi",
  description: "Outflank and flip — the 8×8 classic.",
  category: "strategy",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): ReversiConfig {
    return {};
  },

  validateConfig(cfg: unknown): ReversiConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: ReversiConfig,
    ctx: GameContext,
  ): ReversiState {
    if (players.length !== 2) {
      throw new Error(`reversi requires exactly 2 players, got ${players.length}`);
    }
    const blackFirst = ctx.rng() < 0.5;
    const [a, b] = players;
    const black = blackFirst ? a! : b!;
    const white = blackFirst ? b! : a!;
    const cells = initialCells();
    return {
      cells,
      colors: { [black.id]: "B", [white.id]: "W" } as Record<PlayerId, Disc>,
      current: black.id,
      passCount: 0,
      winner: null,
      isDraw: false,
      scores: countDiscs(cells),
      lastMove: null,
    };
  },

  handleMove(
    state: ReversiState,
    move: ReversiMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<ReversiState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner || state.isDraw) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    const disc = state.colors[actor];
    if (!disc) return { ok: false, reason: "You are not in this match" };

    const { row, col } = parsed.data;
    const flips = flipsFor(state.cells, row, col, disc);
    if (flips.length === 0) {
      return { ok: false, reason: "Move does not flip any discs" };
    }

    const cells = state.cells.slice() as Cell[];
    cells[row * SIZE + col] = disc;
    for (const idx of flips) cells[idx] = disc;

    // Turn progression: try the opponent; if they have no move, stay
    // with the mover; if neither side has a move, passes accumulate
    // and finalize() will detect the terminal state.
    const enemy = opposite(disc);
    const enemyMoves = legalMovesFor(cells, enemy);
    if (enemyMoves.length > 0) {
      return {
        ok: true,
        state: finalize(state, cells, enemy, { row, col }, 0),
      };
    }
    const selfMoves = legalMovesFor(cells, disc);
    if (selfMoves.length > 0) {
      return {
        ok: true,
        state: finalize(state, cells, disc, { row, col }, 1),
      };
    }
    return {
      ok: true,
      state: finalize(state, cells, disc, { row, col }, 2),
    };
  },

  view(state: ReversiState, _viewer: Viewer): ReversiView {
    const currentDisc = state.colors[state.current];
    const legalMoves = currentDisc && !state.winner && !state.isDraw
      ? legalMovesFor(state.cells, currentDisc)
      : [];
    return {
      cells: state.cells.slice(),
      colors: { ...state.colors },
      current: state.current,
      passCount: state.passCount,
      winner: state.winner,
      isDraw: state.isDraw,
      scores: { ...state.scores },
      lastMove: state.lastMove,
      legalMoves,
    };
  },

  phase(state: ReversiState): PhaseId {
    return state.winner || state.isDraw ? "gameOver" : "play";
  },

  currentActors(state: ReversiState): PlayerId[] {
    return state.winner || state.isDraw ? [] : [state.current];
  },

  isTerminal(state: ReversiState): boolean {
    return state.winner !== null || state.isDraw;
  },

  outcome(state: ReversiState): Outcome | null {
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
