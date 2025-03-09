"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { joinTable } from "@/lib/api";
import { useGameSession } from "@/lib/hooks/useGameSession";

export function JoinGameHome() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);

  // Use our custom hook just for player session
  const { player, isLoadingPlayer } = useGameSession("", {
    // Don't poll for game state, we're just using this for player session
    pollingInterval: 0,
  });

  const handleJoinGame = async () => {
    if (!player) {
      setError("Player not initialized");
      return;
    }

    if (!joinCode.trim()) {
      setError("Please enter a join code");
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      await joinTable(joinCode.toUpperCase(), player.player_id);
      router.push(`/lobby/${joinCode.toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join game");
    } finally {
      setIsJoining(false);
    }
  };

  // Loading state
  if (isLoadingPlayer) {
    return (
      <div className="flex justify-center items-center py-8">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-md mx-auto max-w-md">
      <div className="card-body">
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text font-medium">
              Enter 4-letter Join Code:
            </span>
          </label>
          <div className="join w-full">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              placeholder="ABCD"
              className="input input-bordered input-primary join-item flex-1 text-center font-bold tracking-widest uppercase"
            />
            <button
              onClick={handleJoinGame}
              disabled={isJoining || !joinCode.trim() || !player}
              className="btn btn-primary join-item"
            >
              {isJoining ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : null}
              {isJoining ? "Joining..." : "Join Game"}
            </button>
          </div>
          {error && (
            <div className="label">
              <span className="label-text-alt text-error">{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
