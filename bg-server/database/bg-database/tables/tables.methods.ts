import { ITableDocument } from './tables.types';
import { PlayerId } from 'src/player/Player';
import { TableStatus } from 'src/table/Table';

export const tableMethods = {
  async setPlayerIds(
    this: ITableDocument,
    player_ids: PlayerId[],
  ): Promise<void> {
    this.player_ids = player_ids;
    await this.save();
  },

  async startGame(this: ITableDocument): Promise<void> {
    if (this.status === TableStatus.WAITING) {
      this.status = TableStatus.PLAYING;
      await this.save();
    }
  },

  async finishGame(this: ITableDocument): Promise<void> {
    if (this.status === TableStatus.PLAYING) {
      this.status = TableStatus.FINISHED;
      await this.save();
    }
  },
};
