import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import Player from './Player';
import { PlayerService } from './player.service';

@Controller("player")
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get("heartbeat")
  heartbeat(): string {
    return `player service is alive as of: [${Date.now().toLocaleString()}`;
  }

  @Get(":player_id")
  async getPlayer(@Param() params, @Res() response): Promise<Player> {
    const { player_id } = params;
    if (!player_id) {
      response.status(400).send;
      return Promise.reject();
    }

    const found = await this.playerService.getPlayer(player_id);
    if (!found) {
      response.status(404).send;
      return Promise.reject();
    }

    response.json(found);
    return found;
  }

  @Post("createPlayer")
  async createPlayer(@Body() player: Player): Promise<Player> {
    return this.playerService.createPlayer(player);
  }

}
