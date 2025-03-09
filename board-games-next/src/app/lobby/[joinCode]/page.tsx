"use client";

import styles from "../page.module.css";
import GameLobby from "@/components/lobby/GameLobby";

interface LobbyPageProps {
  params: {
    joinCode: string;
  };
}

export default function LobbyJoinPage({ params }: LobbyPageProps) {
  const { joinCode } = params;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Game Lobby</h1>
      <GameLobby joinCode={joinCode} />
    </div>
  );
}
