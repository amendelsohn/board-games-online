import GameState from "src/game-state/GameState";
import { PlayerId } from "src/player/Player";

type Row = string[];

export const initial_state: Row[] = [['', '', ''], ['', '', ''], ['', '', '']];

type TicTacToeGameState = GameState & {
    squares: Row[];
    player_symbols: Map<PlayerId, string>
}

export default TicTacToeGameState;
