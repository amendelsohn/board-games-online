import { GameState, PlayerId } from "@/types";

/**
 * Generates an initial game state based on game type
 *
 * @param gameType - The type of game (e.g., "tic-tac-toe")
 * @param playerIds - Array of player IDs participating in the game
 * @returns A partial GameState object with game-specific state
 */
export function getInitialGameState(
  gameType: string,
  playerIds: PlayerId[]
): Partial<GameState> {
  // First player starts by default
  const firstPlayerId = playerIds[0] || "";

  // Initialize game-specific state based on game type
  let gameSpecificState: { gameType: string; [key: string]: any } = {
    gameType,
  };

  // Initialize game-specific state based on game type
  switch (gameType) {
    case "tic-tac-toe":
      gameSpecificState = {
        ...gameSpecificState,
        board: [
          ["", "", ""],
          ["", "", ""],
          ["", "", ""],
        ],
        moves: [],
      };
      break;
    // Add other game types here as needed
    default:
      // Generic empty state
      break;
  }

  return {
    current_player: firstPlayerId,
    is_game_over: false,
    winning_players: [],
    losing_players: [],
    game_specific_state: gameSpecificState,
  };
}
