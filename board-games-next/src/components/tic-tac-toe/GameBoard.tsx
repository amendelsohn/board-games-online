"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSession } from "@/lib/hooks/useGameSession";
import { getTable } from "@/lib/api";
import { TableStatus, GameState } from "@/types";
import Board from "./Board";
import ticTacToeLogic, {
  TicTacToeMove,
  TicTacToeState,
} from "@/lib/games/tic-tac-toe/game-logic";
import { INITIAL_BOARD_STATE } from "@/lib/games/tic-tac-toe/utils";

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
  const handleMove = (move: TicTacToeMove) => {
    if (!gameState || !isCurrentPlayerTurn || isUpdating || !table) return;

    // Debug information
    console.log("Making move:", {
      currentPlayerId,
      playerSymbol,
      move,
      gameSpecificState: (gameState.game_specific_state as unknown) as TicTacToeState,
    });

    // Validate the move using our game logic
    if (!ticTacToeLogic.validateMove(gameState, move, currentPlayerId)) {
      console.error("Invalid move - validation failed");

      // Additional debugging information
      const gameSpecificState = (gameState.game_specific_state as unknown) as TicTacToeState;
      console.error("Move validation details:", {
        isGameOver: gameState.is_game_over,
        isCurrentPlayer: gameState.current_player === currentPlayerId,
        oldBoard: gameSpecificState.board,
        newBoard: move.board,
        playerSymbols: gameSpecificState.player_symbols,
        currentPlayerSymbol:
          gameSpecificState.player_symbols?.[currentPlayerId],
        expectedSymbol: playerSymbol,
      });

      return;
    }

    // Determine the next player (using game logic)
    const nextPlayer = ticTacToeLogic.getNextPlayer(gameState, currentPlayerId);

    // Check for game over
    const isGameOver = ticTacToeLogic.checkGameOver({
      ...gameState,
      game_specific_state: {
        ...gameState.game_specific_state,
        board: move.board,
      },
    });

    // Prepare updates for the game state
    const updates: Partial<GameState> = {
      current_player: nextPlayer,
      is_game_over: isGameOver,
      game_specific_state: {
        ...gameState.game_specific_state,
        board: move.board,
      },
    };

    // Add winning players if there's a winner
    if (isGameOver) {
      const gameStateWithMove = {
        ...gameState,
        game_specific_state: {
          ...gameState.game_specific_state,
          board: move.board,
        },
      };

      // Let the server determine winners and losers
      // This is just a client-side prediction
      const gameSpecificState = (gameStateWithMove.game_specific_state as unknown) as TicTacToeState;
      const playerSymbols = gameSpecificState.player_symbols || {};

      // Find the winner based on the symbol
      for (const [playerId, symbol] of Object.entries(playerSymbols)) {
        if (symbol === "X" && table.player_ids[0] === playerId) {
          updates.winning_players = [playerId];
          break;
        } else if (symbol === "O" && table.player_ids[1] === playerId) {
          updates.winning_players = [playerId];
          break;
        }
      }
    }

    // Update the game state
    updateGameState(updates);
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

  // Determine player symbol from game state
  const gameSpecificState = (gameState?.game_specific_state as unknown) as TicTacToeState;
  const playerSymbol =
    gameSpecificState?.player_symbols?.[currentPlayerId] ||
    // Fallback to index-based assignment if not available in game state
    (table?.player_ids.indexOf(currentPlayerId) === 0 ? "X" : "O");

  // Get game status from our game logic
  const gameStatus = ticTacToeLogic.getGameStatus(gameState, currentPlayerId);

  return (
    <div>
      <h2>Tic Tac Toe Game</h2>

      {/* Game status */}
      <div className="game-status">{gameStatus}</div>

      {/* Game board */}
      <Board
        boardState={
          ((gameState.game_specific_state as unknown) as TicTacToeState)
            .board || INITIAL_BOARD_STATE
        }
        onMove={handleMove}
        disabled={!isCurrentPlayerTurn || gameState.is_game_over}
        playerSymbol={playerSymbol}
      />
    </div>
  );
}
