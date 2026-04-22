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
  BEATS,
  RPS_TYPE,
  WINS_TO_CLINCH,
  moveSchema,
  resolvePair,
  type RpsConfig,
  type RpsMove,
  type RpsRoundRecord,
  type RpsState,
  type RpsView,
  type Throw,
} from "./shared";

function allSubmitted(
  order: readonly PlayerId[],
  throws: Record<PlayerId, Throw | null>,
): boolean {
  return order.every((id) => throws[id] != null);
}

export const rpsServerModule: GameModule<
  RpsState,
  RpsMove,
  RpsConfig,
  RpsView
> = {
  type: RPS_TYPE,
  displayName: "Rock Paper Scissors",
  description:
    "Five throws, five choices, one champion — Sam Kass's extended RPS.",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): RpsConfig {
    return {};
  },

  validateConfig(cfg: unknown): RpsConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: RpsConfig,
    _ctx: GameContext,
  ): RpsState {
    if (players.length !== 2) {
      throw new Error(`rps requires exactly 2 players, got ${players.length}`);
    }
    const [a, b] = players;
    const order: readonly PlayerId[] = [a!.id, b!.id];
    const scores: Record<PlayerId, number> = { [a!.id]: 0, [b!.id]: 0 };
    const currentThrows: Record<PlayerId, Throw | null> = {
      [a!.id]: null,
      [b!.id]: null,
    };
    return {
      order,
      scores,
      currentThrows,
      round: 1,
      roundHistory: [],
      phase: "choosing",
      winner: null,
    };
  },

  handleMove(
    state: RpsState,
    move: RpsMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<RpsState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    if (!state.order.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    const pick = parsed.data.throw;
    if (!(pick in BEATS)) {
      return { ok: false, reason: "Unknown throw" };
    }

    // Re-submit is allowed until the round resolves; we just overwrite.
    const nextThrows: Record<PlayerId, Throw | null> = {
      ...state.currentThrows,
      [actor]: pick,
    };

    if (!allSubmitted(state.order, nextThrows)) {
      return {
        ok: true,
        state: { ...state, currentThrows: nextThrows },
      };
    }

    // Both submitted — resolve.
    const [aId, bId] = state.order;
    const aThrow = nextThrows[aId!]!;
    const bThrow = nextThrows[bId!]!;
    const winningThrow = resolvePair(aThrow, bThrow);
    const roundWinner: PlayerId | null =
      winningThrow === null ? null : winningThrow === aThrow ? aId! : bId!;

    const record: RpsRoundRecord = {
      throws: { [aId!]: aThrow, [bId!]: bThrow },
      winner: roundWinner,
    };
    const history = [...state.roundHistory, record];

    const scores = { ...state.scores };
    if (roundWinner) scores[roundWinner] = (scores[roundWinner] ?? 0) + 1;

    const matchWinnerId =
      roundWinner && scores[roundWinner]! >= WINS_TO_CLINCH
        ? roundWinner
        : null;

    const clearedThrows: Record<PlayerId, Throw | null> = {
      [aId!]: null,
      [bId!]: null,
    };

    return {
      ok: true,
      state: {
        order: state.order,
        scores,
        currentThrows: clearedThrows,
        round: matchWinnerId ? state.round : state.round + 1,
        roundHistory: history,
        phase: matchWinnerId ? "gameOver" : "choosing",
        winner: matchWinnerId,
      },
    };
  },

  view(state: RpsState, viewer: Viewer): RpsView {
    const isSpectator = viewer === "spectator";
    const submitted: Record<PlayerId, boolean> = {};
    for (const id of state.order) submitted[id] = state.currentThrows[id] != null;
    const myThrow: Throw | null =
      !isSpectator && state.order.includes(viewer)
        ? (state.currentThrows[viewer] ?? null)
        : null;

    return {
      order: [...state.order],
      scores: { ...state.scores },
      submitted,
      myThrow,
      round: state.round,
      roundHistory: state.roundHistory.map((r) => ({
        throws: { ...r.throws },
        winner: r.winner,
      })),
      phase: state.phase,
      winner: state.winner,
      winsToClinch: WINS_TO_CLINCH,
    };
  },

  phase(state: RpsState): PhaseId {
    return state.phase;
  },

  currentActors(state: RpsState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    // Simultaneous: both players are always actors until the round resolves.
    // A player who's already submitted can still re-submit to change their throw.
    return [...state.order];
  },

  isTerminal(state: RpsState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: RpsState): Outcome | null {
    if (!state.winner) return null;
    const losers = state.order.filter((id) => id !== state.winner);
    return { kind: "solo", winners: [state.winner], losers };
  },
};
