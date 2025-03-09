"use client";

import { JoinGameHome } from "@/components/lobby/JoinGameHome";
import styles from "@/styles/Home.module.css";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGameSession } from "@/lib/hooks/useGameSession";
import { createTable } from "@/lib/api";
import { GameState } from "@/types";

export default function Home() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Use our custom hook just for player session
  const { player, isLoadingPlayer } = useGameSession("", {
    // Don't poll for game state, we're just using this for player session
    pollingInterval: 0,
  });

  const games = [
    {
      id: "tic-tac-toe",
      name: "Tic Tac Toe",
      description: "Classic 3x3 grid game. Get three in a row to win!",
      image: "/images/tic-tac-toe.svg",
    },
    // Add more games here as they become available
  ];

  const handleCreateGame = async (gameType: string) => {
    if (!player) {
      setError("Player not initialized. Please try again.");
      return;
    }

    setIsCreating(gameType);
    setError("");

    try {
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

      // Redirect to the new lobby
      router.push(`/lobby/${table.join_code}`);
    } catch (err) {
      console.error("Error creating game:", err);
      setError(err instanceof Error ? err.message : "Failed to create game");
      setIsCreating(null);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Welcome to Board Games Online</h1>
      <p className={styles.description}>Play board games with friends online</p>

      {error && <p className={styles.error}>{error}</p>}

      <h2 className={styles.subtitle}>Select a Game</h2>
      <div className={styles.gameGrid}>
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => handleCreateGame(game.id)}
            className={styles.gameCard}
            disabled={isCreating !== null || isLoadingPlayer}
          >
            <div className={styles.gameImageContainer}>
              {isCreating === game.id ? (
                <div className={styles.loadingSpinner}>Creating game...</div>
              ) : (
                <Image
                  src={game.image}
                  alt={game.name}
                  width={120}
                  height={120}
                  className={styles.gameImage}
                />
              )}
            </div>
            <h3>{game.name}</h3>
            <p>{game.description}</p>
          </button>
        ))}
      </div>

      <div className={styles.joinSection}>
        <h2 className={styles.subtitle}>Join Existing Game</h2>
        <JoinGameHome />
      </div>
    </div>
  );
}
