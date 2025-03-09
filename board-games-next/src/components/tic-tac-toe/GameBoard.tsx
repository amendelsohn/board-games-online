"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSession } from "@/lib/hooks/useGameSession";
import { getTable } from "@/lib/api";
import { TableStatus, GameState, Table } from "@/types";
import Board from "./Board";

interface GameBoardProps {
  tableId: string;
}

export default function GameBoard({ tableId }: GameBoardProps) {
  const router = useRouter();
  const [isCheckingTable, setIsCheckingTable] = useState(false);

  // Use our custom hook for game state management
  const {
    gameState,
    updateGameState,
    currentPlayerId,
    isCurrentPlayerTurn,
    isLoading,
    isUpdating,
    isError,
    error,
    table,
    player,
    isGameStateMissing,
  } = useGameSession(tableId, {
    pollingInterval: 2000,
    onGameStateUpdate: (newState) => {
      console.log("Game state updated:", newState);
    },
    // Don't try to auto-initialize as it will be rejected by the server
    autoInitialize: false,
  });

  // Redirect if the game is over or if there's a table but it's not in the PLAYING state
  useEffect(() => {
    if (table && table.status !== TableStatus.PLAYING) {
      router.push(`/lobby/${table.join_code}`);
    }
  }, [table, router]);

  // Check table status directly if game state is missing
  useEffect(() => {
    if (isGameStateMissing && tableId && !isCheckingTable) {
      const checkTableStatus = async () => {
        setIsCheckingTable(true);
        try {
          // Fetch the latest table data directly from the server
          const freshTableData = await getTable(tableId);

          // If the table is in WAITING status, redirect to the lobby
          if (freshTableData.status === TableStatus.WAITING) {
            console.log(
              "Table is still in waiting state, redirecting to lobby"
            );
            router.push(`/lobby/${freshTableData.join_code}`);
          }
        } catch (err) {
          console.error("Error checking table status:", err);
        } finally {
          setIsCheckingTable(false);
        }
      };

      checkTableStatus();
    }
  }, [isGameStateMissing, tableId, router, isCheckingTable]);

  // Handle making a move
  const handleMove = (move: { board: string[][] }) => {
    if (!gameState || !isCurrentPlayerTurn || isUpdating || !table) return;

    // Determine the next player (simple round-robin)
    if (!table.player_ids.length) return;

    const playerIndex = table.player_ids.indexOf(currentPlayerId);
    const nextPlayerIndex = (playerIndex + 1) % table.player_ids.length;
    const nextPlayer = table.player_ids[nextPlayerIndex];

    // Check for winner or draw
    const winner = calculateWinner(move.board);
    const isGameOver = winner !== null;

    // Prepare updates for the game state with proper typing
    const updates: Partial<GameState> = {
      current_player: nextPlayer,
      is_game_over: isGameOver,
      game_specific_state: {
        ...gameState.game_specific_state,
        board: move.board,
      },
    };

    // Add winning players if there's a winner
    if (winner && winner !== "draw" && table.player_ids.length >= 2) {
      const winnerSymbol = winner; // 'X' or 'O'
      const winnerIndex = winnerSymbol === "X" ? 0 : 1;

      if (table.player_ids[winnerIndex]) {
        updates.winning_players = [table.player_ids[winnerIndex]];
      }
    }

    // Update the game state
    updateGameState(updates);
  };

  // Calculate winner
  const calculateWinner = (board: string[][]): string | null => {
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

  // Loading state
  if (isLoading || isCheckingTable) {
    return <div>Loading game...</div>;
  }

  // Handle the specific case where game state doesn't exist yet
  if (isGameStateMissing) {
    const isHost = table && table.host_player_id === currentPlayerId;

    return (
      <div className="game-waiting">
        <h2>Tic Tac Toe Game</h2>
        <div className="waiting-message">
          <h3>Game Not Started Yet</h3>

          {isHost ? (
            <div>
              <p>
                You are the host! Please return to the lobby and click "Start
                Game" to begin.
              </p>
              <button onClick={() => router.push(`/lobby/${table?.join_code}`)}>
                Return to Lobby
              </button>
            </div>
          ) : (
            <p>Waiting for the host to start the game. Please wait...</p>
          )}

          <p>
            <small>
              Note: Game state is only created when the host starts the game
              from the lobby.
            </small>
          </p>
        </div>
      </div>
    );
  }

  // General error state
  if (isError) {
    return <div>Error: {error?.message || "Failed to load game state"}</div>;
  }

  // Missing state (should rarely happen with our new handling)
  if (!gameState) {
    return <div>Initializing game state...</div>;
  }

  // Determine player symbol (first player is X, second is O)
  const playerIndex = table?.player_ids.indexOf(currentPlayerId) || 0;
  const playerSymbol = playerIndex === 0 ? "X" : "O";

  return (
    <div>
      <h2>Tic Tac Toe Game</h2>

      {/* Game status */}
      <div className="game-status">
        {gameState.is_game_over ? (
          <div>
            {gameState.winning_players.includes(currentPlayerId)
              ? "You won!"
              : gameState.winning_players.length > 0
              ? `Player ${gameState.winning_players[0]} won!`
              : "Game ended in a draw"}
          </div>
        ) : (
          <div>
            {isCurrentPlayerTurn
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
        disabled={!isCurrentPlayerTurn || gameState.is_game_over}
        playerSymbol={playerSymbol}
      />
    </div>
  );
}
