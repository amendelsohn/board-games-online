"use client";

import { Player, PlayerId } from "@/types";
import { createPlayer, getPlayer } from "./api";

const PLAYER_ID_KEY = "board_games_player_id";

export const getPlayerSession = async (): Promise<Player> => {
  // Check if we have a player ID in localStorage
  if (typeof window !== "undefined") {
    const playerId = localStorage.getItem(PLAYER_ID_KEY);

    if (playerId) {
      try {
        // Try to get the player from the server
        const player = await getPlayer(playerId);
        return player;
      } catch (error) {
        console.error("Failed to get player session:", error);
        // If player not found, create a new one
        return createNewPlayerSession();
      }
    }
  }

  // If no player ID in localStorage, create a new player
  return createNewPlayerSession();
};

export const createNewPlayerSession = async (): Promise<Player> => {
  try {
    // Create a new player on the server
    const player = await createPlayer();

    // Save the player ID to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(PLAYER_ID_KEY, player.player_id);
    }

    return player;
  } catch (error) {
    console.error("Failed to create new player session:", error);
    throw error;
  }
};

export const clearPlayerSession = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PLAYER_ID_KEY);
  }
};
