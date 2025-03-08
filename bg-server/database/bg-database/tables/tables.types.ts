import { Document, Model } from 'mongoose';
import { PlayerId } from 'src/player/Player';
import { TableStatus } from 'src/table/Table';

export interface ITable {
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

export interface ITableDocument extends ITable, Document {
  setPlayerIds: (player_ids: PlayerId[]) => Promise<void>;
}

export interface ITableModel extends Model<ITableDocument> {
  findByJoinCode: (join_code: string) => Promise<ITableDocument>;
}
