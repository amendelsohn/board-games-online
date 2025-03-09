"use client";

import React, { useState, useEffect } from "react";
import { useGameSession } from "@/lib/hooks/useGameSession";
import CreateGame from "@/components/lobby/CreateGame";
import JoinGame from "@/components/lobby/JoinGame";
import PlayerProfile from "@/components/lobby/PlayerProfile";
import { isServerRunning } from "@/lib/api/serverCheck";
import { ServerConnectionError } from "@/components/ErrorMessage";
import styles from "@/app/lobby/page.module.css";
import { Player } from "@/types";

export default function Lobby() {
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(true);

  // Use our custom hook just for player session (not game state)
  const { player, isLoadingPlayer, playerError } = useGameSession("", {
    // Don't poll for game state, we're just using this for player session
    pollingInterval: 0,
  });

  // Check if the server is running
  useEffect(() => {
    const checkServer = async () => {
      try {
        const isServerUp = await isServerRunning();
        setServerAvailable(isServerUp);
      } catch (err) {
        console.error("Failed to check server status:", err);
        setServerAvailable(false);
      } finally {
        setIsCheckingServer(false);
      }
    };

    checkServer();
  }, []);

  // Loading state
  if (isCheckingServer || isLoadingPlayer) {
    return <div className={styles.loading}>Loading...</div>;
  }

  // Server error state
  if (serverAvailable === false) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Game Lobby</h1>
        <ServerConnectionError />
      </div>
    );
  }

  // Player error state
  if (playerError || !player) {
    return (
      <div className={styles.error}>
        Error: {playerError?.message || "Failed to load player data"}
      </div>
    );
  }

  // Handler for player updates
  const handlePlayerUpdate = (updatedPlayer: Player) => {
    // Since we're using the hook, we don't need to manually update the player
    // The hook will handle re-fetching player data as needed
    console.log("Player updated:", updatedPlayer);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Game Lobby</h1>

      <div className={styles.grid}>
        <div className={styles.column}>
          <PlayerProfile player={player} onPlayerUpdate={handlePlayerUpdate} />
        </div>

        <div className={styles.column}>
          <CreateGame player={player} />
          <JoinGame player={player} />
        </div>
      </div>
    </div>
  );
}
