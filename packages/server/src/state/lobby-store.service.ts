import { Injectable } from '@nestjs/common';
import type { JoinCode, PlayerId, TableId } from '@bgo/sdk';

export interface StoredPlayer {
  id: PlayerId;
  name: string;
  sessionToken: string;
  createdAt: number;
}

export interface StoredTable {
  id: TableId;
  joinCode: JoinCode;
  gameType: string;
  hostPlayerId: PlayerId;
  /**
   * Whether the host occupies a seat in this table. Mirrors the game
   * module's `hostSeated` flag at table-creation time so the host's role
   * is fixed for the table's lifetime even if a future server change
   * flips the module flag.
   */
  hostIsPlayer: boolean;
  playerIds: PlayerId[];
  status: 'waiting' | 'playing' | 'finished';
  matchId: string | null;
  config: unknown;
  createdAt: number;
}

/**
 * In-memory lobby storage — players and tables. These are cheap records; the
 * game state itself lives in the StateStore (and is larger). Separating them
 * keeps the store interface narrow.
 */
@Injectable()
export class LobbyStore {
  private readonly players = new Map<PlayerId, StoredPlayer>();
  private readonly tokens = new Map<string, PlayerId>();
  private readonly tables = new Map<TableId, StoredTable>();
  private readonly joinCodeIndex = new Map<JoinCode, TableId>();

  // ----- Players -----

  savePlayer(p: StoredPlayer): void {
    this.players.set(p.id, p);
    this.tokens.set(p.sessionToken, p.id);
  }

  getPlayer(id: PlayerId): StoredPlayer | undefined {
    return this.players.get(id);
  }

  getPlayerByToken(token: string): StoredPlayer | undefined {
    const id = this.tokens.get(token);
    return id ? this.players.get(id) : undefined;
  }

  getPlayersByIds(ids: readonly PlayerId[]): StoredPlayer[] {
    return ids
      .map((id) => this.players.get(id))
      .filter((p): p is StoredPlayer => p !== undefined);
  }

  // ----- Tables -----

  saveTable(t: StoredTable): void {
    this.tables.set(t.id, t);
    this.joinCodeIndex.set(t.joinCode, t.id);
  }

  getTable(id: TableId): StoredTable | undefined {
    return this.tables.get(id);
  }

  getTableByJoinCode(code: JoinCode): StoredTable | undefined {
    const id = this.joinCodeIndex.get(code);
    return id ? this.tables.get(id) : undefined;
  }

  deleteTable(id: TableId): void {
    const t = this.tables.get(id);
    if (!t) return;
    this.tables.delete(id);
    this.joinCodeIndex.delete(t.joinCode);
  }

  joinCodeInUse(code: JoinCode): boolean {
    return this.joinCodeIndex.has(code);
  }

  listTables(): StoredTable[] {
    return Array.from(this.tables.values());
  }
}
