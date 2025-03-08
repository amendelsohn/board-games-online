"use client";

import { useState } from "react";
import { updatePlayerName } from "@/lib/api";
import { Player } from "@/types";
import styles from "./Lobby.module.css";

interface PlayerProfileProps {
  player: Player;
  onPlayerUpdate: (updatedPlayer: Player) => void;
}

export default function PlayerProfile({
  player,
  onPlayerUpdate,
}: PlayerProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [playerName, setPlayerName] = useState(player.name);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  const handleUpdateName = async () => {
    if (!playerName.trim()) {
      setError("Name cannot be empty");
      return;
    }

    setIsUpdating(true);
    setError("");

    try {
      const updatedPlayer = await updatePlayerName(
        player.player_id,
        playerName
      );
      onPlayerUpdate(updatedPlayer);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={styles.playerProfileContainer}>
      <h2>Your Profile</h2>

      {isEditing ? (
        <div className={styles.editNameForm}>
          <div className={styles.formGroup}>
            <label htmlFor="playerName">Your Name:</label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.buttonGroup}>
            <button
              onClick={handleUpdateName}
              disabled={isUpdating}
              className={styles.button}
            >
              {isUpdating ? "Saving..." : "Save"}
            </button>

            <button
              onClick={() => {
                setIsEditing(false);
                setPlayerName(player.name);
                setError("");
              }}
              disabled={isUpdating}
              className={`${styles.button} ${styles.secondaryButton}`}
            >
              Cancel
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>
      ) : (
        <div className={styles.playerInfo}>
          <p>
            <strong>Name:</strong> {player.name}
            <button
              onClick={() => setIsEditing(true)}
              className={styles.editButton}
            >
              Edit
            </button>
          </p>
          <p>
            <strong>Player ID:</strong> {player.player_id}
          </p>
        </div>
      )}
    </div>
  );
}
