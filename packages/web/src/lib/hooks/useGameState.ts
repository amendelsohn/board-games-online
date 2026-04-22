"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGameState, updateGameState } from "@/lib/api";
import { GameState, PlayerId } from "@/types";
import { useCallback, useEffect, useState, useRef } from "react";

interface UseGameStateOptions {
  pollingInterval?: number;
  onGameStateUpdate?: (gameState: GameState) => void;
  enabled?: boolean;
  autoInitialize?: boolean; // Kept for backwards compatibility but not used
  gameType?: string;
  playerIds?: PlayerId[];
}

/**
 * Custom hook for managing game state
 *
 * @param tableId - The ID of the table to get game state for
 * @param currentPlayerId - The ID of the current player
 * @param options - Additional options for the hook
 * @returns An object containing the current game state, a function to update the game state, and the current player ID
 */
export function useGameState(
  tableId: string,
  currentPlayerId: PlayerId,
  options: UseGameStateOptions = {}
) {
  const {
    pollingInterval = 2000,
    onGameStateUpdate,
    enabled = true,
    autoInitialize = false, // Not used but kept for API compatibility
    gameType = "tic-tac-toe",
    playerIds = [],
  } = options;

  const queryClient = useQueryClient();
  const [gameStateError, setGameStateError] = useState<Error | null>(null);

  // Query key for this game state
  const gameStateQueryKey = ["gameState", tableId];

  // Query for fetching game state with polling
  const { data: gameState, isLoading, isError, error, refetch } = useQuery({
    queryKey: gameStateQueryKey,
    queryFn: async () => {
      try {
        return await getGameState(tableId);
      } catch (err) {
        // If the error is a 404, it might mean the game hasn't started yet
        // We'll handle this differently than other errors
        if (
          err instanceof Error &&
          err.message.includes("No game state found")
        ) {
          setGameStateError(err);
          // Return null for missing game states rather than throwing
          return null;
        }
        throw err;
      }
    },
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: true,
    enabled: enabled && !!tableId && !!currentPlayerId,
    // Don't treat 404 (game state not found) as an error
    retry: (failureCount, error) => {
      // Retry for all errors except for missing game state
      if (
        error instanceof Error &&
        error.message.includes("No game state found")
      ) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Mutation for updating game state
  const { mutate: updateGame, isPending: isUpdating } = useMutation({
    mutationFn: (updates: Partial<GameState>) =>
      updateGameState(tableId, currentPlayerId, updates),
    onSuccess: (updatedGameState) => {
      // Update the cache with the new game state
      queryClient.setQueryData(gameStateQueryKey, updatedGameState);

      // Call the onGameStateUpdate callback if provided
      if (onGameStateUpdate) {
        onGameStateUpdate(updatedGameState);
      }

      // Clear any previous game state error
      setGameStateError(null);
    },
    onError: (error) => {
      // Update the error state
      if (error instanceof Error) {
        setGameStateError(error);
      } else {
        setGameStateError(new Error("Failed to update game state"));
      }
    },
  });

  // Callback for updating the game state
  const updateGameStateCallback = useCallback(
    (updates: Partial<GameState>) => {
      updateGame(updates);
    },
    [updateGame]
  );

  // Call onGameStateUpdate when game state changes
  useEffect(() => {
    if (gameState && onGameStateUpdate) {
      onGameStateUpdate(gameState);
    }
  }, [gameState, onGameStateUpdate]);

  // Check if it's the current player's turn
  const isCurrentPlayerTurn = gameState?.current_player === currentPlayerId;

  return {
    gameState,
    updateGameState: updateGameStateCallback,
    currentPlayerId,
    isCurrentPlayerTurn,
    isLoading,
    isUpdating,
    isError: isError || gameStateError !== null,
    error: error || gameStateError,
    gameStateError,
    isGameStateMissing:
      gameStateError !== null &&
      gameStateError.message.includes("No game state found"),
  };
}
