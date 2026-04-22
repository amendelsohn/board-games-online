import { Injectable } from '@nestjs/common';
import { Game, GameMove } from '../game-interface';
import { PlayerId } from 'src/player/Player';
import GameState from 'src/game-state/GameState';
import ConnectFourGameState, { initial_state, BOARD_ROWS, BOARD_COLS } from './ConnectFourState';

export interface ConnectFourMove extends GameMove {
  column: number;
}

@Injectable()
export class ConnectFourService implements Game {
  getGameType(): string {
    return 'connect-four';
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
        `Connect Four requires exactly 2 players, but got ${
          players.length
        } players: ${JSON.stringify(players)}`,
      );
    }

    // Create player symbol mapping - first player gets red, second gets yellow
    const player_symbols: Record<PlayerId, string> = {
      [players[0]]: 'R',
      [players[1]]: 'Y',
    };

    return {
      board: JSON.parse(JSON.stringify(initial_state)), // Deep copy
      player_symbols,
    };
  }

  isValidMove(state: GameState, move: GameMove, playerId: PlayerId): boolean {
    const connectFourState = state as ConnectFourGameState;
    const connectFourMove = move as ConnectFourMove;

    // Check if game is already over
    if (state.is_game_over) return false;

    // Check if it's this player's turn
    if (state.current_player !== playerId) return false;

    // Validate column number
    const column = connectFourMove.column;
    if (column < 0 || column >= BOARD_COLS) return false;

    // Check if column has space (top row is empty)
    const board = connectFourState.game_specific_state.board;
    return board[0][column] === '';
  }

  applyMove(state: GameState, move: GameMove, playerId: PlayerId): GameState {
    const connectFourState = state as ConnectFourGameState;
    const connectFourMove = move as ConnectFourMove;
    const newState = { ...state };

    const board = JSON.parse(JSON.stringify(connectFourState.game_specific_state.board));
    const column = connectFourMove.column;
    const playerSymbol = connectFourState.game_specific_state.player_symbols[playerId];

    // Find the lowest empty row in the column
    let targetRow = -1;
    for (let row = BOARD_ROWS - 1; row >= 0; row--) {
      if (board[row][column] === '') {
        targetRow = row;
        break;
      }
    }

    // Place the piece
    if (targetRow !== -1) {
      board[targetRow][column] = playerSymbol;
    }

    // Update state
    newState.game_specific_state = {
      ...newState.game_specific_state,
      board,
      last_move: {
        column,
        row: targetRow,
        player: playerId,
      },
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
    const connectFourState = state as ConnectFourGameState;
    const board = connectFourState.game_specific_state.board;

    // Check if there's a winner
    if (this.calculateWinner(board) !== null) {
      return true;
    }

    // Check if board is full (draw)
    return board[0].every(cell => cell !== '');
  }

  getWinners(state: GameState): PlayerId[] {
    const connectFourState = state as ConnectFourGameState;
    const board = connectFourState.game_specific_state.board;
    const player_symbols = connectFourState.game_specific_state.player_symbols;

    const winningSymbol = this.calculateWinner(board);

    // If it's a draw or no winner yet
    if (winningSymbol === null || winningSymbol === 'draw') {
      return [];
    }

    // Find player with winning symbol
    for (const [playerId, symbol] of Object.entries(player_symbols)) {
      if (symbol === winningSymbol) {
        return [playerId];
      }
    }

    return [];
  }

  getLosers(state: GameState): PlayerId[] {
    const connectFourState = state as ConnectFourGameState;
    const winners = this.getWinners(state);
    const board = connectFourState.game_specific_state.board;
    const player_symbols = connectFourState.game_specific_state.player_symbols;

    // If no winner (draw or game in progress), no losers
    if (winners.length === 0 && !this.checkGameOver(state)) {
      return [];
    }

    // In case of a draw
    if (winners.length === 0 && this.calculateWinner(board) === 'draw') {
      return [];
    }

    // If there's a winner, everyone else is a loser
    return Object.keys(player_symbols).filter(
      playerId => !winners.includes(playerId),
    );
  }

  getNextPlayer(state: GameState, currentPlayer: PlayerId): PlayerId {
    const connectFourState = state as ConnectFourGameState;
    const players = Object.keys(
      connectFourState.game_specific_state.player_symbols,
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
    // Check horizontal wins
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col <= BOARD_COLS - 4; col++) {
        const piece = board[row][col];
        if (piece !== '' && 
            piece === board[row][col + 1] &&
            piece === board[row][col + 2] &&
            piece === board[row][col + 3]) {
          return piece;
        }
      }
    }

    // Check vertical wins
    for (let col = 0; col < BOARD_COLS; col++) {
      for (let row = 0; row <= BOARD_ROWS - 4; row++) {
        const piece = board[row][col];
        if (piece !== '' && 
            piece === board[row + 1][col] &&
            piece === board[row + 2][col] &&
            piece === board[row + 3][col]) {
          return piece;
        }
      }
    }

    // Check diagonal wins (top-left to bottom-right)
    for (let row = 0; row <= BOARD_ROWS - 4; row++) {
      for (let col = 0; col <= BOARD_COLS - 4; col++) {
        const piece = board[row][col];
        if (piece !== '' && 
            piece === board[row + 1][col + 1] &&
            piece === board[row + 2][col + 2] &&
            piece === board[row + 3][col + 3]) {
          return piece;
        }
      }
    }

    // Check diagonal wins (top-right to bottom-left)
    for (let row = 0; row <= BOARD_ROWS - 4; row++) {
      for (let col = 3; col < BOARD_COLS; col++) {
        const piece = board[row][col];
        if (piece !== '' && 
            piece === board[row + 1][col - 1] &&
            piece === board[row + 2][col - 2] &&
            piece === board[row + 3][col - 3]) {
          return piece;
        }
      }
    }

    // Check for draw (top row is full)
    const isDraw = board[0].every(cell => cell !== '');
    if (isDraw) return 'draw';

    return null;
  }
}