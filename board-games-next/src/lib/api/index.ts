import { Player, PlayerId, Table, GameState } from "@/types";
import { pollingManager } from "./pollingManager";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Player API
export const createPlayer = async (
  name: string = "Player"
): Promise<Player> => {
  try {
    const response = await fetch(`${API_URL}/player/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: `Server error: ${response.status}` }));
      throw new Error(error.message || "Failed to create player");
    }

    return response.json();
  } catch (error) {
    console.error("API call failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Network error or server unreachable");
  }
};

export const getPlayer = async (playerId: PlayerId): Promise<Player> => {
  const response = await fetch(`${API_URL}/player/${playerId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch player");
  }

  return response.json();
};

export const updatePlayerName = async (
  playerId: PlayerId,
  name: string
): Promise<Player> => {
  const response = await fetch(`${API_URL}/player/${playerId}/name`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update player name");
  }

  return response.json();
};

// Table API
export const createTable = async (
  gameType: string,
  hostPlayerId: PlayerId,
  initialGameState: Partial<GameState> = {}
): Promise<Table> => {
  const response = await fetch(`${API_URL}/table/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      game_type: gameType,
      host_player_id: hostPlayerId,
      initial_game_state: initialGameState,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create table");
  }

  return response.json();
};

export const getTable = async (tableIdOrJoinCode: string): Promise<Table> => {
  // Try to get by ID first
  try {
    const response = await fetch(`${API_URL}/table/${tableIdOrJoinCode}`);
    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    // Ignore error and try join code
  }

  return getTableByJoinCode(tableIdOrJoinCode);
};

export const getTableByJoinCode = async (joinCode: string): Promise<Table> => {
  const response = await fetch(`${API_URL}/table/join/${joinCode}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch table by join code");
  }

  return response.json();
};

export const joinTable = async (
  joinCode: string,
  playerId: PlayerId
): Promise<Table> => {
  const response = await fetch(`${API_URL}/table/join/${joinCode}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ player_id: playerId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to join table");
  }

  return response.json();
};

export const startGame = async (
  tableId: string,
  playerId: PlayerId
): Promise<Table> => {
  const response = await fetch(`${API_URL}/table/${tableId}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ player_id: playerId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to start game");
  }

  return response.json();
};

// Game State API
export const getGameState = async (tableId: string): Promise<GameState> => {
  const response = await fetch(`${API_URL}/table/${tableId}/game-state`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch game state");
  }

  return response.json();
};

export const updateGameState = async (
  tableId: string,
  playerId: PlayerId,
  updates: Partial<GameState>
): Promise<GameState> => {
  const response = await fetch(
    `${API_URL}/table/${tableId}/game-state/update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        player_id: playerId,
        updates,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update game state");
  }

  return response.json();
};

// Polling helper
export const pollGameState = (
  tableId: string,
  onUpdate: (gameState: GameState) => void,
  interval: number = 2000,
  onError?: (error: Error) => void
): { stop: () => void } => {
  console.log(`pollGameState: Starting polling for table ${tableId}`);

  // Use the polling manager to start polling
  const stopFn = pollingManager.startPolling(
    tableId,
    onUpdate,
    interval,
    onError
  );

  // Return a function to stop polling
  return {
    stop: () => {
      console.log(`pollGameState: Stop function called for table ${tableId}`);
      stopFn();
    },
  };
};
