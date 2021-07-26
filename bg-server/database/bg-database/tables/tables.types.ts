import { Document, Model } from "mongoose";
import { PlayerId } from "src/player/Player";

export interface ITable {
    table_id: string;
    player_ids: PlayerId[];
    game_state_id: string;
}

export interface ITableDocument extends ITable, Document {}

export interface ITableModel extends Model<ITableDocument> {
    setPlayerIds: (
        this: ITableDocument, player_ids: PlayerId[]
      ) => Promise<void>
}
