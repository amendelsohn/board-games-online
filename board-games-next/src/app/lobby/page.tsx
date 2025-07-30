import Lobby from "@/components/lobby/Lobby";
import React from "react";

export default function LobbyPage({
  searchParams,
}: {
  searchParams: Promise<{ gameType?: string }>;
}) {
  const { gameType } = React.use(searchParams);
  return <Lobby initialGameType={gameType} />;
}
