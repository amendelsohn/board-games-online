import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { PlayerId, Player } from '@bgo/sdk';
import { LobbyStore, StoredPlayer } from '../state/lobby-store.service';
import { generateSessionToken } from '../common/session';

@Injectable()
export class PlayersService {
  constructor(private readonly lobby: LobbyStore) {}

  create(name: string): StoredPlayer {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Player name is required');
    const player: StoredPlayer = {
      id: uuidv4(),
      name: trimmed,
      sessionToken: generateSessionToken(),
      createdAt: Date.now(),
    };
    this.lobby.savePlayer(player);
    return player;
  }

  rename(id: PlayerId, name: string): StoredPlayer {
    const p = this.lobby.getPlayer(id);
    if (!p) throw new NotFoundException(`Player ${id} not found`);
    const next: StoredPlayer = { ...p, name: name.trim() };
    this.lobby.savePlayer(next);
    return next;
  }

  require(id: PlayerId): StoredPlayer {
    const p = this.lobby.getPlayer(id);
    if (!p) throw new NotFoundException(`Player ${id} not found`);
    return p;
  }

  toWire(p: StoredPlayer): Player {
    return { id: p.id, name: p.name };
  }
}
