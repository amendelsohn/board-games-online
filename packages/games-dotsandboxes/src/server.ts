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
  BOX_COUNT,
  COLS,
  DOTS_AND_BOXES_TYPE,
  H_EDGE_COUNT,
  ROWS,
  V_EDGE_COUNT,
  edgeIndex,
  moveSchema,
  type BoxOwner,
  type DotsAndBoxesConfig,
  type DotsAndBoxesMove,
  type DotsAndBoxesState,
  type DotsAndBoxesView,
} from "./shared";

/** Does the box at (r,c) have all four edges drawn? */
function boxComplete(
  hEdges: readonly boolean[],
  vEdges: readonly boolean[],
  r: number,
  c: number,
): boolean {
  const top = hEdges[r * COLS + c] === true;
  const bottom = hEdges[(r + 1) * COLS + c] === true;
  const left = vEdges[r * (COLS + 1) + c] === true;
  const right = vEdges[r * (COLS + 1) + (c + 1)] === true;
  return top && bottom && left && right;
}

export const dotsAndBoxesServerModule: GameModule<
  DotsAndBoxesState,
  DotsAndBoxesMove,
  DotsAndBoxesConfig,
  DotsAndBoxesView
> = {
  type: DOTS_AND_BOXES_TYPE,
  displayName: "Dots and Boxes",
  description: "Draw a line, steal a box, steal another turn.",
  category: "classic",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): DotsAndBoxesConfig {
    return {};
  },

  validateConfig(cfg: unknown): DotsAndBoxesConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: DotsAndBoxesConfig,
    ctx: GameContext,
  ): DotsAndBoxesState {
    if (players.length !== 2) {
      throw new Error(
        `dots-and-boxes requires exactly 2 players, got ${players.length}`,
      );
    }
    // Randomize who goes first so host doesn't get a free edge.
    const aFirst = ctx.rng() < 0.5;
    const [p, q] = players;
    const aPlayer = aFirst ? p! : q!;
    const bPlayer = aFirst ? q! : p!;
    return {
      hEdges: new Array(H_EDGE_COUNT).fill(false),
      vEdges: new Array(V_EDGE_COUNT).fill(false),
      boxes: new Array(BOX_COUNT).fill(null),
      colors: { [aPlayer.id]: "A", [bPlayer.id]: "B" },
      current: aPlayer.id,
      scores: { [aPlayer.id]: 0, [bPlayer.id]: 0 },
      lastEdge: null,
      winner: null,
      isDraw: false,
    };
  },

  handleMove(
    state: DotsAndBoxesState,
    move: DotsAndBoxesMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<DotsAndBoxesState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner || state.isDraw) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    if (!(actor in state.colors)) {
      return { ok: false, reason: "You are not in this match" };
    }

    const { orient, row, col } = parsed.data;
    const idx = edgeIndex(orient, row, col);
    if (idx < 0) return { ok: false, reason: "Edge out of bounds" };

    const edges = orient === "h" ? state.hEdges : state.vEdges;
    if (edges[idx] === true) {
      return { ok: false, reason: "Edge already drawn" };
    }

    const hEdges = state.hEdges.slice();
    const vEdges = state.vEdges.slice();
    if (orient === "h") hEdges[idx] = true;
    else vEdges[idx] = true;

    // An edge is shared by at most 2 boxes — check both.
    const boxes = state.boxes.slice() as BoxOwner[];
    const scores = { ...state.scores };
    let completedAny = false;

    const candidateBoxes: Array<{ r: number; c: number }> = [];
    if (orient === "h") {
      // Horizontal edge at row r, col c is the bottom of box (r-1,c) and the top of box (r,c).
      if (row - 1 >= 0) candidateBoxes.push({ r: row - 1, c: col });
      if (row < ROWS) candidateBoxes.push({ r: row, c: col });
    } else {
      // Vertical edge at row r, col c is the right of box (r,c-1) and the left of box (r,c).
      if (col - 1 >= 0) candidateBoxes.push({ r: row, c: col - 1 });
      if (col < COLS) candidateBoxes.push({ r: row, c: col });
    }

    for (const { r, c } of candidateBoxes) {
      const bIdx = r * COLS + c;
      if (boxes[bIdx] !== null) continue;
      if (boxComplete(hEdges, vEdges, r, c)) {
        boxes[bIdx] = actor;
        scores[actor] = (scores[actor] ?? 0) + 1;
        completedAny = true;
      }
    }

    const allDrawn =
      hEdges.every((e) => e === true) && vEdges.every((e) => e === true);

    let winner: PlayerId | null = null;
    let isDraw = false;
    if (allDrawn) {
      const entries = Object.entries(scores);
      const [first, second] = entries;
      if (!first || !second) {
        // Unreachable given 2-player invariant, but keep it total.
        isDraw = true;
      } else if (first[1] > second[1]) winner = first[0];
      else if (second[1] > first[1]) winner = second[0];
      else isDraw = true;
    }

    // If we completed a box, the same player moves again; otherwise turn passes.
    const nextPlayer = completedAny
      ? actor
      : (Object.keys(state.colors).find((id) => id !== actor) ?? actor);

    return {
      ok: true,
      state: {
        hEdges,
        vEdges,
        boxes,
        colors: state.colors,
        current: winner || isDraw ? actor : nextPlayer,
        scores,
        lastEdge: { orient, row, col },
        winner,
        isDraw,
      },
    };
  },

  view(state: DotsAndBoxesState, _viewer: Viewer): DotsAndBoxesView {
    return {
      hEdges: state.hEdges.slice(),
      vEdges: state.vEdges.slice(),
      boxes: state.boxes.slice(),
      colors: { ...state.colors },
      current: state.current,
      scores: { ...state.scores },
      lastEdge: state.lastEdge,
      winner: state.winner,
      isDraw: state.isDraw,
    };
  },

  phase(state: DotsAndBoxesState): PhaseId {
    if (state.winner || state.isDraw) return "gameOver";
    return "play";
  },

  currentActors(state: DotsAndBoxesState): PlayerId[] {
    if (state.winner || state.isDraw) return [];
    return [state.current];
  },

  isTerminal(state: DotsAndBoxesState): boolean {
    return state.winner !== null || state.isDraw;
  },

  outcome(state: DotsAndBoxesState): Outcome | null {
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
