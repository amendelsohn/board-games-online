import { Document, Model } from "mongoose";

export interface IPlayer {
    player_id: string;
    name: string;
}

export interface IPlayerDocument extends IPlayer, Document {}

export interface IPlayerModel extends Model<IPlayerDocument> {}
