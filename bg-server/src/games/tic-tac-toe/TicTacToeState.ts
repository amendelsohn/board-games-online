import GameState from 'src/game-state/GameState';
import { PlayerId } from 'src/player/Player';

type Row = string[];

export const initial_state: Row[] = [
  ['', '', ''],
  ['', '', ''],
  ['', '', ''],
];

interface TicTacToeSpecificState {
  board: Row[];
  player_symbols: Record<PlayerId, string>;
}

type TicTacToeGameState = GameState & {
  game_specific_state: TicTacToeSpecificState;
};

export default TicTacToeGameState;
