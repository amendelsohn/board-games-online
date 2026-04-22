"use client";

import React from "react";
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
    <div className="w-full max-w-4xl mx-auto px-4">
      <h1 className="text-3xl font-bold text-center my-8">Game Lobby</h1>
      <GameLobby joinCode={joinCode} />
    </div>
  );
}
