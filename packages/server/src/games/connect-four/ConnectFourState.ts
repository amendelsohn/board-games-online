import GameState from 'src/game-state/GameState';
import { PlayerId } from 'src/player/Player';

type Cell = string; // Empty string, 'R' for red, 'Y' for yellow
type Row = Cell[];

// Standard Connect Four board is 7 columns by 6 rows
export const BOARD_ROWS = 6;
export const BOARD_COLS = 7;

export const initial_state: Row[] = Array(BOARD_ROWS)
  .fill(null)
  .map(() => Array(BOARD_COLS).fill(''));

interface ConnectFourSpecificState {
  board: Row[];
  player_symbols: Record<PlayerId, string>; // Maps player ID to 'R' or 'Y'
  last_move?: {
    column: number;
    row: number;
    player: PlayerId;
  };
}

type ConnectFourGameState = GameState & {
  game_specific_state: ConnectFourSpecificState;
};

export default ConnectFourGameState;