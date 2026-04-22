import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type {
  GameContext,
  GameEvent,
  GameModule,
  MatchId,
  MoveResult,
  PlayerId,
  StateStore,
  Viewer,
  Versioned,
  Outcome,
} from '@bgo/sdk';
import { createRng, seedFromString } from '@bgo/sdk';
import { GamesRegistry } from '../games/games-registry.service';
import { TablesService } from '../tables/tables.service';
import {
  LobbyStore,
  StoredPlayer,
  StoredTable,
} from '../state/lobby-store.service';
import { PlayersService } from '../players/players.service';
import { InMemoryStateStore } from '../state/in-memory-state-store.service';

/**
 * Tracks per-match runtime data: the game-type, the seeded RNG, and any
 * pending timers scheduled by ctx.scheduleTimer. Lives next to the persisted
 * state in the StateStore.
 */
interface MatchMeta {
  matchId: MatchId;
  tableId: string;
  gameType: string;
  seed: number;
}

export type MatchEventListener = (
  matchId: MatchId,
  event: GameEvent,
) => void;

type MatchView = {
  view: unknown;
  phase: string;
  currentActors: PlayerId[];
  isTerminal: boolean;
  version: number;
  outcome: Outcome | null;
};

@Injectable()
export class MatchService implements OnModuleInit {
  private readonly log = new Logger(MatchService.name);
  private readonly metaByMatch = new Map<MatchId, MatchMeta>();
  private readonly matchIdByTable = new Map<string, MatchId>();
  private readonly eventListeners = new Set<MatchEventListener>();

  constructor(
    private readonly games: GamesRegistry,
    private readonly tables: TablesService,
    private readonly players: PlayersService,
    private readonly lobby: LobbyStore,
    @Inject('StateStore') private readonly store: StateStore,
    private readonly concreteStore: InMemoryStateStore,
  ) {}

  onModuleInit(): void {
    // The store dispatches timer fires back to us. Done here to avoid a
    // circular constructor dependency.
    this.concreteStore.setTimerFirer((matchId, key) =>
      this.onTimer(matchId, key),
    );
  }

  // ------------------------- Lifecycle -------------------------

  async startMatch(tableId: string, hostPlayerId: PlayerId): Promise<StoredTable> {
    const table = this.tables.requireTable(tableId);
    this.tables.requireHost(table, hostPlayerId);
    if (table.status !== 'waiting') {
      throw new BadRequestException('Match has already started or finished');
    }
    const mod = this.games.get(table.gameType);
    if (table.playerIds.length < mod.minPlayers) {
      throw new BadRequestException(
        `Need at least ${mod.minPlayers} players to start`,
      );
    }
    if (table.playerIds.length > mod.maxPlayers) {
      throw new BadRequestException(
        `Too many players; max is ${mod.maxPlayers}`,
      );
    }

    const storedPlayers = this.lobby.getPlayersByIds(table.playerIds);
    const players = storedPlayers.map((p) => this.players.toWire(p));

    const matchId = uuidv4();
    const seed = seedFromString(matchId);
    const ctx = this.makeContext(matchId, 0, seed);
    const cfg = mod.validateConfig(table.config ?? mod.defaultConfig());
    const initialState = mod.createInitialState(players, cfg, ctx);

    await this.store.create(matchId, initialState);

    this.metaByMatch.set(matchId, {
      matchId,
      tableId: table.id,
      gameType: table.gameType,
      seed,
    });
    this.matchIdByTable.set(table.id, matchId);

    const next = this.tables.markStarted(table.id, matchId);
    await this.publishView(matchId);
    return next;
  }

  // ------------------------- Moves -------------------------

  async submitMove(
    matchId: MatchId,
    actor: PlayerId,
    move: unknown,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const meta = this.metaByMatch.get(matchId);
    if (!meta) throw new NotFoundException(`Match ${matchId} not found`);
    const table = this.lobby.getTable(meta.tableId);
    if (!table) throw new NotFoundException('Parent table vanished');
    if (!table.playerIds.includes(actor)) {
      throw new ForbiddenException('Not a player in this match');
    }

    const mod = this.games.get(meta.gameType);
    const current = await this.store.get(matchId);
    if (!current) throw new NotFoundException('No state for match');

    const ctx = this.makeContext(matchId, current.version + 1, meta.seed);
    const result = this.safeHandleMove(mod, current.state, move, actor, ctx);
    if (!result.ok) return { ok: false, reason: result.reason };

    await this.applyNewState(matchId, mod, result.state, result.events ?? []);
    return { ok: true };
  }

  private safeHandleMove(
    mod: GameModule<unknown, unknown, unknown, unknown>,
    state: unknown,
    move: unknown,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<unknown> {
    try {
      return mod.handleMove(state, move as never, actor, ctx) as MoveResult<unknown>;
    } catch (err) {
      this.log.error(`handleMove threw: ${(err as Error).message}`);
      return { ok: false, reason: 'Internal error processing move' };
    }
  }

  private async onTimer(matchId: MatchId, key: string): Promise<void> {
    const meta = this.metaByMatch.get(matchId);
    if (!meta) return;
    const mod = this.games.get(meta.gameType);
    if (!mod.onTimer) return;
    const current = await this.store.get(matchId);
    if (!current) return;
    const ctx = this.makeContext(matchId, current.version + 1, meta.seed);
    const result: MoveResult<unknown> = mod.onTimer(
      current.state,
      key,
      ctx,
    ) as MoveResult<unknown>;
    if (!result.ok) {
      this.log.warn(`onTimer rejected for ${matchId}:${key}: ${result.reason}`);
      return;
    }
    await this.applyNewState(matchId, mod, result.state, result.events ?? []);
  }

  private async applyNewState(
    matchId: MatchId,
    mod: GameModule<unknown, unknown, unknown, unknown>,
    state: unknown,
    events: GameEvent[],
  ): Promise<void> {
    const next = await this.store.set(matchId, state);
    for (const ev of events) {
      for (const listener of this.eventListeners) listener(matchId, ev);
    }
    await this.store.publish(matchId, next);

    if (mod.isTerminal(state)) {
      const meta = this.metaByMatch.get(matchId);
      if (meta) this.tables.markFinished(meta.tableId);
    }
  }

  // ------------------------- Views -------------------------

  async getView(matchId: MatchId, viewer: Viewer): Promise<MatchView | null> {
    const meta = this.metaByMatch.get(matchId);
    if (!meta) return null;
    const current = await this.store.get(matchId);
    if (!current) return null;
    const mod = this.games.get(meta.gameType);
    return this.computeView(mod, current, viewer);
  }

  private computeView(
    mod: GameModule<unknown, unknown, unknown, unknown>,
    versioned: Versioned<unknown>,
    viewer: Viewer,
  ): MatchView {
    return {
      view: mod.view(versioned.state, viewer),
      phase: mod.phase(versioned.state),
      currentActors: mod.currentActors(versioned.state),
      isTerminal: mod.isTerminal(versioned.state),
      version: versioned.version,
      outcome: mod.outcome(versioned.state),
    };
  }

  /** Gateway uses this to watch a match and re-project on every change. */
  subscribeViews(
    matchId: MatchId,
    viewer: Viewer,
    onView: (v: MatchView) => void,
  ): () => void {
    const meta = this.metaByMatch.get(matchId);
    if (!meta) throw new NotFoundException(`Match ${matchId} not found`);
    const mod = this.games.get(meta.gameType);
    return this.store.subscribe(matchId, (versioned) => {
      onView(this.computeView(mod, versioned as Versioned<unknown>, viewer));
    });
  }

  /** Gateway uses this to route side-channel events to the right players. */
  subscribeEvents(listener: MatchEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  getMatchMeta(matchId: MatchId): MatchMeta | undefined {
    return this.metaByMatch.get(matchId);
  }

  getMatchTable(matchId: MatchId): StoredTable | null {
    const meta = this.metaByMatch.get(matchId);
    if (!meta) return null;
    return this.lobby.getTable(meta.tableId) ?? null;
  }

  getPlayerById(id: PlayerId): StoredPlayer | undefined {
    return this.lobby.getPlayer(id);
  }

  // ------------------------- Helpers -------------------------

  private async publishView(matchId: MatchId): Promise<void> {
    const current = await this.store.get(matchId);
    if (!current) return;
    await this.store.publish(matchId, current);
  }

  private makeContext(
    matchId: MatchId,
    nextVersion: number,
    seed: number,
  ): GameContext {
    const store = this.store;
    const rng = createRng(seed + nextVersion); // deterministic per version
    const pendingEvents: GameEvent[] = [];
    return {
      version: nextVersion,
      now: Date.now(),
      rng,
      scheduleTimer(key: string, at: number) {
        void store.scheduleTimer(matchId, key, at);
      },
      cancelTimer(key: string) {
        void store.cancelTimer(matchId, key);
      },
      emit(event: GameEvent) {
        pendingEvents.push(event);
      },
    };
  }
}
