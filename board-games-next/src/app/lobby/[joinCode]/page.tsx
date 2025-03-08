"use client";

import { useState, useEffect } from "react";
import { getPlayerSession } from "@/lib/playerSession";
import { Player } from "@/types";
import GameLobby from "@/components/lobby/GameLobby";
import styles from "../page.module.css";

interface LobbyPageProps {
  params: {
    joinCode: string;
  };
}

export default function LobbyJoinPage({ params }: LobbyPageProps) {
  // Since this is a client component, we can directly access params
  // The warning is more relevant for server components
  const { joinCode } = params;

  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const initPlayer = async () => {
      try {
        const playerData = await getPlayerSession();
        setPlayer(playerData);
      } catch (err) {
        setError("Failed to initialize player session");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    initPlayer();
  }, []);

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
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
      <GameLobby joinCode={joinCode} currentPlayer={player} />
    </div>
  );
}
