import { GameState } from "@/types";
import { GameLogic, gameRegistry } from "../game-interface";
import {
  BoardState,
  INITIAL_BOARD_STATE,
  calculateWinner,
  isValidMove,
} from "./utils";

// Define the move type for tic-tac-toe
export interface TicTacToeMove {
  board: BoardState;
}

// Define the game-specific state for tic-tac-toe
export interface TicTacToeState {
  board: BoardState;
  player_symbols: Record<string, string>;
}

// Implement the tic-tac-toe game logic
class TicTacToeLogic implements GameLogic<TicTacToeMove, TicTacToeState> {
  getGameType(): string {
    return "tic-tac-toe";
  }

  getInitialState(): TicTacToeState {
    return {
      board: INITIAL_BOARD_STATE,
      player_symbols: {},
    };
  }

  validateMove(
    state: GameState,
    move: TicTacToeMove,
    playerId: string
  ): boolean {
    // Game must not be over
    if (state.is_game_over) return false;

    // Must be player's turn
    if (state.current_player !== playerId) return false;

    const gameState = (state.game_specific_state as unknown) as TicTacToeState;
    const oldBoard = gameState.board;
    const newBoard = move.board;

    // Check dimensions
    if (newBoard.length !== 3 || !newBoard.every((row) => row.length === 3)) {
      return false;
    }

    // Count differences and validate them
    let differences = 0;
    let validMoveFound = false;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (oldBoard[i][j] !== newBoard[i][j]) {
          differences++;

          // The cell must have been empty before
          if (oldBoard[i][j] !== "") {
            return false;
          }

          // The new value must be the player's symbol
          const playerSymbol = gameState.player_symbols[playerId];
          if (newBoard[i][j] === playerSymbol) {
            validMoveFound = true;
          } else {
            return false;
          }
        }
      }
    }

    // Exactly one cell must have changed
    return differences === 1 && validMoveFound;
  }

  checkGameOver(state: GameState): boolean {
    const gameState = (state.game_specific_state as unknown) as TicTacToeState;
    const winner = calculateWinner(gameState.board);
    return winner !== null;
  }

  getGameStatus(state: GameState, currentPlayerId: string): string {
    if (!state.is_game_over) {
      return state.current_player === currentPlayerId
        ? "Your turn"
        : `Waiting for ${state.current_player}'s move...`;
    }

    if (state.winning_players.includes(currentPlayerId)) {
      return "You won!";
    } else if (state.winning_players.length > 0) {
      return `Player ${state.winning_players[0]} won!`;
    } else {
      return "Game ended in a draw";
    }
  }

  getNextPlayer(state: GameState, currentPlayerId: string): string {
    // If game is over, no next player
    if (state.is_game_over) {
      return currentPlayerId;
    }

    // Get all players from the game state
    const gameState = (state.game_specific_state as unknown) as TicTacToeState;
    const players = Object.keys(gameState.player_symbols || {});

    // If we don't have player info, return the current player
    if (players.length < 2) {
      return currentPlayerId;
    }

    // Simple round-robin for 2 players
    const currentIndex = players.indexOf(currentPlayerId);
    return players[(currentIndex + 1) % players.length];
  }
}

// Create and register the tic-tac-toe game logic
const ticTacToeLogic = new TicTacToeLogic();
gameRegistry.registerGame(ticTacToeLogic);

export default ticTacToeLogic;
