// Player types
export type PlayerId = string;

export interface Player {
  player_id: PlayerId;
  name: string;
}

// Table status
export enum TableStatus {
  WAITING = "waiting", // In lobby, waiting for players
  PLAYING = "playing", // Game in progress
  FINISHED = "finished", // Game completed
}

// Table types
export interface Table {
  table_id: string;
  join_code: string;
  player_ids: PlayerId[];
  game_state_id: string;
  host_player_id: PlayerId;
  status: TableStatus;
  game_type: string;
  created_at: Date;
  updated_at: Date;
}

// Game State
export interface GameState {
  id: string;
  current_player: PlayerId;
  is_game_over: boolean;
  winning_players: PlayerId[];
  losing_players: PlayerId[];
  game_specific_state: {
    gameType: string;
    [key: string]: any;
  };
}
