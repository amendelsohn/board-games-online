import { GameState as BaseGameState } from "@/types";

export const BOARD_ROWS = 6;
export const BOARD_COLS = 7;

export type Cell = string; // Empty string, 'R' for red, 'Y' for yellow
export type Row = Cell[];
export type Board = Row[];

export interface ConnectFourMove {
  column: number;
}

export interface ConnectFourSpecificState {
  gameType: string;
  board: Board;
  player_symbols: Record<string, string>; // Maps player ID to 'R' or 'Y'
  last_move?: {
    column: number;
    row: number;
    player: string;
  };
}

export interface ConnectFourState extends BaseGameState {
  game_specific_state: ConnectFourSpecificState;
}

class ConnectFourLogic {
  isValidMove(state: ConnectFourState, move: ConnectFourMove, playerId: string): boolean {
    // Check if game is over
    if (state.is_game_over) return false;

    // Check if it's this player's turn
    if (state.current_player !== playerId) return false;

    // Validate column number
    const column = move.column;
    if (column < 0 || column >= BOARD_COLS) return false;

    // Check if column has space (top row is empty)
    const board = state.game_specific_state.board;
    return board[0][column] === '';
  }

  makeMove(state: ConnectFourState, move: ConnectFourMove, playerId: string): ConnectFourState {
    const newState = { ...state };
    const board = state.game_specific_state.board.map(row => [...row]);
    const column = move.column;
    const playerSymbol = state.game_specific_state.player_symbols[playerId];

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

    return newState;
  }

  checkWinner(state: ConnectFourState): string | null {
    const board = state.game_specific_state.board;
    
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

    return null;
  }

  isGameOver(state: ConnectFourState): boolean {
    // Check if there's a winner
    if (this.checkWinner(state) !== null) {
      return true;
    }

    // Check if board is full (draw)
    return state.game_specific_state.board[0].every(cell => cell !== '');
  }

  isDraw(state: ConnectFourState): boolean {
    return this.isGameOver(state) && this.checkWinner(state) === null;
  }

  getValidMoves(state: ConnectFourState): ConnectFourMove[] {
    if (state.is_game_over) return [];

    const validMoves: ConnectFourMove[] = [];
    const board = state.game_specific_state.board;

    for (let col = 0; col < BOARD_COLS; col++) {
      // If top row of column is empty, it's a valid move
      if (board[0][col] === '') {
        validMoves.push({ column: col });
      }
    }

    return validMoves;
  }
}

const connectFourLogic = new ConnectFourLogic();
export default connectFourLogic;