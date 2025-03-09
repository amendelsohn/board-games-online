"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { joinTable } from "@/lib/api";
import { useGameSession } from "@/lib/hooks/useGameSession";
import styles from "./JoinGameHome.module.css";

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
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.formGroup}>
        <label htmlFor="joinCode">Enter 4-letter Join Code:</label>
        <div className={styles.inputGroup}>
          <input
            id="joinCode"
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="ABCD"
            className={styles.input}
          />
          <button
            onClick={handleJoinGame}
            disabled={isJoining || !joinCode.trim() || !player}
            className={styles.button}
          >
            {isJoining ? "Joining..." : "Join Game"}
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
