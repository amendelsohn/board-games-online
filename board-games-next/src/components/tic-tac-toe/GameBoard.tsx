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
    return (
      <div className="flex justify-center items-center py-12">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
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
    return (
      <div className="alert alert-error max-w-lg mx-auto">
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
        <span>Error: {error?.message || "Failed to load game"}</span>
      </div>
    );
  }

  // Missing state (should rarely happen with our new handling)
  if (!gameState) {
    return (
      <div className="flex justify-center items-center flex-col py-12">
        <div className="loading loading-spinner loading-lg text-primary mb-4"></div>
        <div className="text-xl font-medium">Waiting for game to start...</div>
      </div>
    );
  }

  // Determine player symbol from game state
  const gameSpecificState = (gameState.game_specific_state as unknown) as TicTacToeState;
  const board = gameSpecificState?.board || INITIAL_BOARD_STATE;
  const playerSymbol =
    gameSpecificState?.player_symbols?.[currentPlayerId] ||
    (currentPlayerId === table?.host_player_id ? "X" : "O");
  const opponentSymbol = playerSymbol === "X" ? "O" : "X";

  // Get game status from our game logic
  const gameStatus = ticTacToeLogic.getGameStatus(gameState, currentPlayerId);

  return (
    <div className="flex flex-col items-center p-4">
      <div className="badge badge-lg p-3 mb-6">{gameStatus}</div>

      {/* Game board */}
      <Board
        boardState={board}
        onMove={handleMove}
        disabled={!isCurrentPlayerTurn || gameState.is_game_over}
        playerSymbol={playerSymbol}
      />

      {/* Player info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg mt-4">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="flex items-center">
              <div className="avatar placeholder mr-2">
                <div className="bg-primary text-primary-content rounded-full w-8">
                  <span>{playerSymbol}</span>
                </div>
              </div>
              <div>
                <p className="font-medium">You</p>
                {isCurrentPlayerTurn && !gameState.is_game_over && (
                  <span className="badge badge-success badge-sm">
                    Your turn
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="flex items-center">
              <div className="avatar placeholder mr-2">
                <div className="bg-neutral text-neutral-content rounded-full w-8">
                  <span>{opponentSymbol}</span>
                </div>
              </div>
              <div>
                <p className="font-medium">Opponent</p>
                {!isCurrentPlayerTurn && !gameState.is_game_over && (
                  <span className="badge badge-info badge-sm">Their turn</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game result */}
      {gameState.is_game_over && (
        <div className="mt-6 card bg-base-100 shadow-lg">
          <div className="card-body items-center text-center">
            <h2 className="card-title">Game Over</h2>
            <div className="card-actions">
              <button
                onClick={() => router.push(`/lobby/${table?.join_code}`)}
                className="btn btn-primary"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
