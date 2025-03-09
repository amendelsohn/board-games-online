"use client";

import { JoinGameHome } from "@/components/lobby/JoinGameHome";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGameSession } from "@/lib/hooks/useGameSession";
import { createTable } from "@/lib/api";
import { GameState } from "@/types";
import GameCard from "@/components/GameCard";

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
      players: "2 players",
      difficulty: "easy" as const,
    },
    {
      id: "chess",
      name: "Chess",
      description: "Strategic board game played on an 8x8 grid.",
      image: "/images/tic-tac-toe.svg", // Replace with chess image
      players: "2 players",
      difficulty: "hard" as const,
      comingSoon: true,
    },
    {
      id: "connect-four",
      name: "Connect Four",
      description:
        "Vertical game where players drop discs to connect 4 in a row.",
      image: "/images/tic-tac-toe.svg", // Replace with connect four image
      players: "2 players",
      difficulty: "medium" as const,
      comingSoon: true,
    },
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
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {error && (
        <div className="alert alert-error mb-6">
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
          <span>{error}</span>
        </div>
      )}

      <JoinGameHome />

      <div className="divider">OR</div>

      <section id="game-selection" className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <div key={game.id} className="relative">
              {game.comingSoon && (
                <div className="absolute inset-0 flex items-center justify-center bg-base-200 bg-opacity-80 z-10 rounded-lg">
                  <span className="badge badge-lg">Coming Soon</span>
                </div>
              )}
              <GameCard
                {...game}
                onClick={() => !game.comingSoon && handleCreateGame(game.id)}
                isLoading={isCreating === game.id}
                disabled={!!isCreating || isLoadingPlayer || !!game.comingSoon}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
