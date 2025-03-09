"use client";

import { useState } from "react";
import Square from "./Square";
import {
  BoardState,
  INITIAL_BOARD_STATE,
  calculateWinner,
  applyMove,
} from "@/lib/games/tic-tac-toe/utils";
import { TicTacToeMove } from "@/lib/games/tic-tac-toe/game-logic";

interface BoardProps {
  boardState?: BoardState;
  onMove?: (move: TicTacToeMove) => void;
  disabled?: boolean;
  playerSymbol?: string;
}

export default function Board({
  boardState: externalBoardState,
  onMove,
  disabled = false,
  playerSymbol = "X",
}: BoardProps) {
  // Use external board state if provided, otherwise use local state
  const [localBoardState, setLocalBoardState] = useState<BoardState>(
    INITIAL_BOARD_STATE
  );
  const [isXNext, setIsXNext] = useState<boolean>(true);

  // Determine which board state to use
  const boardState = externalBoardState || localBoardState;

  const handleClick = (row: number, col: number) => {
    // If square already filled or game is disabled, do nothing
    if (boardState[row][col] || disabled) return;

    // Create new board with the move applied
    const newBoardState = applyMove(
      boardState,
      row,
      col,
      onMove ? playerSymbol : isXNext ? "X" : "O"
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
      setLocalBoardState(INITIAL_BOARD_STATE);
      setIsXNext(true);
    }
  };

  // Calculate winner using our utility function
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
    <div className="flex flex-col items-center my-8">
      {!onMove && (
        <div className="badge badge-lg badge-primary mb-4 text-lg p-4">
          {status}
        </div>
      )}

      <div className="grid grid-rows-3 gap-0 mb-6">
        {boardState.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex">
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
        <button className="btn btn-primary mt-4" onClick={resetGame}>
          Reset Game
        </button>
      )}
    </div>
  );
}
