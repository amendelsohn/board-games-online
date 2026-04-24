import type { GameContext, GameEvent, Player, PlayerId } from "@bgo/sdk";
import { createRng } from "@bgo/sdk";
import { ticTacToeServerModule } from "./server";
import type { TicTacToeMove, TicTacToeState } from "./shared";

/**
 * Reference test fixture pattern for game modules. Other game packages should
 * copy this shape: a synthetic GameContext with a fixed seed + a synthetic
 * clock, no real timers, and helpers that build deterministic initial state.
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
 * Two fixed seeds chosen so `ctx.rng()` returns the values that trigger each
 * branch of `createInitialState`'s xFirst coin flip. Seed 7 puts Alice on X;
 * seed 42 puts Bob on X. No reliance on Math.random anywhere.
 */
const SEED_ALICE_X = 7;
const SEED_BOB_X = 42;

function stateWhereAliceIsX(): {
  state: TicTacToeState;
  x: PlayerId;
  o: PlayerId;
} {
  const { ctx } = makeCtx({ seed: SEED_ALICE_X });
  const state = ticTacToeServerModule.createInitialState(
    [ALICE, BOB],
    {},
    ctx,
  );
  expect(state.symbols[ALICE.id]).toBe("X");
  return { state, x: ALICE.id, o: BOB.id };
}

function stateWhereBobIsX(): {
  state: TicTacToeState;
  x: PlayerId;
  o: PlayerId;
} {
  const { ctx } = makeCtx({ seed: SEED_BOB_X });
  const state = ticTacToeServerModule.createInitialState(
    [ALICE, BOB],
    {},
    ctx,
  );
  expect(state.symbols[BOB.id]).toBe("X");
  return { state, x: BOB.id, o: ALICE.id };
}

/** Play out a sequence of moves, returning the final state. Asserts each ok. */
function play(
  initial: TicTacToeState,
  moves: Array<{ actor: PlayerId; cellIndex: number }>,
): TicTacToeState {
  const { ctx } = makeCtx();
  let state = initial;
  for (const m of moves) {
    const move: TicTacToeMove = { kind: "place", cellIndex: m.cellIndex };
    const result = ticTacToeServerModule.handleMove(state, move, m.actor, ctx);
    if (!result.ok) {
      throw new Error(`expected ok, got rejection: ${result.reason}`);
    }
    state = result.state;
  }
  return state;
}

describe("ticTacToeServerModule", () => {
  describe("metadata", () => {
    it("exposes stable metadata", () => {
      expect(ticTacToeServerModule.type).toBe("tic-tac-toe");
      expect(ticTacToeServerModule.minPlayers).toBe(2);
      expect(ticTacToeServerModule.maxPlayers).toBe(2);
      expect(ticTacToeServerModule.category).toBe("classic");
    });
  });

  describe("defaultConfig / validateConfig", () => {
    it("defaultConfig returns empty object", () => {
      expect(ticTacToeServerModule.defaultConfig()).toEqual({});
    });

    it("validateConfig accepts undefined, null, and {}", () => {
      expect(ticTacToeServerModule.validateConfig(undefined)).toEqual({});
      expect(ticTacToeServerModule.validateConfig(null)).toEqual({});
      expect(ticTacToeServerModule.validateConfig({})).toEqual({});
    });

    it("validateConfig rejects non-object configs", () => {
      expect(() => ticTacToeServerModule.validateConfig(7)).toThrow();
      expect(() => ticTacToeServerModule.validateConfig("foo")).toThrow();
    });
  });

  describe("createInitialState", () => {
    it("builds a 3x3 empty board", () => {
      const { state } = stateWhereAliceIsX();
      expect(state.cells).toHaveLength(9);
      expect(state.cells.every((c) => c === null)).toBe(true);
    });

    it("assigns one X and one O, and the X player goes first", () => {
      const { state, x } = stateWhereAliceIsX();
      const symbols = Object.values(state.symbols).sort();
      expect(symbols).toEqual(["O", "X"]);
      expect(state.current).toBe(x);
      expect(state.winner).toBeNull();
      expect(state.isDraw).toBe(false);
    });

    it("the seeded rng determines who is X (both branches exercised)", () => {
      const a = stateWhereAliceIsX();
      const b = stateWhereBobIsX();
      expect(a.state.symbols[ALICE.id]).toBe("X");
      expect(b.state.symbols[BOB.id]).toBe("X");
    });

    it("throws when player count is not exactly 2", () => {
      const { ctx } = makeCtx();
      expect(() =>
        ticTacToeServerModule.createInitialState([ALICE], {}, ctx),
      ).toThrow(/exactly 2 players/);
      expect(() =>
        ticTacToeServerModule.createInitialState(
          [ALICE, BOB, { id: "p-c", name: "C" }],
          {},
          ctx,
        ),
      ).toThrow(/exactly 2 players/);
    });
  });

  describe("handleMove", () => {
    it("accepts a valid move, updates cell, swaps current", () => {
      const { state, x, o } = stateWhereAliceIsX();
      const { ctx } = makeCtx();
      const result = ticTacToeServerModule.handleMove(
        state,
        { kind: "place", cellIndex: 4 },
        x,
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.cells[4]).toBe("X");
      expect(result.state.current).toBe(o);
      // Original state is untouched — handleMove returns new state.
      expect(state.cells[4]).toBeNull();
    });

    it("rejects out-of-turn moves", () => {
      const { state, o } = stateWhereAliceIsX();
      const { ctx } = makeCtx();
      const result = ticTacToeServerModule.handleMove(
        state,
        { kind: "place", cellIndex: 0 },
        o,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/turn/i);
    });

    it("rejects a move into a taken cell", () => {
      const { state, x, o } = stateWhereAliceIsX();
      const after = play(state, [{ actor: x, cellIndex: 0 }]);
      const { ctx } = makeCtx();
      const result = ticTacToeServerModule.handleMove(
        after,
        { kind: "place", cellIndex: 0 },
        o,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/taken/i);
    });

    it("rejects out-of-bounds cell indices via schema", () => {
      const { state, x } = stateWhereAliceIsX();
      const { ctx } = makeCtx();
      for (const cellIndex of [-1, 9, 42]) {
        const result = ticTacToeServerModule.handleMove(
          state,
          { kind: "place", cellIndex } as TicTacToeMove,
          x,
          ctx,
        );
        expect(result.ok).toBe(false);
        if (result.ok) continue;
        expect(result.reason).toMatch(/malformed/i);
      }
    });

    it("rejects malformed move (missing kind)", () => {
      const { state, x } = stateWhereAliceIsX();
      const { ctx } = makeCtx();
      const result = ticTacToeServerModule.handleMove(
        state,
        { cellIndex: 0 } as unknown as TicTacToeMove,
        x,
        ctx,
      );
      expect(result.ok).toBe(false);
    });

    it("rejects moves after the game is over", () => {
      const { state, x, o } = stateWhereAliceIsX();
      // X wins top row.
      const terminal = play(state, [
        { actor: x, cellIndex: 0 },
        { actor: o, cellIndex: 3 },
        { actor: x, cellIndex: 1 },
        { actor: o, cellIndex: 4 },
        { actor: x, cellIndex: 2 },
      ]);
      expect(terminal.winner).toBe(x);

      const { ctx } = makeCtx();
      const result = ticTacToeServerModule.handleMove(
        terminal,
        { kind: "place", cellIndex: 5 },
        o,
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/over/i);
    });

    it("rejects a move from someone who isn't in the match", () => {
      // Craft a state whose `current` points at an unknown id — the
      // `symbols[actor]` lookup then fails.
      const { state } = stateWhereAliceIsX();
      const rigged: TicTacToeState = { ...state, current: "p-ghost" };
      const { ctx } = makeCtx();
      const result = ticTacToeServerModule.handleMove(
        rigged,
        { kind: "place", cellIndex: 0 },
        "p-ghost",
        ctx,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toMatch(/not in this match/i);
    });
  });

  describe("view", () => {
    it("returns an identical view for each player and spectator (no hidden info)", () => {
      const { state, x, o } = stateWhereAliceIsX();
      const mid = play(state, [
        { actor: x, cellIndex: 0 },
        { actor: o, cellIndex: 4 },
      ]);
      const xView = ticTacToeServerModule.view(mid, x);
      const oView = ticTacToeServerModule.view(mid, o);
      const specView = ticTacToeServerModule.view(mid, "spectator");
      expect(xView).toEqual(oView);
      expect(oView).toEqual(specView);
    });

    it("populates winningLine when someone has won", () => {
      const { state, x, o } = stateWhereAliceIsX();
      const terminal = play(state, [
        { actor: x, cellIndex: 0 },
        { actor: o, cellIndex: 3 },
        { actor: x, cellIndex: 1 },
        { actor: o, cellIndex: 4 },
        { actor: x, cellIndex: 2 },
      ]);
      const v = ticTacToeServerModule.view(terminal, "spectator");
      expect(v.winningLine).toEqual([0, 1, 2]);
      expect(v.winner).toBe(x);
    });

    it("winningLine is null mid-game", () => {
      const { state, x } = stateWhereAliceIsX();
      const mid = play(state, [{ actor: x, cellIndex: 0 }]);
      const v = ticTacToeServerModule.view(mid, "spectator");
      expect(v.winningLine).toBeNull();
    });

    it("view.cells is a fresh array (not shared with state)", () => {
      const { state } = stateWhereAliceIsX();
      const v = ticTacToeServerModule.view(state, "spectator");
      expect(v.cells).not.toBe(state.cells);
    });
  });

  describe("outcome / isTerminal / phase", () => {
    it("returns null outcome mid-game, play phase, current actor present", () => {
      const { state, x } = stateWhereAliceIsX();
      expect(ticTacToeServerModule.outcome(state)).toBeNull();
      expect(ticTacToeServerModule.isTerminal(state)).toBe(false);
      expect(ticTacToeServerModule.phase(state)).toBe("play");
      expect(ticTacToeServerModule.currentActors(state)).toEqual([x]);
    });

    it("detects a row win (solo outcome, terminal, gameOver phase, no actors)", () => {
      const { state, x, o } = stateWhereAliceIsX();
      const s = play(state, [
        { actor: x, cellIndex: 0 },
        { actor: o, cellIndex: 3 },
        { actor: x, cellIndex: 1 },
        { actor: o, cellIndex: 4 },
        { actor: x, cellIndex: 2 },
      ]);
      const out = ticTacToeServerModule.outcome(s);
      expect(out).toEqual({ kind: "solo", winners: [x], losers: [o] });
      expect(ticTacToeServerModule.isTerminal(s)).toBe(true);
      expect(ticTacToeServerModule.phase(s)).toBe("gameOver");
      expect(ticTacToeServerModule.currentActors(s)).toEqual([]);
    });

    it("detects a column win", () => {
      const { state, x, o } = stateWhereAliceIsX();
      const s = play(state, [
        { actor: x, cellIndex: 0 },
        { actor: o, cellIndex: 1 },
        { actor: x, cellIndex: 3 },
        { actor: o, cellIndex: 4 },
        { actor: x, cellIndex: 6 },
      ]);
      expect(ticTacToeServerModule.outcome(s)).toEqual({
        kind: "solo",
        winners: [x],
        losers: [o],
      });
    });

    it("detects a diagonal win (main diagonal)", () => {
      const { state, x, o } = stateWhereAliceIsX();
      const s = play(state, [
        { actor: x, cellIndex: 0 },
        { actor: o, cellIndex: 1 },
        { actor: x, cellIndex: 4 },
        { actor: o, cellIndex: 2 },
        { actor: x, cellIndex: 8 },
      ]);
      expect(s.winner).toBe(x);
      expect(ticTacToeServerModule.outcome(s)).toEqual({
        kind: "solo",
        winners: [x],
        losers: [o],
      });
    });

    it("detects an anti-diagonal win", () => {
      const { state, x, o } = stateWhereAliceIsX();
      const s = play(state, [
        { actor: x, cellIndex: 2 },
        { actor: o, cellIndex: 0 },
        { actor: x, cellIndex: 4 },
        { actor: o, cellIndex: 1 },
        { actor: x, cellIndex: 6 },
      ]);
      expect(s.winner).toBe(x);
    });

    it("detects a draw when the board is full with no winner", () => {
      const { state, x, o } = stateWhereAliceIsX();
      // X O X
      // X O O
      // O X X   -> no line of three
      const s = play(state, [
        { actor: x, cellIndex: 0 },
        { actor: o, cellIndex: 1 },
        { actor: x, cellIndex: 2 },
        { actor: o, cellIndex: 4 },
        { actor: x, cellIndex: 3 },
        { actor: o, cellIndex: 6 },
        { actor: x, cellIndex: 7 },
        { actor: o, cellIndex: 5 },
        { actor: x, cellIndex: 8 },
      ]);
      expect(s.winner).toBeNull();
      expect(s.isDraw).toBe(true);
      expect(ticTacToeServerModule.outcome(s)).toEqual({ kind: "draw" });
      expect(ticTacToeServerModule.isTerminal(s)).toBe(true);
    });

    it("isTerminal iff outcome is non-null (the SDK invariant)", () => {
      const { state, x, o } = stateWhereAliceIsX();
      const mid = play(state, [
        { actor: x, cellIndex: 0 },
        { actor: o, cellIndex: 4 },
      ]);
      const terminal = play(state, [
        { actor: x, cellIndex: 0 },
        { actor: o, cellIndex: 3 },
        { actor: x, cellIndex: 1 },
        { actor: o, cellIndex: 4 },
        { actor: x, cellIndex: 2 },
      ]);
      for (const s of [state, mid, terminal]) {
        expect(ticTacToeServerModule.isTerminal(s)).toBe(
          ticTacToeServerModule.outcome(s) !== null,
        );
      }
    });
  });
});
