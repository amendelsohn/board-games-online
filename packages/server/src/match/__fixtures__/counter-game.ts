import type {
  GameContext,
  GameEvent,
  GameModule,
  MoveResult,
  Outcome,
  PhaseId,
  Player,
  PlayerId,
  Viewer,
} from '@bgo/sdk';

/**
 * Minimal 2-player "counter" game used exclusively by match.service.spec.ts
 * so the test suite has no dependency on any real game package. Players take
 * turns pressing +1; first to hit the target (default 3) wins. Includes an
 * onTimer handler so the timer path can be exercised.
 *
 * Also exposes two knobs the tests tweak at runtime:
 *  - `failNextMove`: reject the next handleMove with the given reason
 *  - `scheduleTimerOnNextMove`: schedule a timer with the given key + at
 * Both are one-shot and clear themselves after firing.
 */
export interface CounterState {
  order: PlayerId[];
  currentIdx: number;
  count: number;
  target: number;
  winner: PlayerId | null;
  lastTimerKey: string | null;
  phaseName: 'play' | 'gameOver';
}

export type CounterMove =
  | { kind: 'increment' }
  | { kind: 'invalid'; raw: unknown };

export type CounterConfig = { target: number };

export type CounterView = Omit<CounterState, 'lastTimerKey'>;

interface CounterKnobs {
  failNextMove: string | null;
  scheduleTimerOnNextMove: { key: string; at: number } | null;
  emitOnNextMove: { kind: string } | null;
  phaseChangeOnCount: number | null;
}

export const counterKnobs: CounterKnobs = {
  failNextMove: null,
  scheduleTimerOnNextMove: null,
  emitOnNextMove: null,
  phaseChangeOnCount: null,
};

export function resetCounterKnobs(): void {
  counterKnobs.failNextMove = null;
  counterKnobs.scheduleTimerOnNextMove = null;
  counterKnobs.emitOnNextMove = null;
  counterKnobs.phaseChangeOnCount = null;
}

export const COUNTER_GAME_TYPE = 'counter-game';

export const counterGameModule: GameModule<
  CounterState,
  CounterMove,
  CounterConfig,
  CounterView
> = {
  type: COUNTER_GAME_TYPE,
  displayName: 'Counter',
  description: 'Test fixture: players take turns incrementing a counter.',
  category: 'classic',
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): CounterConfig {
    return { target: 3 };
  },

  validateConfig(cfg: unknown): CounterConfig {
    if (cfg && typeof cfg === 'object' && 'target' in cfg) {
      const t = (cfg as { target: unknown }).target;
      if (typeof t === 'number' && t > 0) return { target: t };
    }
    return { target: 3 };
  },

  createInitialState(
    players: Player[],
    cfg: CounterConfig,
    _ctx: GameContext,
  ): CounterState {
    return {
      order: players.map((p) => p.id),
      currentIdx: 0,
      count: 0,
      target: cfg.target,
      winner: null,
      lastTimerKey: null,
      phaseName: 'play',
    };
  },

  handleMove(
    state: CounterState,
    move: CounterMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<CounterState> {
    if (state.winner) return { ok: false, reason: 'Game is over' };
    if (state.order[state.currentIdx] !== actor) {
      return { ok: false, reason: 'Not your turn' };
    }
    if (move.kind !== 'increment') {
      return { ok: false, reason: 'Malformed move' };
    }
    if (counterKnobs.failNextMove !== null) {
      const reason = counterKnobs.failNextMove;
      counterKnobs.failNextMove = null;
      return { ok: false, reason };
    }

    if (counterKnobs.scheduleTimerOnNextMove) {
      const { key, at } = counterKnobs.scheduleTimerOnNextMove;
      counterKnobs.scheduleTimerOnNextMove = null;
      ctx.scheduleTimer(key, at);
    }
    const events: GameEvent[] = [];
    if (counterKnobs.emitOnNextMove) {
      const { kind } = counterKnobs.emitOnNextMove;
      counterKnobs.emitOnNextMove = null;
      events.push({ kind, to: 'all' });
    }

    const nextCount = state.count + 1;
    const winner = nextCount >= state.target ? actor : null;
    const nextPhase =
      counterKnobs.phaseChangeOnCount === nextCount || winner
        ? 'gameOver'
        : state.phaseName;
    if (counterKnobs.phaseChangeOnCount === nextCount) {
      counterKnobs.phaseChangeOnCount = null;
    }
    return {
      ok: true,
      state: {
        ...state,
        count: nextCount,
        currentIdx: (state.currentIdx + 1) % state.order.length,
        winner,
        phaseName: nextPhase,
      },
      events: events.length > 0 ? events : undefined,
    };
  },

  onTimer(
    state: CounterState,
    key: string,
    _ctx: GameContext,
  ): MoveResult<CounterState> {
    return { ok: true, state: { ...state, lastTimerKey: key } };
  },

  view(state: CounterState, _viewer: Viewer): CounterView {
    const { lastTimerKey: _lt, ...pub } = state;
    return pub;
  },

  phase(state: CounterState): PhaseId {
    return state.phaseName;
  },

  currentActors(state: CounterState): PlayerId[] {
    if (state.winner) return [];
    return [state.order[state.currentIdx]!];
  },

  isTerminal(state: CounterState): boolean {
    return state.winner !== null;
  },

  outcome(state: CounterState): Outcome | null {
    if (!state.winner) return null;
    const losers = state.order.filter((id) => id !== state.winner);
    return { kind: 'solo', winners: [state.winner], losers };
  },
};
