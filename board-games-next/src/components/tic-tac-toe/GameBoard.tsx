import React, { useEffect, useState } from "react";
import { GameState, PlayerId, Table } from "@/types";
import { getGameState, pollGameState, updateGameState } from "@/lib/api";
import Board from "./Board";

interface GameBoardProps {
  table: Table;
  playerId: PlayerId;
}

const GameBoard: React.FC<GameBoardProps> = ({ table, playerId }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);

  // Start polling when component mounts
  useEffect(() => {
    if (!table.table_id) return;

    setIsLoading(true);

    // Initial fetch
    getGameState(table.table_id)
      .then((state) => {
        setGameState(state);
        setIsMyTurn(state.current_player === playerId);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });

    // Set up polling
    const { stop } = pollGameState(
      table.table_id,
      (state) => {
        setGameState(state);
        setIsMyTurn(state.current_player === playerId);
      },
      2000, // Poll every 2 seconds
      (err) => setError(err.message)
    );

    // Clean up polling when component unmounts
    return () => {
      stop();
    };
  }, [table.table_id, playerId]);

  // Handle making a move
  const handleMove = async (move: { board: string[][] }) => {
    if (!gameState || !isMyTurn) return;

    try {
      // Determine the next player (simple round-robin)
      const playerIndex = table.player_ids.indexOf(playerId);
      const nextPlayerIndex = (playerIndex + 1) % table.player_ids.length;
      const nextPlayer = table.player_ids[nextPlayerIndex];

      // Update the game state with the move and next player
      const updatedState = await updateGameState(table.table_id, playerId, {
        current_player: nextPlayer,
        game_specific_state: {
          ...gameState.game_specific_state,
          board: move.board,
        },
      });

      // Update local state
      setGameState(updatedState);
      setIsMyTurn(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An error occurred while making a move");
      }
    }
  };

  if (isLoading) {
    return <div>Loading game...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!gameState) {
    return <div>No game state available</div>;
  }

  return (
    <div>
      <h2>Tic Tac Toe Game</h2>

      {/* Game status */}
      <div className="game-status">
        {gameState.is_game_over ? (
          <div>
            {gameState.winning_players.includes(playerId)
              ? "You won!"
              : gameState.winning_players.length > 0
              ? `Player ${gameState.winning_players[0]} won!`
              : "Game ended in a draw"}
          </div>
        ) : (
          <div>
            {isMyTurn
              ? "Your turn"
              : `Waiting for ${gameState.current_player}'s move...`}
          </div>
        )}
      </div>

      {/* Game board */}
      <Board
        boardState={
          gameState.game_specific_state.board || [
            ["", "", ""],
            ["", "", ""],
            ["", "", ""],
          ]
        }
        onMove={handleMove}
        disabled={!isMyTurn || gameState.is_game_over}
        playerSymbol={playerId === table.player_ids[0] ? "X" : "O"}
      />

      {/* Players list */}
      <div className="players">
        <h3>Players</h3>
        <ul>
          {table.player_ids.map((id) => (
            <li key={id}>
              Player {id} {id === playerId && "(You)"}
              {id === gameState.current_player && " - Current Turn"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GameBoard;
