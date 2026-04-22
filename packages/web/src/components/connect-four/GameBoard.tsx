"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSession } from "@/lib/hooks/useGameSession";
import { getTable, resetGame, makeMove } from "@/lib/api";
import { TableStatus } from "@/types";
import Board from "./Board";
import connectFourLogic, {
  ConnectFourMove,
  ConnectFourState,
} from "@/lib/games/connect-four/game-logic";

interface GameBoardProps {
  tableId: string;
}

export default function GameBoard({ tableId }: GameBoardProps) {
  const router = useRouter();
  const [isCheckingTable, setIsCheckingTable] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
      console.log("Connect Four game state updated:", newState);
    },
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
          const freshTableData = await getTable(tableId);

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
  const handleMove = (move: ConnectFourMove) => {
    if (!gameState || !currentPlayerId || isUpdating) {
      console.log("Cannot make move: invalid state");
      return;
    }

    console.log("Making Connect Four move:", move);

    // Validate move client-side first
    const connectFourState = gameState as unknown as ConnectFourState;
    if (!connectFourLogic.isValidMove(connectFourState, move, currentPlayerId)) {
      console.log("Invalid move attempted");
      return;
    }

    // Apply move optimistically on client
    const newState = connectFourLogic.makeMove(connectFourState, move, currentPlayerId);
    
    // Check if game is over after this move
    const isGameOver = connectFourLogic.isGameOver(newState);
    const winner = connectFourLogic.checkWinner(newState);
    
    // Determine next player (if game not over)
    const players = Object.keys(newState.game_specific_state.player_symbols);
    const currentPlayerIndex = players.indexOf(currentPlayerId);
    const nextPlayer = isGameOver ? currentPlayerId : players[(currentPlayerIndex + 1) % players.length];

    // Update the complete game state
    const updatedGameState = {
      ...newState,
      current_player: nextPlayer,
      is_game_over: isGameOver,
      winning_players: winner && winner !== 'draw' ? [currentPlayerId] : [],
      losing_players: winner && winner !== 'draw' ? 
        Object.keys(newState.game_specific_state.player_symbols).filter(id => id !== currentPlayerId) : [],
    };

    // Send the updated board state to the server
    updateGameState({
      current_player: nextPlayer,
      game_specific_state: {
        ...updatedGameState.game_specific_state,
        gameType: 'connect-four',
      },
      is_game_over: updatedGameState.is_game_over,
      winning_players: updatedGameState.winning_players,
      losing_players: updatedGameState.losing_players,
    });
  };

  // Handle play again functionality
  const handlePlayAgain = async () => {
    if (!currentPlayerId) return;
    
    setIsResetting(true);
    try {
      console.log("Resetting game for table:", tableId);
      await resetGame(tableId, currentPlayerId);
      // The game state will be updated via polling
    } catch (error) {
      console.error("Failed to reset game:", error);
      // You could show an error message here
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
        <span className="ml-3">Loading Connect Four game...</span>
      </div>
    );
  }

  if (isError || !gameState || !currentPlayerId) {
    return (
      <div className="alert alert-error max-w-lg mx-auto shadow-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <h3 className="font-bold">Game Error</h3>
          <div className="text-xs">{error?.message || "Failed to load game"}</div>
        </div>
      </div>
    );
  }

  const connectFourState = gameState as unknown as ConnectFourState;
  const isHost = Boolean(table && table.host_player_id === currentPlayerId);

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">Connect Four</h1>
        {player && (
          <p className="text-gray-600">Playing as {player.name}</p>
        )}
      </div>

      <Board
        gameState={connectFourState}
        currentPlayerId={currentPlayerId}
        isCurrentPlayerTurn={isCurrentPlayerTurn}
        onMove={handleMove}
        onPlayAgain={handlePlayAgain}
        disabled={isUpdating}
        isResetting={isResetting}
        isHost={isHost}
      />

      {isUpdating && (
        <div className="flex justify-center items-center mt-4">
          <span className="loading loading-spinner loading-sm"></span>
          <span className="ml-2 text-sm text-gray-600">Making move...</span>
        </div>
      )}
    </div>
  );
}