import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PlayerId } from 'src/player/Player';
import Table from './Table';
import { TableService } from './table.service';

@Controller('table')
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Get('heartbeat')
  heartbeat(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('join/:join_code')
  async getTableByJoinCode(
    @Param('join_code') join_code: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const found = await this.tableService.getTableByJoinCode(join_code);
      response.json(found);
    } catch (error) {
      response.status(404).json({ message: error.message });
    }
  }

  @Get(':table_id')
  async getTable(
    @Param('table_id') table_id: string,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const found = await this.tableService.getTable(table_id);
      response.json(found);
    } catch (error) {
      response.status(404).json({ message: error.message });
    }
  }

  @Post('create')
  async createTable(
    @Body('game_type') gameType: string,
    @Body('host_player_id') hostPlayerId: PlayerId,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const table = await this.tableService.createTable(gameType, hostPlayerId);
      response.status(201).json(table);
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  }

  @Post('join/:join_code')
  async joinTable(
    @Param('join_code') join_code: string,
    @Body('player_id') player_id: PlayerId,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const table = await this.tableService.joinTable(join_code, player_id);
      response.json(table);
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  }

  @Post(':table_id/start')
  async startGame(
    @Param('table_id') table_id: string,
    @Body('player_id') player_id: PlayerId,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const table = await this.tableService.startGame(table_id, player_id);
      response.json(table);
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  }

  @Post(':table_id/addPlayers')
  async addPlayers(
    @Param('table_id') table_id: string,
    @Body('player_ids') player_ids: PlayerId[],
    @Res() response: Response,
  ): Promise<void> {
    try {
      const updatedTable = await this.tableService.addPlayers(
        table_id,
        player_ids,
      );
      response.json(updatedTable);
    } catch (error) {
      response.status(400).json({ message: error.message });
    }
  }
}
