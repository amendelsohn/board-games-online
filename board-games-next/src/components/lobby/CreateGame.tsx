"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTable } from "@/lib/api";
import { Player, GameState } from "@/types";
import styles from "./Lobby.module.css";

interface CreateGameProps {
  player: Player;
}

export default function CreateGame({ player }: CreateGameProps) {
  const router = useRouter();
  const [gameType, setGameType] = useState("tic-tac-toe");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreateGame = async () => {
    setIsCreating(true);
    setError("");

    try {
      console.log(
        "Creating table with game type:",
        gameType,
        "and player ID:",
        player.player_id
      );

      // Prepare initial game state based on game type
      let initialGameState: Partial<GameState> = {
        current_player: player.player_id,
        is_game_over: false,
        winning_players: [],
        losing_players: [],
        game_specific_state: {
          gameType: gameType,
        },
      };

      // Add game-specific initial state
      if (gameType === "tic-tac-toe") {
        initialGameState.game_specific_state = {
          gameType: gameType,
          board: [
            ["", "", ""],
            ["", "", ""],
            ["", "", ""],
          ],
        };
      }

      // Create the table with initial game state
      const table = await createTable(
        gameType,
        player.player_id,
        initialGameState
      );
      console.log("Table created successfully:", table);

      router.push(`/lobby/${table.join_code}`);
    } catch (err) {
      console.error("Error creating game:", err);
      setError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={styles.createGameContainer}>
      <h2>Create New Game</h2>

      <div className={styles.formGroup}>
        <label htmlFor="gameType">Game Type:</label>
        <select
          id="gameType"
          value={gameType}
          onChange={(e) => setGameType(e.target.value)}
          className={styles.select}
        >
          <option value="tic-tac-toe">Tic Tac Toe</option>
          {/* Add more game types as they become available */}
        </select>
      </div>

      <button
        onClick={handleCreateGame}
        disabled={isCreating}
        className={styles.button}
      >
        {isCreating ? "Creating..." : "Create Game"}
      </button>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
