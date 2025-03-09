"use client";

import React from "react";
import styles from "../page.module.css";
import GameLobby from "@/components/lobby/GameLobby";

// Update the type definition for the params in Next.js 15
interface LobbyPageProps {
  params: Promise<{
    joinCode: string;
  }>;
}

export default function LobbyJoinPage({ params }: LobbyPageProps) {
  // Unwrap params with React.use() before accessing its properties
  const unwrappedParams = React.use(params);
  const { joinCode } = unwrappedParams;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Game Lobby</h1>
      <GameLobby joinCode={joinCode} />
    </div>
  );
}
