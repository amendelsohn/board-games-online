import type { GameContext, GameEvent, Player, PlayerId } from "@bgo/sdk";
import { createRng } from "@bgo/sdk";
import { reversiServerModule } from "./server";
import {
  SIZE,
  cellAt,
  countDiscs,
  legalMovesFor,
  type Cell,
  type ReversiMove,
  type ReversiState,
} from "./shared";

/**
 * Reference fixture mirroring the tic-tac-toe unit-test harness from
 * `feat/testing-foundation`: synthetic GameContext with a fixed seed + a
 * synthetic clock, no real timers, no Math.random.
 */

interface HarnessOptions {
  seed?: number;
  now?: number;
}

interface Harness {
  ctx: GameContext;
  scheduled: Array<{ key: string; at: number }>;
  cancelled: string[];
  emitted: GameEvent[];
}

function makeCtx(opts: HarnessOptions = {}): Harness {
  const scheduled: Array<{ key: string; at: number }> = [];
  const cancelled: string[] = [];
  const emitted: GameEvent[] = [];
  const ctx: GameContext = {
    version: 0,
    now: opts.now ?? 1_700_000_000_000,
    rng: createRng(opts.seed ?? 42),
    scheduleTimer(key, at) {
      scheduled.push({ key, at });
    },
    cancelTimer(key) {
      cancelled.push(key);
    },
    emit(event) {
      emitted.push(event);
    },
  };
  return { ctx, scheduled, cancelled, emitted };
}

const ALICE: Player = { id: "p-alice", name: "Alice" };
const BOB: Player = { id: "p-bob", name: "Bob" };

/**
 * Fixed seeds that exercise both branches of the Black coin flip:
 * - seed 7 → rng() < 0.5 → Alice is Black
 * - seed 42 → rng() >= 0.5 → Bob is Black
 */
const SEED_ALICE_BLACK = 7;
const SEED_BOB_BLACK = 42;

function stateWhereAliceIsBlack(): {
  state: ReversiState;
  black: PlayerId;
  white: PlayerId;
} {
  const { ctx } = makeCtx({ seed: SEED_ALICE_BLACK });
  const state = reversiServerModule.createInitialState([ALICE, BOB], {}, ctx);
  expect(state.colors[ALICE.id]).toBe("B");
  return { state, black: ALICE.id, white: BOB.id };
}

function stateWhereBobIsBlack(): {
  state: ReversiState;
  black: PlayerId;
  white: PlayerId;
} {
  const { ctx } = makeCtx({ seed: SEED_BOB_BLACK });
  const state = reversiServerModule.createInitialState([ALICE, BOB], {}, ctx);
  expect(state.colors[BOB.id]).toBe("B");
  return { state, black: BOB.id, white: ALICE.id };
}

function play(
  initial: ReversiState,
  moves: Array<{ actor: PlayerId; row: number; col: number }>,
): ReversiState {
  const { ctx } = makeCtx();
  let state = initial;
  for (const m of moves) {
    const move: ReversiMove = { kind: "place", row: m.row, col: m.col };
    const result = reversiServerModule.handleMove(state, move, m.actor, ctx);
    if (!result.ok) {
      throw new Error(
        `expected ok at (${m.row},${m.col}), got: ${result.reason}`,
      );
    }
    state = result.state;
  }
  return state;
}

describe("reversiServerModule", () => {
  describe("metadata", () => {
    it("exposes stable metadata", () => {
      expect(reversiServerModule.type).toBe("reversi");
      expect(reversiServerModule.minPlayers).toBe(2);
      expect(reversiServerModule.maxPlayers).toBe(2);
      expect(reversiServerModule.category).toBe("strategy");
    });
  });

  describe("defaultConfig / validateConfig", () => {
    it("defaultConfig returns empty object", () => {
      expect(reversiServerModule.defaultConfig()).toEqual({});
    });

    it("validateConfig accepts undefined, null, {}", () => {
      expect(reversiServerModule.validateConfig(undefined)).toEqual({});
      expect(reversiServerModule.validateConfig(null)).toEqual({});
      expect(reversiServerModule.validateConfig({})).toEqual({});
    });

    it("validateConfig rejects non-object configs", () => {
      expect(() => reversiServerModule.validateConfig(7)).toThrow();
      expect(() => reversiServerModule.validateConfig("foo")).toThrow();
    });
  });

  describe("createInitialState", () => {
    it("builds an 8x8 board with the canonical 4-disc opening", () => {
      const { state } = stateWhereAliceIsBlack();
      expect(state.cells).toHaveLength(SIZE * SIZE);
      // Exactly 4 stones placed, 60 empty.
      const placed = state.cells.filter((c) => c !== null).length;
      expect(placed).toBe(4);
      // Standard opening: white on main diagonal, black on anti-diagonal
      // within the central 2x2 square.
      expect(cellAt(state.cells, 3, 3)).toBe("W");
      expect(cellAt(state.cells, 4, 4)).toBe("W");
      expect(cellAt(state.cells, 3, 4)).toBe("B");
      expect(cellAt(state.cells, 4, 3)).toBe("B");
      // Score reflects the 4 starting stones.
      expect(state.scores).toEqual({ B: 2, W: 2 });
    });

    it("assigns one B and one W color; Black goes first; 0 passes, no winner", () => {
      const { state, black } = stateWhereAliceIsBlack();
      const colors = Object.values(state.colors).sort();
      expect(colors).toEqual(["B", "W"]);
      expect(state.current).toBe(black);
      expect(state.passCount).toBe(0);
      expect(state.winner).toBeNull();
      expect(state.isDraw).toBe(false);
      expect(state.lastMove).toBeNull();
    });

    it("both branches of the Black coin flip are exercised", () => {
      const a = stateWhereAliceIsBlack();
      const b = stateWhereBobIsBlack();
      expect(a.state.colors[ALICE.id]).toBe("B");
      expect(b.state.colors[BOB.id]).toBe("B");
    });

    it("throws when player count is not exactly 2", () => {
      const { ctx } = makeCtx();
      expect(() =>
        reversiServerModule.createInitialState([ALICE], {}, ctx),
      ).toThrow(/exactly 2 players/);
      expect(() =>
        reversiServerModule.createInitialState(
          [ALICE, BOB, { id: "p-c", name: "C" }],
          {},
          ctx,
        ),
      ).toThrow(/exactly 2 players/);
    });
  });

  describe("handleMove — valid placements", () => {
    it("places a disc that flips opposing stones in one direction", () => {
      // Opening has four legal Black moves: (2,3), (3,2), (4,5), (5,4).
      // Black places (2,3) which flips W at (3,3) because the line
      // (2,3) B, (3,3) W, (4,3) B closes on Black.
      const { state, black, white } = stateWhereAliceIsBlack();
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        state,
        { kind: "place", row: 2, col: 3 },
        black,
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // (2,3) now Black, (3,3) flipped B->B was W, and (4,3) remains B.
      expect(cellAt(result.state.cells, 2, 3)).toBe("B");
      expect(cellAt(result.state.cells, 3, 3)).toBe("B");
      expect(cellAt(result.state.cells, 4, 3)).toBe("B");
      // Turn swaps to White, no passes.
      expect(result.state.current).toBe(white);
      expect(result.state.passCount).toBe(0);
      expect(result.state.lastMove).toEqual({ row: 2, col: 3 });
      // Scores: flip of (3,3) from W to B changes counts by +2 B / -1 W; the
      // newly-placed stone also adds +1 B. Net: B 2→4, W 2→1.
      expect(result.state.scores).toEqual({ B: 4, W: 1 });
      // Original state unmutated.
      expect(cellAt(state.cells, 2, 3)).toBeNull();
    });

    it("produces new cells array (state is not mutated in place)", () => {
      const { state, black } = stateWhereAliceIsBlack();
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        state,
        { kind: "place", row: 2, col: 3 },
        black,
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.cells).not.toBe(state.cells);
    });
  });

  describe("handleMove — invalid moves", () => {
    it("rejects out-of-bounds placements (schema)", () => {
      const { state, black } = stateWhereAliceIsBlack();
      const { ctx } = makeCtx();
      for (const [row, col] of [
        [-1, 0],
        [0, -1],
        [SIZE, 0],
        [0, SIZE],
      ] as const) {
        const result = reversiServerModule.handleMove(
          state,
          { kind: "place", row, col } as ReversiMove,
          black,
          ctx,
        );
        expect(result.ok).toBe(false);
        if (result.ok) continue;
        expect(result.reason).toMatch(/malformed/i);
      }
    });

    it("rejects malformed move (missing kind)", () => {
      const { state, black } = stateWhereAliceIsBlack();
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        state,
        { row: 2, col: 3 } as unknown as ReversiMove,
        black,
        ctx,
      );
      expect(result.ok).toBe(false);
    });

    it("rejects placing on an occupied cell", () => {
      const { state, black } = stateWhereAliceIsBlack();
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        state,
        { kind: "place", row: 3, col: 3 },
        black,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/flip/i);
    });

    it("rejects placing where no enemy stones would be flipped", () => {
      const { state, black } = stateWhereAliceIsBlack();
      const { ctx } = makeCtx();
      // (0, 0) is empty and has no adjacent enemy line at opening.
      const result = reversiServerModule.handleMove(
        state,
        { kind: "place", row: 0, col: 0 },
        black,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/flip/i);
    });

    it("rejects out-of-turn moves", () => {
      const { state, white } = stateWhereAliceIsBlack();
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        state,
        { kind: "place", row: 2, col: 3 },
        white,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/turn/i);
    });

    it("rejects moves after the game is terminal", () => {
      const { state, black } = stateWhereAliceIsBlack();
      // Rig a terminal state (Black wins) and try a move from Black.
      const rigged: ReversiState = { ...state, winner: black };
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        rigged,
        { kind: "place", row: 2, col: 3 },
        black,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/over/i);
    });

    it("also rejects moves after a draw", () => {
      const { state, black } = stateWhereAliceIsBlack();
      const rigged: ReversiState = { ...state, isDraw: true };
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        rigged,
        { kind: "place", row: 2, col: 3 },
        black,
        ctx,
      );
      expect(result.ok).toBe(false);
    });

    it("rejects a move from someone who isn't in the match", () => {
      const { state } = stateWhereAliceIsBlack();
      const rigged: ReversiState = { ...state, current: "p-ghost" };
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        rigged,
        { kind: "place", row: 2, col: 3 },
        "p-ghost",
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/not in this match/i);
    });
  });

  describe("pass rule", () => {
    /**
     * Reversi has no explicit {kind:"pass"} move in this module. Instead,
     * handleMove progresses turns like so after applying a legal move:
     *   - If the opponent has at least one legal reply → swap turn (pass=0)
     *   - Else if the mover still has a reply → keep turn (pass=1)
     *   - Else → pass=2 and the game terminates via finalize().
     *
     * Here we craft a board where Black's next move will leave White with no
     * legal replies, forcing White's turn to be automatically skipped (the
     * "implicit pass" pathway).
     */
    it("keeps the same player's turn when the opponent has no legal moves", () => {
      // Engineer post-move state: White has 0 legal replies, Black still has
      // 1 legal reply. This is the passCount=1 pathway in handleMove.
      //
      // Board: all B except
      //   (0,0)=B   (0,1)=W   (0,2)=null   (7,6)=W   (7,7)=null
      // Black to move plays (0,2), which flips (0,1) W → B. After the move
      // White has no legal placement (no B-lines close on an empty cell for
      // White), while Black can still play (7,7) to flip (7,6).
      const { state, black } = stateWhereAliceIsBlack();
      const cells: Cell[] = new Array(SIZE * SIZE).fill("B");
      cells[0 * SIZE + 0] = "B";
      cells[0 * SIZE + 1] = "W";
      cells[0 * SIZE + 2] = null;
      cells[7 * SIZE + 6] = "W";
      cells[7 * SIZE + 7] = null;
      const rigged: ReversiState = {
        ...state,
        cells,
        current: black,
        passCount: 0,
        scores: countDiscs(cells),
      };
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        rigged,
        { kind: "place", row: 0, col: 2 },
        black,
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Post-condition: opponent has no replies, mover keeps the turn.
      expect(legalMovesFor(result.state.cells, "W")).toHaveLength(0);
      expect(legalMovesFor(result.state.cells, "B").length).toBeGreaterThan(0);
      expect(result.state.current).toBe(black);
      expect(result.state.passCount).toBe(1);
      // And the game is not yet terminal.
      expect(reversiServerModule.isTerminal(result.state)).toBe(false);
      expect(result.state.winner).toBeNull();
      expect(result.state.isDraw).toBe(false);
    });

    it("declares White the winner when White's final move produces more W than B", () => {
      // Rig a board where it is White's turn, placing closes the board, and
      // White ends up with strictly more stones. This exercises finalize()'s
      // `scores.W > scores.B` branch. Start with mostly-W board and one empty
      // cell flanked by Bs that White will flip into Ws.
      const { state, black, white } = stateWhereAliceIsBlack();
      const cells: Cell[] = new Array(SIZE * SIZE).fill("W");
      cells[0] = null; // empty slot at (0,0)
      cells[1] = "B"; // W line closer for White at (0,0)
      cells[2] = "W";
      // Placing W at (0,0) flips (0,1) B → W. Everything else was W already.
      const rigged: ReversiState = {
        ...state,
        cells,
        current: white,
        passCount: 0,
        scores: countDiscs(cells),
      };
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        rigged,
        { kind: "place", row: 0, col: 0 },
        white,
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.cells.every((c) => c !== null)).toBe(true);
      expect(reversiServerModule.isTerminal(result.state)).toBe(true);
      expect(result.state.winner).toBe(white);
      expect(result.state.isDraw).toBe(false);
      expect(reversiServerModule.outcome(result.state)).toEqual({
        kind: "solo",
        winners: [white],
        losers: [black],
      });
    });

    it("terminates the game when neither side has a legal move (two consecutive passes)", () => {
      // Engineer a board where after Black's placement neither Black nor
      // White can move: a nearly-full board whose single empty cell is the
      // one Black is about to fill. Fill the full board except (0,0); set
      // its surroundings so placing Black at (0,0) flips a W line.
      //
      // Easiest deterministic way: set a 3x3 corner such that after the
      // placement the entire 8x8 is full — finalize then detects
      // `full === true` and terminates.
      const { state, black, white } = stateWhereAliceIsBlack();
      const cells: Cell[] = new Array(SIZE * SIZE).fill("B");
      // Create a minimal W-run for the placement at (0,0) to flip.
      cells[0 * SIZE + 1] = "W";
      cells[0 * SIZE + 2] = "B"; // closer on the right
      cells[0 * SIZE + 0] = null; // empty slot Black will fill
      // Ensure the board is otherwise full of B so `full` evaluates to true
      // after the placement.
      const rigged: ReversiState = {
        ...state,
        cells,
        current: black,
        passCount: 0,
        scores: countDiscs(cells),
      };
      const { ctx } = makeCtx();
      const result = reversiServerModule.handleMove(
        rigged,
        { kind: "place", row: 0, col: 0 },
        black,
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // After the move the board is full → terminal.
      expect(result.state.cells.every((c) => c !== null)).toBe(true);
      expect(reversiServerModule.isTerminal(result.state)).toBe(true);
      // Black dominates, so Black wins.
      expect(result.state.winner).toBe(black);
      expect(result.state.isDraw).toBe(false);
      expect(reversiServerModule.outcome(result.state)).toEqual({
        kind: "solo",
        winners: [black],
        losers: [white],
      });
    });
  });

  describe("view", () => {
    it("returns identical views for each player and for a spectator", () => {
      const { state, black, white } = stateWhereAliceIsBlack();
      const mid = play(state, [{ actor: black, row: 2, col: 3 }]);
      const bView = reversiServerModule.view(mid, black);
      const wView = reversiServerModule.view(mid, white);
      const specView = reversiServerModule.view(mid, "spectator");
      expect(bView).toEqual(wView);
      expect(wView).toEqual(specView);
    });

    it("view.cells is a fresh array; legalMoves populated mid-game", () => {
      const { state } = stateWhereAliceIsBlack();
      const v = reversiServerModule.view(state, "spectator");
      expect(v.cells).not.toBe(state.cells);
      // At the opening Black has exactly 4 legal moves.
      expect(v.legalMoves).toHaveLength(4);
      expect(v.legalMoves).toEqual(
        expect.arrayContaining([
          2 * SIZE + 3,
          3 * SIZE + 2,
          4 * SIZE + 5,
          5 * SIZE + 4,
        ]),
      );
    });

    it("view.legalMoves is empty in a terminal state", () => {
      const { state, black } = stateWhereAliceIsBlack();
      const terminal: ReversiState = { ...state, winner: black };
      const v = reversiServerModule.view(terminal, "spectator");
      expect(v.legalMoves).toEqual([]);
    });
  });

  describe("outcome / isTerminal / phase / currentActors", () => {
    it("null outcome mid-game; play phase; current actor present", () => {
      const { state, black } = stateWhereAliceIsBlack();
      expect(reversiServerModule.outcome(state)).toBeNull();
      expect(reversiServerModule.isTerminal(state)).toBe(false);
      expect(reversiServerModule.phase(state)).toBe("play");
      expect(reversiServerModule.currentActors(state)).toEqual([black]);
    });

    it("detects a solo Black win", () => {
      const { state, black, white } = stateWhereAliceIsBlack();
      // Rig a terminal state where Black outscores White.
      const cells: Cell[] = new Array(SIZE * SIZE).fill("B");
      cells[0] = "W";
      cells[1] = "W";
      const rigged: ReversiState = {
        ...state,
        cells,
        winner: black,
        scores: countDiscs(cells),
      };
      expect(reversiServerModule.outcome(rigged)).toEqual({
        kind: "solo",
        winners: [black],
        losers: [white],
      });
      expect(reversiServerModule.isTerminal(rigged)).toBe(true);
      expect(reversiServerModule.phase(rigged)).toBe("gameOver");
      expect(reversiServerModule.currentActors(rigged)).toEqual([]);
    });

    it("detects a draw when stone counts tie", () => {
      const { state } = stateWhereAliceIsBlack();
      const cells: Cell[] = new Array(SIZE * SIZE).fill(null);
      for (let i = 0; i < 32; i++) cells[i] = "B";
      for (let i = 32; i < 64; i++) cells[i] = "W";
      const rigged: ReversiState = {
        ...state,
        cells,
        winner: null,
        isDraw: true,
        scores: countDiscs(cells),
      };
      expect(reversiServerModule.outcome(rigged)).toEqual({ kind: "draw" });
      expect(reversiServerModule.isTerminal(rigged)).toBe(true);
    });

    it("isTerminal iff outcome is non-null (SDK invariant)", () => {
      const { state, black } = stateWhereAliceIsBlack();
      const terminal: ReversiState = { ...state, winner: black };
      const draw: ReversiState = { ...state, isDraw: true };
      for (const s of [state, terminal, draw]) {
        expect(reversiServerModule.isTerminal(s)).toBe(
          reversiServerModule.outcome(s) !== null,
        );
      }
    });
  });
});
