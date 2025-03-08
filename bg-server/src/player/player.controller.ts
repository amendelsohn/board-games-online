import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import Player from './Player';
import { PlayerService } from './player.service';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get('heartbeat')
  heartbeat(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':player_id')
  async getPlayer(
    @Param('player_id') player_id: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const found = await this.playerService.getPlayer(player_id);
      response.json(found);
    } catch (error) {
      response.status(404).json({ message: error.message });
    }
  }

  @Post('create')
  async createPlayer(
    @Body('name') name: string = 'Player',
    @Res() response: Response,
  ): Promise<void> {
    try {
      const player = await this.playerService.createPlayer(name);
      response.status(201).json(player);
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  }

  @Put(':player_id/name')
  async updatePlayerName(
    @Param('player_id') player_id: string,
    @Body('name') name: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const player = await this.playerService.updatePlayerName(player_id, name);
      response.json(player);
    } catch (error) {
      response.status(error.status || 400).json({ message: error.message });
    }
  }
}
