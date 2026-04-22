import { BOARD_ROWS, BOARD_COLS, Board } from './game-logic';

export const INITIAL_BOARD_STATE: Board = Array(BOARD_ROWS)
  .fill(null)
  .map(() => Array(BOARD_COLS).fill(''));

export const getPlayerSymbol = (playerId: string, playerSymbols: Record<string, string>): string => {
  return playerSymbols[playerId] || '';
};

export const getPlayerName = (symbol: string): string => {
  switch (symbol) {
    case 'R':
      return 'Red';
    case 'Y':
      return 'Yellow';
    default:
      return 'Unknown';
  }
};

export const getPlayerColor = (symbol: string): string => {
  switch (symbol) {
    case 'R':
      return 'text-red-500';
    case 'Y':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
};

export const getPieceColor = (symbol: string): string => {
  switch (symbol) {
    case 'R':
      return 'bg-red-500';
    case 'Y':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-200';
  }
};

export const canDropInColumn = (board: Board, column: number): boolean => {
  if (column < 0 || column >= BOARD_COLS) return false;
  return board[0][column] === '';
};

export const getDropPosition = (board: Board, column: number): number => {
  for (let row = BOARD_ROWS - 1; row >= 0; row--) {
    if (board[row][column] === '') {
      return row;
    }
  }
  return -1;
};