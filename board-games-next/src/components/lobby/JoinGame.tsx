"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinTable } from "@/lib/api";
import { Player } from "@/types";
import styles from "./Lobby.module.css";

interface JoinGameProps {
  player: Player;
}

export default function JoinGame({ player }: JoinGameProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  const handleJoinGame = async () => {
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

  return (
    <div className={styles.joinGameContainer}>
      <h2>Join Existing Game</h2>

      <div className={styles.formGroup}>
        <label htmlFor="joinCode">Enter 4-letter Join Code:</label>
        <input
          id="joinCode"
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={4}
          placeholder="ABCD"
          className={styles.input}
        />
      </div>

      <button
        onClick={handleJoinGame}
        disabled={isJoining || !joinCode.trim()}
        className={styles.button}
      >
        {isJoining ? "Joining..." : "Join Game"}
      </button>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
