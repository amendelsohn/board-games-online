// Types
export type BoardState = Array<Array<string>>;

// Constants
export const INITIAL_BOARD_STATE: BoardState = [
  ["", "", ""],
  ["", "", ""],
  ["", "", ""],
];

// Game logic functions
export const calculateWinner = (board: BoardState): string | null => {
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
  const isDraw = board.every((row) => row.every((cell) => cell !== ""));
  if (isDraw) return "draw";

  return null;
};

// Create a new board with a move applied
export const applyMove = (
  board: BoardState,
  row: number,
  col: number,
  symbol: string
): BoardState => {
  return board.map((rowArray, r) =>
    rowArray.map((value, c) => {
      if (r === row && c === col) {
        return symbol;
      }
      return value;
    })
  );
};

// Check if a move is valid
export const isValidMove = (
  board: BoardState,
  row: number,
  col: number
): boolean => {
  // Check if position is within bounds
  if (row < 0 || row >= 3 || col < 0 || col >= 3) {
    return false;
  }

  // Check if the cell is empty
  return board[row][col] === "";
};
