import { PlayerId } from 'src/player/Player';

export type GameStateId = string;

type GameState = {
  id: GameStateId;
  current_player: PlayerId;
  is_game_over: boolean;
  winning_players: PlayerId[];
  losing_players: PlayerId[];
  game_specific_state: {
    gameType: string;
    [key: string]: any;
  };
};

export default GameState;
