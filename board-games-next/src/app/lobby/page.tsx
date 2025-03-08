"use client";

import React, { useState, useEffect } from "react";
import { getPlayerSession } from "@/lib/playerSession";
import { Player } from "@/types";
import CreateGame from "@/components/lobby/CreateGame";
import JoinGame from "@/components/lobby/JoinGame";
import PlayerProfile from "@/components/lobby/PlayerProfile";
import { isServerRunning } from "@/lib/api/serverCheck";
import { ServerConnectionError } from "@/components/ErrorMessage";
import styles from "./page.module.css";

export default function LobbyPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const checkServerAndInitPlayer = async () => {
      try {
        // First check if the server is running
        const isServerUp = await isServerRunning();
        setServerAvailable(isServerUp);

        if (!isServerUp) {
          setIsLoading(false);
          return;
        }

        // Then initialize the player
        const playerData = await getPlayerSession();
        setPlayer(playerData);
      } catch (err) {
        setError("Failed to initialize player session");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    checkServerAndInitPlayer();
  }, []);

  const handlePlayerUpdate = (updatedPlayer: Player) => {
    setPlayer(updatedPlayer);
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (serverAvailable === false) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Game Lobby</h1>
        <ServerConnectionError />
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className={styles.error}>
        Error: {error || "Failed to load player data"}
      </div>
    );
  }

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
