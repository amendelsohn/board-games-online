import { GameState } from "@/types";

// Interface for game-specific logic
export interface GameLogic<MoveType = any, GameSpecificState = any> {
  // Game metadata
  getGameType(): string;

  // Game state management
  getInitialState(): GameSpecificState;
  validateMove(state: GameState, move: MoveType, playerId: string): boolean;

  // Game status
  checkGameOver(state: GameState): boolean;
  getGameStatus(state: GameState, currentPlayerId: string): string;

  // Optional methods
  getNextPlayer?(state: GameState, currentPlayerId: string): string;
}

// Registry of game implementations
class GameRegistry {
  private games = new Map<string, GameLogic>();

  registerGame(game: GameLogic): void {
    this.games.set(game.getGameType(), game);
  }

  getGame(gameType: string): GameLogic | undefined {
    return this.games.get(gameType);
  }

  getAllGameTypes(): string[] {
    return Array.from(this.games.keys());
  }
}

// Singleton instance
export const gameRegistry = new GameRegistry();
