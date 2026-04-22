import { Injectable } from '@nestjs/common';
import { Game, GameMove } from '../game-interface';
import { PlayerId } from 'src/player/Player';
import GameState from 'src/game-state/GameState';
import TicTacToeGameState, { initial_state } from './TicTacToeState';

export interface TicTacToeMove extends GameMove {
  board: string[][];
}

@Injectable()
export class TicTacToeService implements Game {
  getGameType(): string {
    return 'tic-tac-toe';
  }

  getMinPlayers(): number {
    return 2;
  }

  getMaxPlayers(): number {
    return 2;
  }

  createInitialState(players: PlayerId[]): any {
    // Validate player count
    if (players.length !== 2) {
      throw new Error(
        `Tic-tac-toe requires exactly 2 players, but got ${
          players.length
        } players: ${JSON.stringify(players)}`,
      );
    }

    // Create player symbol mapping using a plain object instead of Map for better JSON serialization
    const player_symbols: Record<PlayerId, string> = {
      [players[0]]: 'X',
      [players[1]]: 'O',
    };

    return {
      board: JSON.parse(JSON.stringify(initial_state)), // Deep copy to avoid reference issues
      player_symbols,
    };
  }

  isValidMove(state: GameState, move: GameMove, playerId: PlayerId): boolean {
    const ticTacToeState = state as TicTacToeGameState;
    const ticTacToeMove = move as TicTacToeMove;

    // Check if game is already over
    if (state.is_game_over) return false;

    // Check if it's this player's turn
    if (state.current_player !== playerId) return false;

    // Validate the board - just a basic check that only one cell changed
    const oldBoard = ticTacToeState.game_specific_state.board;
    const newBoard = ticTacToeMove.board;

    // Check dimensions
    if (newBoard.length !== 3 || !newBoard.every(row => row.length === 3)) {
      return false;
    }

    // Count differences
    let differences = 0;
    let playerMadeValidMove = false;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (oldBoard[i][j] !== newBoard[i][j]) {
          differences++;

          // Check that the cell was empty and now contains player's symbol
          const playerSymbol =
            ticTacToeState.game_specific_state.player_symbols[playerId];
          if (oldBoard[i][j] === '' && newBoard[i][j] === playerSymbol) {
            playerMadeValidMove = true;
          } else {
            return false; // Invalid change
          }
        }
      }
    }

    return differences === 1 && playerMadeValidMove;
  }

  applyMove(state: GameState, move: GameMove, playerId: PlayerId): GameState {
    const ticTacToeMove = move as TicTacToeMove;
    const newState = { ...state };

    // Update board
    newState.game_specific_state = {
      ...newState.game_specific_state,
      board: ticTacToeMove.board,
    };

    // Check if game is over
    newState.is_game_over = this.checkGameOver(newState);

    // Update winners/losers if game is over
    if (newState.is_game_over) {
      newState.winning_players = this.getWinners(newState);
      newState.losing_players = this.getLosers(newState);
    }

    // Update current player
    newState.current_player = this.getNextPlayer(newState, playerId);

    return newState;
  }

  checkGameOver(state: GameState): boolean {
    const ticTacToeState = state as TicTacToeGameState;
    const board = ticTacToeState.game_specific_state.board;

    // Check for winner
    if (this.calculateWinner(board) !== null) {
      return true;
    }

    // Check for draw (all squares filled)
    return board.every(row => row.every(cell => cell !== ''));
  }

  getWinners(state: GameState): PlayerId[] {
    const ticTacToeState = state as TicTacToeGameState;
    const board = ticTacToeState.game_specific_state.board;
    const player_symbols = ticTacToeState.game_specific_state.player_symbols;

    const winningSymbol = this.calculateWinner(board);

    // If it's a draw or no winner yet
    if (winningSymbol === null || winningSymbol === 'draw') {
      return [];
    }

    // Find player with winning symbol (now using object entries)
    for (const [playerId, symbol] of Object.entries(player_symbols)) {
      if (symbol === winningSymbol) {
        return [playerId];
      }
    }

    return [];
  }

  getLosers(state: GameState): PlayerId[] {
    const ticTacToeState = state as TicTacToeGameState;
    const winners = this.getWinners(state);
    const board = ticTacToeState.game_specific_state.board;
    const player_symbols = ticTacToeState.game_specific_state.player_symbols;

    // If no winner (draw or game in progress), no losers
    if (winners.length === 0 && !this.checkGameOver(state)) {
      return [];
    }

    // In case of a draw
    if (winners.length === 0 && this.calculateWinner(board) === 'draw') {
      return [];
    }

    // In tic-tac-toe, if there's a winner, everyone else is a loser
    return Object.keys(player_symbols).filter(
      playerId => !winners.includes(playerId),
    );
  }

  getNextPlayer(state: GameState, currentPlayer: PlayerId): PlayerId {
    const ticTacToeState = state as TicTacToeGameState;
    const players = Object.keys(
      ticTacToeState.game_specific_state.player_symbols,
    );

    // If game is over, no next player
    if (state.is_game_over) {
      return currentPlayer;
    }

    // Simple round-robin for 2 players
    const currentIndex = players.indexOf(currentPlayer);
    return players[(currentIndex + 1) % players.length];
  }

  // Helper method to calculate winner
  private calculateWinner(board: string[][]): string | null {
    const lines = [
      [
        [0, 0],
        [0, 1],
        [0, 2],
      ], // rows
      [
        [1, 0],
        [1, 1],
        [1, 2],
      ],
      [
        [2, 0],
        [2, 1],
        [2, 2],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ], // columns
      [
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 2],
        [1, 2],
        [2, 2],
      ],
      [
        [0, 0],
        [1, 1],
        [2, 2],
      ], // diagonals
      [
        [0, 2],
        [1, 1],
        [2, 0],
      ],
    ];

    for (const line of lines) {
      const [[a1, a2], [b1, b2], [c1, c2]] = line;
      if (
        board[a1][a2] &&
        board[a1][a2] === board[b1][b2] &&
        board[a1][a2] === board[c1][c2]
      ) {
        return board[a1][a2];
      }
    }

    // Check for draw (all squares filled)
    const isDraw = board.every(row => row.every(cell => cell !== ''));
    if (isDraw) return 'draw';

    return null;
  }
}
