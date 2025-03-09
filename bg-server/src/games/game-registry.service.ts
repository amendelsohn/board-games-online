import { Injectable } from '@nestjs/common';
import { Game } from './game-interface';

@Injectable()
export class GameRegistryService {
  private games = new Map<string, Game>();

  registerGame(game: Game): void {
    const gameType = game.getGameType();
    this.games.set(gameType, game);
  }

  getGame(gameType: string): Game | undefined {
    return this.games.get(gameType);
  }

  getAllGameTypes(): string[] {
    return Array.from(this.games.keys());
  }

  isGameTypeSupported(gameType: string): boolean {
    return this.games.has(gameType);
  }
}
