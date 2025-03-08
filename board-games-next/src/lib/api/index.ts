import { Player, PlayerId, Table } from "@/types";

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
  hostPlayerId: PlayerId
): Promise<Table> => {
  const response = await fetch(`${API_URL}/table/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ game_type: gameType, host_player_id: hostPlayerId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create table");
  }

  return response.json();
};

export const getTable = async (tableIdOrJoinCode: string): Promise<Table> => {
  // If the input is 4 characters, assume it's a join code
  if (tableIdOrJoinCode.length === 4 && /^[A-Z]+$/.test(tableIdOrJoinCode)) {
    console.log("Using getTableByJoinCode for:", tableIdOrJoinCode);
    return getTableByJoinCode(tableIdOrJoinCode);
  }

  console.log("Fetching table by ID:", tableIdOrJoinCode);
  const response = await fetch(`${API_URL}/table/${tableIdOrJoinCode}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch table");
  }

  return response.json();
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
