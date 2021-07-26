import { ITableDocument } from "./tables.types";
import { PlayerId } from "src/player/Player";

export async function setPlayerIds(this: ITableDocument, player_ids: PlayerId[]): Promise<void> {
    this.player_ids = player_ids;
    await this.save();
}
