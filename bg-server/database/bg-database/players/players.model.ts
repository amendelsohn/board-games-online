import { model } from "mongoose";
import { IPlayerDocument } from "./players.types";
import PlayerSchema from "./players.schema";
export const PlayerModel = model<IPlayerDocument>("Player", PlayerSchema);
