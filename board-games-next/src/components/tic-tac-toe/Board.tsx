"use client";

import { useState } from "react";
import Square from "./Square";
import styles from "./Board.module.css";

type BoardState = Array<Array<string>>;

interface BoardProps {
  boardState?: BoardState;
  onMove?: (move: { board: BoardState }) => void;
  disabled?: boolean;
  playerSymbol?: string;
}

export default function Board({
  boardState: externalBoardState,
  onMove,
  disabled = false,
  playerSymbol = "X",
}: BoardProps) {
  const initialState: BoardState = [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ];

  // Use external board state if provided, otherwise use local state
  const [localBoardState, setLocalBoardState] = useState<BoardState>(
    initialState
  );
  const [isXNext, setIsXNext] = useState<boolean>(true);

  // Determine which board state to use
  const boardState = externalBoardState || localBoardState;

  const handleClick = (row: number, col: number) => {
    // If square already filled or game is disabled, do nothing
    if (boardState[row][col] || disabled) return;

    const newBoardState = boardState.map((rowArray, r) =>
      rowArray.map((value, c) => {
        if (r === row && c === col) {
          return onMove ? playerSymbol : isXNext ? "X" : "O";
        }
        return value;
      })
    );

    if (onMove) {
      // If we have an external handler, use it
      onMove({ board: newBoardState });
    } else {
      // Otherwise use local state
      setLocalBoardState(newBoardState);
      setIsXNext(!isXNext);
    }
  };

  const resetGame = () => {
    if (!onMove) {
      setLocalBoardState(initialState);
      setIsXNext(true);
    }
  };

  // Calculate winner
  const calculateWinner = (board: BoardState): string | null => {
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

  const winner = calculateWinner(boardState);
  let status;

  if (winner === "draw") {
    status = "Game ended in a draw!";
  } else if (winner) {
    status = `Winner: ${winner}`;
  } else {
    status = onMove
      ? disabled
        ? "Waiting for your turn..."
        : "Your turn"
      : `Next player: ${isXNext ? "X" : "O"}`;
  }

  return (
    <div className={styles.gameContainer}>
      {!onMove && <div className={styles.status}>{status}</div>}
      <div className={styles.board}>
        {boardState.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className={styles.boardRow}>
            {row.map((value, colIndex) => (
              <Square
                key={`square-${rowIndex}-${colIndex}`}
                value={value}
                onClick={() => handleClick(rowIndex, colIndex)}
              />
            ))}
          </div>
        ))}
      </div>
      {!onMove && (
        <button className={styles.resetButton} onClick={resetGame}>
          Reset Game
        </button>
      )}
    </div>
  );
}
