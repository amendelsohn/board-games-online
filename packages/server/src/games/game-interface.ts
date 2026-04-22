import { PlayerId } from 'src/player/Player';
import GameState from 'src/game-state/GameState';

// Generic move interface
export interface GameMove {
  [key: string]: any;
}

// Interface that all games must implement
export interface Game {
  // Game metadata
  getGameType(): string;
  getMinPlayers(): number;
  getMaxPlayers(): number;

  // Game state management
  createInitialState(players: PlayerId[]): any;
  isValidMove(state: GameState, move: GameMove, playerId: PlayerId): boolean;
  applyMove(state: GameState, move: GameMove, playerId: PlayerId): GameState;

  // Game status
  checkGameOver(state: GameState): boolean;
  getWinners(state: GameState): PlayerId[];
  getLosers(state: GameState): PlayerId[];

  // Game turn management
  getNextPlayer(state: GameState, currentPlayer: PlayerId): PlayerId;
}
