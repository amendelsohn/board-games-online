"use client";

import React, { useState, useEffect } from "react";
import { useGameSession } from "@/lib/hooks/useGameSession";
import CreateGame from "@/components/lobby/CreateGame";
import JoinGame from "@/components/lobby/JoinGame";
import { isServerRunning } from "@/lib/api/serverCheck";
import { ServerConnectionError } from "@/components/ErrorMessage";

interface LobbyProps {
  initialGameType?: string;
}

export default function Lobby({ initialGameType }: LobbyProps = {}) {
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
    return (
      <div className="flex justify-center items-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Server error state
  if (serverAvailable === false) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center my-8">Game Lobby</h1>
        <ServerConnectionError />
      </div>
    );
  }

  // Player error state
  if (playerError || !player) {
    return (
      <div className="alert alert-error max-w-lg mx-auto">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          Error: {playerError?.message || "Failed to load player data"}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <h1 className="text-3xl font-bold text-center my-8">Game Lobby</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <CreateGame player={player} initialGameType={initialGameType} />
        <JoinGame player={player} />
      </div>
    </div>
  );
}
