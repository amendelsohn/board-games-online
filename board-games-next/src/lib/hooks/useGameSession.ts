"use client";

import { useEffect, useState } from "react";
import { useGameState } from "./useGameState";
import { getPlayerSession } from "@/lib/playerSession";
import { getTable } from "@/lib/api";
import { GameState, Player, PlayerId, Table } from "@/types";

interface UseGameSessionOptions {
  pollingInterval?: number;
  onGameStateUpdate?: (gameState: GameState) => void;
  autoJoinTable?: boolean;
  autoInitialize?: boolean; // Kept for backwards compatibility but not used
}

/**
 * Custom hook for managing a complete game session
 *
 * This hook combines player session management with game state management.
 * It handles loading the player session and then using that to manage the game state.
 *
 * @param tableId - The ID of the table to get game state for
 * @param options - Additional options for the hook
 * @returns An object containing the current game state, player info, and functions to update the game state
 */
export function useGameSession(
  tableId: string,
  options: UseGameSessionOptions = {}
) {
  const {
    pollingInterval,
    onGameStateUpdate,
    autoJoinTable = false,
    autoInitialize = false, // Not used but kept for compatibility
  } = options;

  const [player, setPlayer] = useState<Player | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(true);
  const [isLoadingTable, setIsLoadingTable] = useState(true);
  const [playerError, setPlayerError] = useState<Error | null>(null);
  const [tableError, setTableError] = useState<Error | null>(null);

  // Load the player session
  useEffect(() => {
    const loadPlayer = async () => {
      try {
        setIsLoadingPlayer(true);
        const playerData = await getPlayerSession();
        setPlayer(playerData);
        setPlayerError(null);
      } catch (error) {
        console.error("Failed to load player session:", error);
        setPlayerError(
          error instanceof Error
            ? error
            : new Error("Failed to load player session")
        );
      } finally {
        setIsLoadingPlayer(false);
      }
    };

    loadPlayer();
  }, []);

  // Load table data if we have a tableId
  useEffect(() => {
    const loadTable = async () => {
      if (!tableId) {
        setIsLoadingTable(false);
        return;
      }

      try {
        setIsLoadingTable(true);
        const tableData = await getTable(tableId);
        setTable(tableData);
        setTableError(null);
      } catch (error) {
        console.error(`Failed to load table data for table ${tableId}:`, error);
        setTableError(
          error instanceof Error
            ? error
            : new Error(`Failed to load table data for table ${tableId}`)
        );
      } finally {
        setIsLoadingTable(false);
      }
    };

    loadTable();
  }, [tableId]);

  // Use the game state hook if we have a player
  const {
    gameState,
    updateGameState,
    currentPlayerId,
    isCurrentPlayerTurn,
    isLoading: isLoadingGameState,
    isUpdating,
    isError: isGameStateError,
    error: gameStateError,
    isGameStateMissing,
  } = useGameState(tableId, player?.player_id || "", {
    pollingInterval,
    onGameStateUpdate,
    // Don't start polling until we have a player
    enabled: !!player,
    // Game state initialization is handled by the server
    autoInitialize: false,
    gameType: table?.game_type || "tic-tac-toe",
    playerIds: table?.player_ids || [],
  });

  // Auto-join table if needed
  useEffect(() => {
    if (autoJoinTable && player && !isLoadingGameState && !gameState) {
      // TODO: Implement auto-join logic if needed
      // This would call the joinTable API function
    }
  }, [autoJoinTable, player, isLoadingGameState, gameState]);

  // Determine if we have any errors
  const isError = !!playerError || !!tableError || isGameStateError;

  // Combine errors for display
  const error = playerError || tableError || gameStateError || null;

  // Determine overall loading state
  const isLoading = isLoadingPlayer || isLoadingTable || isLoadingGameState;

  return {
    gameState,
    updateGameState,
    currentPlayerId,
    isCurrentPlayerTurn,
    player,
    table,
    isLoadingPlayer,
    isLoadingTable,
    isLoadingGameState,
    playerError,
    tableError,
    gameStateError,
    isGameStateMissing,
    isLoading,
    isUpdating,
    isError,
    error,
    isReady: !isLoading && !!player && !!table,
  };
}
