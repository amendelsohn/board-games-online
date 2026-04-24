import type { GameContext, GameEvent, Player, PlayerId } from "@bgo/sdk";
import { createRng } from "@bgo/sdk";
import { connectFourServerModule } from "./server";
import {
  COLS,
  ROWS,
  cellAt,
  type ConnectFourMove,
  type ConnectFourState,
} from "./shared";

/**
 * Reference fixture: synthetic GameContext with a fixed seed and synthetic
 * clock, no real timers, no Math.random anywhere. Mirrors the tic-tac-toe
 * pattern from `feat/testing-foundation`.
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
 * Two fixed seeds that exercise both branches of the red/yellow coin flip in
 * `createInitialState`. Seed 7 puts Alice on Red (rng()<0.5); seed 42 puts Bob
 * on Red (rng()>=0.5).
 */
const SEED_ALICE_RED = 7;
const SEED_BOB_RED = 42;

function stateWhereAliceIsRed(): {
  state: ConnectFourState;
  red: PlayerId;
  yellow: PlayerId;
} {
  const { ctx } = makeCtx({ seed: SEED_ALICE_RED });
  const state = connectFourServerModule.createInitialState(
    [ALICE, BOB],
    {},
    ctx,
  );
  expect(state.colors[ALICE.id]).toBe("R");
  return { state, red: ALICE.id, yellow: BOB.id };
}

function stateWhereBobIsRed(): {
  state: ConnectFourState;
  red: PlayerId;
  yellow: PlayerId;
} {
  const { ctx } = makeCtx({ seed: SEED_BOB_RED });
  const state = connectFourServerModule.createInitialState(
    [ALICE, BOB],
    {},
    ctx,
  );
  expect(state.colors[BOB.id]).toBe("R");
  return { state, red: BOB.id, yellow: ALICE.id };
}

/** Apply a sequence of drops; assert each is accepted. */
function play(
  initial: ConnectFourState,
  moves: Array<{ actor: PlayerId; col: number }>,
): ConnectFourState {
  const { ctx } = makeCtx();
  let state = initial;
  for (const m of moves) {
    const move: ConnectFourMove = { kind: "drop", col: m.col };
    const result = connectFourServerModule.handleMove(
      state,
      move,
      m.actor,
      ctx,
    );
    if (!result.ok) {
      throw new Error(`expected ok, got rejection: ${result.reason}`);
    }
    state = result.state;
  }
  return state;
}

describe("connectFourServerModule", () => {
  describe("metadata", () => {
    it("exposes stable metadata", () => {
      expect(connectFourServerModule.type).toBe("connect-four");
      expect(connectFourServerModule.minPlayers).toBe(2);
      expect(connectFourServerModule.maxPlayers).toBe(2);
      expect(connectFourServerModule.category).toBe("classic");
    });
  });

  describe("defaultConfig / validateConfig", () => {
    it("defaultConfig returns empty object", () => {
      expect(connectFourServerModule.defaultConfig()).toEqual({});
    });

    it("validateConfig accepts undefined, null, {}", () => {
      expect(connectFourServerModule.validateConfig(undefined)).toEqual({});
      expect(connectFourServerModule.validateConfig(null)).toEqual({});
      expect(connectFourServerModule.validateConfig({})).toEqual({});
    });

    it("validateConfig rejects non-object configs", () => {
      expect(() => connectFourServerModule.validateConfig(7)).toThrow();
      expect(() => connectFourServerModule.validateConfig("foo")).toThrow();
    });
  });

  describe("createInitialState", () => {
    it("builds an empty 6x7 board", () => {
      const { state } = stateWhereAliceIsRed();
      expect(state.cells).toHaveLength(ROWS * COLS);
      expect(state.cells.every((c) => c === null)).toBe(true);
    });

    it("assigns exactly one R and one Y color; Red goes first", () => {
      const { state, red } = stateWhereAliceIsRed();
      const colors = Object.values(state.colors).sort();
      expect(colors).toEqual(["R", "Y"]);
      expect(state.current).toBe(red);
      expect(state.winner).toBeNull();
      expect(state.isDraw).toBe(false);
      expect(state.lastMove).toBeNull();
    });

    it("both branches of the red coin flip are exercised", () => {
      const a = stateWhereAliceIsRed();
      const b = stateWhereBobIsRed();
      expect(a.state.colors[ALICE.id]).toBe("R");
      expect(b.state.colors[BOB.id]).toBe("R");
    });

    it("throws when player count is not exactly 2", () => {
      const { ctx } = makeCtx();
      expect(() =>
        connectFourServerModule.createInitialState([ALICE], {}, ctx),
      ).toThrow(/exactly 2 players/);
      expect(() =>
        connectFourServerModule.createInitialState(
          [ALICE, BOB, { id: "p-c", name: "C" }],
          {},
          ctx,
        ),
      ).toThrow(/exactly 2 players/);
    });
  });

  describe("handleMove — valid drops", () => {
    it("drops a disc into the lowest empty row of the chosen column", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      const { ctx } = makeCtx();
      const result = connectFourServerModule.handleMove(
        state,
        { kind: "drop", col: 3 },
        red,
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Piece lands on the bottom row (5) of column 3.
      expect(cellAt(result.state.cells, ROWS - 1, 3)).toBe("R");
      expect(result.state.lastMove).toEqual({ row: ROWS - 1, col: 3 });
      expect(result.state.current).toBe(yellow);
      // Original state untouched.
      expect(state.cells[(ROWS - 1) * COLS + 3]).toBeNull();
    });

    it("stacks discs in the same column from bottom up", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      const after = play(state, [
        { actor: red, col: 0 },
        { actor: yellow, col: 0 },
        { actor: red, col: 0 },
      ]);
      expect(cellAt(after.cells, 5, 0)).toBe("R");
      expect(cellAt(after.cells, 4, 0)).toBe("Y");
      expect(cellAt(after.cells, 3, 0)).toBe("R");
      expect(cellAt(after.cells, 2, 0)).toBeNull();
    });
  });

  describe("handleMove — invalid moves", () => {
    it("rejects out-of-bounds column (schema)", () => {
      const { state, red } = stateWhereAliceIsRed();
      const { ctx } = makeCtx();
      for (const col of [-1, COLS, 42]) {
        const result = connectFourServerModule.handleMove(
          state,
          { kind: "drop", col } as ConnectFourMove,
          red,
          ctx,
        );
        expect(result.ok).toBe(false);
        if (result.ok) continue;
        expect(result.reason).toMatch(/malformed/i);
      }
    });

    it("rejects malformed move (missing kind)", () => {
      const { state, red } = stateWhereAliceIsRed();
      const { ctx } = makeCtx();
      const result = connectFourServerModule.handleMove(
        state,
        { col: 0 } as unknown as ConnectFourMove,
        red,
        ctx,
      );
      expect(result.ok).toBe(false);
    });

    it("rejects dropping into a full column", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      // Fill column 0 with R,Y,R,Y,R,Y (6 discs). Keep an R turn alive by
      // interleaving with drops in column 1, then fill col 0 completely.
      let s: ConnectFourState = state;
      // A simple alternating fill of col 0:
      s = play(s, [
        { actor: red, col: 0 },
        { actor: yellow, col: 0 },
        { actor: red, col: 0 },
        { actor: yellow, col: 0 },
        { actor: red, col: 0 },
        { actor: yellow, col: 0 },
      ]);
      expect(s.cells.slice(0, ROWS).length).toBe(ROWS);
      // Column 0 is full; it must currently be Red's turn (6 drops => back to
      // Red). Dropping in col 0 should fail with "Column is full".
      expect(s.current).toBe(red);
      const { ctx } = makeCtx();
      const result = connectFourServerModule.handleMove(
        s,
        { kind: "drop", col: 0 },
        red,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/full/i);
    });

    it("rejects out-of-turn moves", () => {
      const { state, yellow } = stateWhereAliceIsRed();
      const { ctx } = makeCtx();
      const result = connectFourServerModule.handleMove(
        state,
        { kind: "drop", col: 3 },
        yellow,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/turn/i);
    });

    it("rejects moves after the game is terminal", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      // Red wins bottom row cols 0-3. Yellow stacks harmlessly in col 6.
      const terminal = play(state, [
        { actor: red, col: 0 },
        { actor: yellow, col: 6 },
        { actor: red, col: 1 },
        { actor: yellow, col: 6 },
        { actor: red, col: 2 },
        { actor: yellow, col: 6 },
        { actor: red, col: 3 },
      ]);
      expect(terminal.winner).toBe(red);

      const { ctx } = makeCtx();
      const result = connectFourServerModule.handleMove(
        terminal,
        { kind: "drop", col: 4 },
        yellow,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/over/i);
    });

    it("rejects a move from someone who isn't in the match", () => {
      // Rig a state whose `current` points at an unknown id so the colors
      // lookup fails.
      const { state } = stateWhereAliceIsRed();
      const rigged: ConnectFourState = { ...state, current: "p-ghost" };
      const { ctx } = makeCtx();
      const result = connectFourServerModule.handleMove(
        rigged,
        { kind: "drop", col: 0 },
        "p-ghost",
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/not in this match/i);
    });
  });

  describe("view", () => {
    it("returns identical views for each player and for a spectator", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      const mid = play(state, [
        { actor: red, col: 3 },
        { actor: yellow, col: 4 },
      ]);
      const redView = connectFourServerModule.view(mid, red);
      const yellowView = connectFourServerModule.view(mid, yellow);
      const specView = connectFourServerModule.view(mid, "spectator");
      expect(redView).toEqual(yellowView);
      expect(yellowView).toEqual(specView);
    });

    it("view.cells is a fresh array (not the state's cells)", () => {
      const { state } = stateWhereAliceIsRed();
      const v = connectFourServerModule.view(state, "spectator");
      expect(v.cells).not.toBe(state.cells);
    });

    it("winningCells is null mid-game and non-null after a win", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      const mid = play(state, [{ actor: red, col: 0 }]);
      expect(connectFourServerModule.view(mid, "spectator").winningCells).toBeNull();

      const terminal = play(state, [
        { actor: red, col: 0 },
        { actor: yellow, col: 6 },
        { actor: red, col: 1 },
        { actor: yellow, col: 6 },
        { actor: red, col: 2 },
        { actor: yellow, col: 6 },
        { actor: red, col: 3 },
      ]);
      const v = connectFourServerModule.view(terminal, "spectator");
      expect(v.winningCells).not.toBeNull();
      expect(v.winningCells).toHaveLength(4);
      expect(v.winner).toBe(red);
    });
  });

  describe("outcome / isTerminal / phase / currentActors", () => {
    it("null outcome mid-game; play phase; current actor present", () => {
      const { state, red } = stateWhereAliceIsRed();
      expect(connectFourServerModule.outcome(state)).toBeNull();
      expect(connectFourServerModule.isTerminal(state)).toBe(false);
      expect(connectFourServerModule.phase(state)).toBe("play");
      expect(connectFourServerModule.currentActors(state)).toEqual([red]);
    });

    it("detects a horizontal 4-in-a-row win", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      const s = play(state, [
        { actor: red, col: 0 },
        { actor: yellow, col: 6 },
        { actor: red, col: 1 },
        { actor: yellow, col: 6 },
        { actor: red, col: 2 },
        { actor: yellow, col: 6 },
        { actor: red, col: 3 },
      ]);
      expect(s.winner).toBe(red);
      expect(connectFourServerModule.outcome(s)).toEqual({
        kind: "solo",
        winners: [red],
        losers: [yellow],
      });
      expect(connectFourServerModule.isTerminal(s)).toBe(true);
      expect(connectFourServerModule.phase(s)).toBe("gameOver");
      expect(connectFourServerModule.currentActors(s)).toEqual([]);
    });

    it("detects a vertical 4-in-a-row win", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      const s = play(state, [
        { actor: red, col: 0 },
        { actor: yellow, col: 1 },
        { actor: red, col: 0 },
        { actor: yellow, col: 1 },
        { actor: red, col: 0 },
        { actor: yellow, col: 1 },
        { actor: red, col: 0 },
      ]);
      expect(s.winner).toBe(red);
    });

    it("detects a diagonal (down-right) 4-in-a-row win", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      // Build staircase: R at (5,0) (4,1) (3,2) (2,3)
      // Use yellow filler drops in far column that won't form a line.
      const s = play(state, [
        // col 0: R
        { actor: red, col: 0 },
        // col 1: Y (bottom) then R (above)
        { actor: yellow, col: 1 },
        { actor: red, col: 1 },
        // col 2: Y, Y, R
        { actor: yellow, col: 2 },
        { actor: red, col: 6 }, // stray R
        { actor: yellow, col: 2 },
        { actor: red, col: 2 },
        // col 3: Y, Y, Y, R
        { actor: yellow, col: 3 },
        { actor: red, col: 6 }, // stray R
        { actor: yellow, col: 3 },
        { actor: red, col: 6 }, // stray R
        { actor: yellow, col: 3 },
        { actor: red, col: 3 }, // winning R
      ]);
      expect(cellAt(s.cells, 5, 0)).toBe("R");
      expect(cellAt(s.cells, 4, 1)).toBe("R");
      expect(cellAt(s.cells, 3, 2)).toBe("R");
      expect(cellAt(s.cells, 2, 3)).toBe("R");
      expect(s.winner).toBe(red);
    });

    it("detects an anti-diagonal (down-left) 4-in-a-row win", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      // Target R at (5,3) (4,2) (3,1) (2,0). Mirror of previous test.
      const s = play(state, [
        // col 3: R at bottom (row 5).
        { actor: red, col: 3 },
        // col 2: Y then R (row 4).
        { actor: yellow, col: 2 },
        { actor: red, col: 2 },
        // col 1: Y, Y, R (row 3).
        { actor: yellow, col: 1 },
        { actor: red, col: 6 },
        { actor: yellow, col: 1 },
        { actor: red, col: 1 },
        // col 0: Y, Y, Y, R (row 2).
        { actor: yellow, col: 0 },
        { actor: red, col: 6 },
        { actor: yellow, col: 0 },
        { actor: red, col: 6 },
        { actor: yellow, col: 0 },
        { actor: red, col: 0 },
      ]);
      expect(cellAt(s.cells, 5, 3)).toBe("R");
      expect(cellAt(s.cells, 4, 2)).toBe("R");
      expect(cellAt(s.cells, 3, 1)).toBe("R");
      expect(cellAt(s.cells, 2, 0)).toBe("R");
      expect(s.winner).toBe(red);
    });

    /**
     * Helper: build a verified no-4-in-a-row full-board pattern. Each column
     * is split vertically into 3 same + 3 same, alternating parity by column.
     * Columns: even → R,R,R,Y,Y,Y (row 0 top); odd → Y,Y,Y,R,R,R. This gives
     * alternating rows horizontally (no horizontal 4-run), max 3 vertical,
     * and max 2 along diagonals. Counts: 21 R, 21 Y.
     */
    function buildDrawCells(): Array<"R" | "Y" | null> {
      const out = new Array<"R" | "Y" | null>(ROWS * COLS).fill(null);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const pattern: Array<"R" | "Y"> =
            c % 2 === 0
              ? ["R", "R", "R", "Y", "Y", "Y"]
              : ["Y", "Y", "Y", "R", "R", "R"];
          out[r * COLS + c] = pattern[r]!;
        }
      }
      return out;
    }

    function has4InARow(cells: ReadonlyArray<"R" | "Y" | null>): boolean {
      const dirs: ReadonlyArray<readonly [number, number]> = [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const color = cells[r * COLS + c];
          if (!color) continue;
          for (const [dr, dc] of dirs) {
            let ok = true;
            for (let k = 1; k < 4; k++) {
              const nr = r + dr * k;
              const nc = c + dc * k;
              if (
                nr < 0 ||
                nr >= ROWS ||
                nc < 0 ||
                nc >= COLS ||
                cells[nr * COLS + nc] !== color
              ) {
                ok = false;
                break;
              }
            }
            if (ok) return true;
          }
        }
      }
      return false;
    }

    it("detects a full-board draw with no 4-in-a-row", () => {
      const { state } = stateWhereAliceIsRed();
      const cells = buildDrawCells();
      // Sanity: the hand-built pattern really has no line of 4.
      expect(has4InARow(cells)).toBe(false);
      const drawn: ConnectFourState = {
        ...state,
        cells,
        isDraw: true,
        winner: null,
        lastMove: { row: 0, col: 0 },
      };
      expect(connectFourServerModule.outcome(drawn)).toEqual({ kind: "draw" });
      expect(connectFourServerModule.isTerminal(drawn)).toBe(true);
      expect(connectFourServerModule.phase(drawn)).toBe("gameOver");
      expect(connectFourServerModule.currentActors(drawn)).toEqual([]);
    });

    it("handleMove returns isDraw when the move that fills the board creates no line", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      // Start from the verified draw pattern but empty one bottom cell that
      // the player whose turn it is would fill with their own color without
      // creating a 4-run. In our pattern, (5,0) = Y (even col, row 5). Empty
      // that cell and make it Yellow's turn.
      const cells = buildDrawCells();
      cells[5 * COLS + 0] = null;
      const near: ConnectFourState = {
        ...state,
        cells,
        current: yellow,
        winner: null,
        isDraw: false,
        lastMove: { row: 0, col: 0 },
      };
      const { ctx } = makeCtx();
      const result = connectFourServerModule.handleMove(
        near,
        { kind: "drop", col: 0 },
        yellow,
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.cells.every((c) => c !== null)).toBe(true);
      expect(result.state.isDraw).toBe(true);
      expect(result.state.winner).toBeNull();
      expect(result.state.lastMove).toEqual({ row: 5, col: 0 });
      expect(connectFourServerModule.outcome(result.state)).toEqual({
        kind: "draw",
      });
      // After a terminal move, current should remain with the mover per server.ts.
      expect(result.state.current).toBe(yellow);
      expect(red).toBeDefined();
    });

    it("isTerminal iff outcome is non-null (SDK invariant)", () => {
      const { state, red, yellow } = stateWhereAliceIsRed();
      const mid = play(state, [
        { actor: red, col: 0 },
        { actor: yellow, col: 1 },
      ]);
      const terminal = play(state, [
        { actor: red, col: 0 },
        { actor: yellow, col: 6 },
        { actor: red, col: 1 },
        { actor: yellow, col: 6 },
        { actor: red, col: 2 },
        { actor: yellow, col: 6 },
        { actor: red, col: 3 },
      ]);
      for (const s of [state, mid, terminal]) {
        expect(connectFourServerModule.isTerminal(s)).toBe(
          connectFourServerModule.outcome(s) !== null,
        );
      }
    });
  });
});
