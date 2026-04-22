import { PlayerId } from '../player/Player';

export enum TableStatus {
  WAITING = 'waiting', // In lobby, waiting for players
  PLAYING = 'playing', // Game in progress
  FINISHED = 'finished', // Game completed
}

type Table = {
  table_id: string;
  join_code: string;
  player_ids: PlayerId[];
  game_state_id: string;
  host_player_id: PlayerId;
  status: TableStatus;
  game_type: string;
  created_at: Date;
  updated_at: Date;
};

export default Table;
