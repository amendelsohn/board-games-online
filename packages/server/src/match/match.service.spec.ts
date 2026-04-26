import { Test, TestingModule } from '@nestjs/testing';
import type { MatchId, PlayerId, Viewer } from '@bgo/sdk';

import { MatchService } from './match.service';
import { GamesRegistry } from '../games/games-registry.service';
import { TablesService } from '../tables/tables.service';
import { PlayersService } from '../players/players.service';
import { LobbyStore, StoredPlayer } from '../state/lobby-store.service';
import { InMemoryStateStore } from '../state/in-memory-state-store.service';
import {
  COUNTER_GAME_TYPE,
  CounterState,
  CounterView,
  counterGameModule,
  counterKnobs,
  resetCounterKnobs,
} from './__fixtures__/counter-game';

/**
 * Unit tests for the match-service core. Wires the real service against real
 * in-memory helpers, but registers only a test-fixture counter game (see
 * __fixtures__/counter-game.ts) so the suite stays isolated from any real
 * game package. Timers go through the real InMemoryStateStore so the test
 * exercises the live scheduleTimer → onTimer path.
 */

interface Fixture {
  service: MatchService;
  registry: GamesRegistry;
  tables: TablesService;
  players: PlayersService;
  lobby: LobbyStore;
  store: InMemoryStateStore;
  host: StoredPlayer;
  guest: StoredPlayer;
}

async function buildFixture(): Promise<Fixture> {
  resetCounterKnobs();
  const mod: TestingModule = await Test.createTestingModule({
    providers: [
      MatchService,
      GamesRegistry,
      TablesService,
      PlayersService,
      LobbyStore,
      InMemoryStateStore,
      { provide: 'StateStore', useExisting: InMemoryStateStore },
    ],
  }).compile();
  // Exercise the real OnModuleInit so the store → matchService timer callback
  // is wired up. Without init(), onTimer never fires.
  await mod.init();

  const registry = mod.get(GamesRegistry);
  registry.register(counterGameModule);

  const service = mod.get(MatchService);
  const players = mod.get(PlayersService);
  const tables = mod.get(TablesService);
  const lobby = mod.get(LobbyStore);
  const store = mod.get(InMemoryStateStore);

  const host = players.create('Host');
  const guest = players.create('Guest');

  return { service, registry, tables, players, lobby, store, host, guest };
}

async function startCounterMatch(
  fx: Fixture,
  configOverride?: unknown,
): Promise<{ matchId: MatchId; host: PlayerId; guest: PlayerId }> {
  const table = fx.tables.create(COUNTER_GAME_TYPE, fx.host.id);
  fx.tables.join(table.joinCode, fx.guest.id);
  if (configOverride !== undefined) {
    fx.tables.updateConfig(table.id, fx.host.id, configOverride);
  }
  const started = await fx.service.startMatch(table.id, fx.host.id);
  return {
    matchId: started.matchId!,
    host: fx.host.id,
    guest: fx.guest.id,
  };
}

async function getView(
  fx: Fixture,
  matchId: MatchId,
  viewer: Viewer,
): Promise<{
  view: CounterView;
  phase: string;
  currentActors: PlayerId[];
  isTerminal: boolean;
  version: number;
  outcome: unknown;
}> {
  const v = await fx.service.getView(matchId, viewer);
  if (!v) throw new Error('expected view');
  return v as {
    view: CounterView;
    phase: string;
    currentActors: PlayerId[];
    isTerminal: boolean;
    version: number;
    outcome: unknown;
  };
}

describe('MatchService', () => {
  describe('handleMove (happy path)', () => {
    it('applies a valid move: state updates and version increments', async () => {
      const fx = await buildFixture();
      const { matchId, host } = await startCounterMatch(fx);

      const before = await getView(fx, matchId, host);
      expect(before.version).toBe(0);
      expect(before.view.count).toBe(0);
      expect(before.currentActors).toEqual([host]);

      const result = await fx.service.submitMove(matchId, host, {
        kind: 'increment',
      });
      expect(result).toEqual({ ok: true });

      const after = await getView(fx, matchId, host);
      expect(after.version).toBe(1);
      expect(after.view.count).toBe(1);
      expect(after.currentActors).toEqual([fx.guest.id]);
    });

    it('notifies subscribers on state change', async () => {
      const fx = await buildFixture();
      const { matchId, host } = await startCounterMatch(fx);

      const views: CounterView[] = [];
      const unsub = fx.service.subscribeViews(matchId, host, (v) => {
        views.push(v.view as CounterView);
      });

      await fx.service.submitMove(matchId, host, { kind: 'increment' });
      expect(views).toHaveLength(1);
      expect(views[0]!.count).toBe(1);
      unsub();
    });

    it('emits game events to registered listeners', async () => {
      const fx = await buildFixture();
      const { matchId, host } = await startCounterMatch(fx);

      const received: Array<{ matchId: MatchId; kind: string }> = [];
      const unsub = fx.service.subscribeEvents((mid, ev) => {
        received.push({ matchId: mid, kind: ev.kind });
      });

      counterKnobs.emitOnNextMove = { kind: 'test-event' };
      const result = await fx.service.submitMove(matchId, host, {
        kind: 'increment',
      });
      expect(result).toEqual({ ok: true });
      expect(received).toEqual([{ matchId, kind: 'test-event' }]);
      unsub();
    });
  });

  describe('handleMove (rejections)', () => {
    it('rejects an out-of-turn actor with the game-module reason', async () => {
      const fx = await buildFixture();
      const { matchId, guest } = await startCounterMatch(fx);
      const result = await fx.service.submitMove(matchId, guest, {
        kind: 'increment',
      });
      expect(result).toEqual({ ok: false, reason: 'Not your turn' });
    });

    it('surfaces a game-reports-ok-false rejection verbatim', async () => {
      const fx = await buildFixture();
      const { matchId, host } = await startCounterMatch(fx);
      counterKnobs.failNextMove = 'Malformed move payload';
      const result = await fx.service.submitMove(matchId, host, {
        kind: 'increment',
      });
      expect(result).toEqual({ ok: false, reason: 'Malformed move payload' });
    });

    it('rejects moves once the match is terminal', async () => {
      const fx = await buildFixture();
      // Target 1 → the very first increment ends the match.
      const { matchId, host, guest } = await startCounterMatch(fx, {
        target: 1,
      });
      const first = await fx.service.submitMove(matchId, host, {
        kind: 'increment',
      });
      expect(first).toEqual({ ok: true });

      const terminalView = await getView(fx, matchId, 'spectator');
      expect(terminalView.isTerminal).toBe(true);
      expect(terminalView.outcome).toEqual({
        kind: 'solo',
        winners: [host],
        losers: [guest],
      });

      const after = await fx.service.submitMove(matchId, guest, {
        kind: 'increment',
      });
      expect(after).toEqual({ ok: false, reason: 'Game is over' });
    });

    it('rejects handleMove throws as a safe internal-error rejection', async () => {
      const fx = await buildFixture();
      const { matchId, host } = await startCounterMatch(fx);
      // Mutate the module to simulate an internal throw.
      const original = counterGameModule.handleMove;
      counterGameModule.handleMove = () => {
        throw new Error('boom');
      };
      try {
        const result = await fx.service.submitMove(matchId, host, {
          kind: 'increment',
        });
        expect(result).toEqual({
          ok: false,
          reason: 'Internal error processing move',
        });
      } finally {
        counterGameModule.handleMove = original;
      }
    });

    it('throws a forbidden error when actor is not a participant', async () => {
      const fx = await buildFixture();
      const { matchId } = await startCounterMatch(fx);
      await expect(
        fx.service.submitMove(matchId, 'p-stranger', { kind: 'increment' }),
      ).rejects.toThrow(/participant/i);
    });
  });

  describe('phase transitions', () => {
    it('surfaces a new phase on subscribed views when the module advances phase', async () => {
      const fx = await buildFixture();
      const { matchId, host } = await startCounterMatch(fx);

      counterKnobs.phaseChangeOnCount = 1;
      const phases: string[] = [];
      const unsub = fx.service.subscribeViews(matchId, host, (v) => {
        phases.push(v.phase);
      });

      await fx.service.submitMove(matchId, host, { kind: 'increment' });
      expect(phases).toEqual(['gameOver']);
      unsub();
    });
  });

  describe('terminal detection + outcome surfacing', () => {
    it('marks the table finished and freezes the view', async () => {
      const fx = await buildFixture();
      const { matchId, host, guest } = await startCounterMatch(fx, {
        target: 1,
      });
      await fx.service.submitMove(matchId, host, { kind: 'increment' });

      const view = await getView(fx, matchId, 'spectator');
      expect(view.isTerminal).toBe(true);
      expect(view.phase).toBe('gameOver');
      expect(view.currentActors).toEqual([]);
      expect(view.outcome).toEqual({
        kind: 'solo',
        winners: [host],
        losers: [guest],
      });

      const meta = fx.service.getMatchMeta(matchId)!;
      const table = fx.lobby.getTable(meta.tableId)!;
      expect(table.status).toBe('finished');
    });
  });

  describe('timers', () => {
    it('scheduled timer fires and onTimer is invoked with the right key', async () => {
      jest.useFakeTimers();
      try {
        const fx = await buildFixture();
        const { matchId, host } = await startCounterMatch(fx);

        counterKnobs.scheduleTimerOnNextMove = { key: 'tick', at: 0 };
        const result = await fx.service.submitMove(matchId, host, {
          kind: 'increment',
        });
        expect(result).toEqual({ ok: true });

        // The store's setTimeout has been scheduled with delay=0; advance the
        // synthetic clock to fire it, then flush the microtask queue that
        // applyNewState uses to persist the onTimer result.
        jest.runAllTimers();
        await Promise.resolve();
        await Promise.resolve();

        const view = await getView(fx, matchId, 'spectator');
        const raw = (await fx.store.get(matchId)) as {
          state: CounterState;
          version: number;
        } | null;
        expect(raw?.state.lastTimerKey).toBe('tick');
        // Two applyNewState calls: the move, then the timer.
        expect(view.version).toBe(2);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
