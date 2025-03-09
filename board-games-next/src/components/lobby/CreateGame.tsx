"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTable } from "@/lib/api";
import { Player, GameState } from "@/types";

interface CreateGameProps {
  player: Player;
  initialGameType?: string;
}

export default function CreateGame({
  player,
  initialGameType,
}: CreateGameProps) {
  const router = useRouter();
  const [gameType, setGameType] = useState(initialGameType || "tic-tac-toe");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  // Update gameType if initialGameType changes
  useEffect(() => {
    if (initialGameType) {
      setGameType(initialGameType);
    }
  }, [initialGameType]);

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
    <div className="card bg-base-100 shadow-md h-full">
      <div className="card-body">
        <h2 className="card-title">Create New Game</h2>

        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Game Type:</span>
          </label>
          <select
            value={gameType}
            onChange={(e) => setGameType(e.target.value)}
            className="select select-bordered w-full"
          >
            <option value="tic-tac-toe">Tic Tac Toe</option>
            {/* Add more game types as they become available */}
          </select>
        </div>

        <div className="card-actions justify-end mt-4">
          <button
            onClick={handleCreateGame}
            disabled={isCreating}
            className="btn btn-primary w-full"
          >
            {isCreating ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              "Create Game"
            )}
          </button>
        </div>

        {error && <div className="mt-3 text-error text-sm">{error}</div>}
      </div>
    </div>
  );
}
