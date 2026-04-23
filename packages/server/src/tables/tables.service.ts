import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { JoinCode, PlayerId, TableId } from '@bgo/sdk';
import { LobbyStore, StoredTable } from '../state/lobby-store.service';
import { GamesRegistry } from '../games/games-registry.service';

@Injectable()
export class TablesService {
  constructor(
    private readonly lobby: LobbyStore,
    private readonly games: GamesRegistry,
  ) {}

  create(gameType: string, hostPlayerId: PlayerId): StoredTable {
    const mod = this.games.get(gameType);
    const table: StoredTable = {
      id: uuidv4(),
      joinCode: this.generateJoinCode(),
      gameType,
      hostPlayerId,
      playerIds: [hostPlayerId],
      status: 'waiting',
      matchId: null,
      config: mod.defaultConfig(),
      createdAt: Date.now(),
    };
    this.lobby.saveTable(table);
    return table;
  }

  join(joinCode: JoinCode, playerId: PlayerId): StoredTable {
    const table = this.lobby.getTableByJoinCode(joinCode);
    if (!table) throw new NotFoundException(`No table with code ${joinCode}`);
    if (table.status !== 'waiting') {
      throw new BadRequestException(
        `Table ${table.id} is not accepting new players`,
      );
    }
    // Idempotent: if the player is already seated, just return the table.
    // Important because the lobby page re-calls join on mount after the
    // home page already joined — without this the second call fails "full".
    if (table.playerIds.includes(playerId)) return table;
    const mod = this.games.get(table.gameType);
    if (table.playerIds.length >= mod.maxPlayers) {
      throw new BadRequestException(
        `Table is full (max ${mod.maxPlayers} players)`,
      );
    }
    const next: StoredTable = {
      ...table,
      playerIds: [...table.playerIds, playerId],
    };
    this.lobby.saveTable(next);
    return next;
  }

  updateConfig(
    tableId: TableId,
    hostPlayerId: PlayerId,
    rawConfig: unknown,
  ): StoredTable {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostPlayerId);
    if (table.status !== 'waiting') {
      throw new BadRequestException('Config can only be changed before start');
    }
    const mod = this.games.get(table.gameType);
    const validated = mod.validateConfig(rawConfig);
    const next: StoredTable = { ...table, config: validated };
    this.lobby.saveTable(next);
    return next;
  }

  markStarted(tableId: TableId, matchId: string): StoredTable {
    const table = this.requireTable(tableId);
    const next: StoredTable = { ...table, status: 'playing', matchId };
    this.lobby.saveTable(next);
    return next;
  }

  markFinished(tableId: TableId): StoredTable {
    const table = this.requireTable(tableId);
    const next: StoredTable = { ...table, status: 'finished' };
    this.lobby.saveTable(next);
    return next;
  }

  /**
   * Reset a table back to "waiting" so the same group can play again with
   * the same config. Preserves players, join code, gameType, and config;
   * drops matchId. Host-only. Valid once the current match has finished
   * (or while still "waiting" — that's a no-op).
   */
  rematch(tableId: TableId, hostPlayerId: PlayerId): StoredTable {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostPlayerId);
    if (table.status === 'playing') {
      throw new BadRequestException(
        'Cannot rematch while the current match is still in progress',
      );
    }
    if (table.status === 'waiting' && table.matchId === null) {
      return table; // nothing to do
    }
    const next: StoredTable = {
      ...table,
      status: 'waiting',
      matchId: null,
    };
    this.lobby.saveTable(next);
    return next;
  }

  kick(
    tableId: TableId,
    hostPlayerId: PlayerId,
    targetId: PlayerId,
  ): StoredTable {
    const table = this.requireTable(tableId);
    this.requireHost(table, hostPlayerId);
    if (table.status !== 'waiting') {
      throw new BadRequestException('Cannot kick players after start');
    }
    if (targetId === hostPlayerId) {
      throw new BadRequestException('Host cannot kick themselves');
    }
    const next: StoredTable = {
      ...table,
      playerIds: table.playerIds.filter((id) => id !== targetId),
    };
    this.lobby.saveTable(next);
    return next;
  }

  leave(tableId: TableId, playerId: PlayerId): StoredTable | null {
    const table = this.requireTable(tableId);
    if (!table.playerIds.includes(playerId)) return table;
    const remaining = table.playerIds.filter((id) => id !== playerId);

    // If host leaves, hand off to the next player (or delete if empty).
    if (remaining.length === 0) {
      this.lobby.deleteTable(tableId);
      return null;
    }
    const nextHost =
      table.hostPlayerId === playerId ? remaining[0]! : table.hostPlayerId;
    const next: StoredTable = {
      ...table,
      playerIds: remaining,
      hostPlayerId: nextHost,
    };
    this.lobby.saveTable(next);
    return next;
  }

  requireTable(tableId: TableId): StoredTable {
    const t = this.lobby.getTable(tableId);
    if (!t) throw new NotFoundException(`Table ${tableId} not found`);
    return t;
  }

  requireHost(table: StoredTable, playerId: PlayerId): void {
    if (table.hostPlayerId !== playerId) {
      throw new ForbiddenException('Only the host can do this');
    }
  }

  /** 4-letter join code; retries until a free one is found. */
  private generateJoinCode(): JoinCode {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (confusable)
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (!this.lobby.joinCodeInUse(code)) return code as JoinCode;
    }
    throw new Error('Failed to generate unique join code');
  }
}
