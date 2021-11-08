import { Injectable, NotFoundException } from '@nestjs/common';
import { PlayerModel } from 'database/bg-database/players/players.model';
import Player from './Player';

@Injectable()
export class PlayerService {

  async getPlayer(player_id: string): Promise<Player> {
    const found = await PlayerModel.findOne({player_id}).exec();
    return found.toObject() as Player;
  }

  async createPlayer(player: Player): Promise<Player> {
    const playerToCreate = new PlayerModel(player);
    return await playerToCreate.save();
  }
}
