import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { PlayerId } from 'src/player/Player';
import Table from './Table';
import { TableService } from './table.service';

@Controller("table")
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Get("heartbeat")
  heartbeat(): string {
    return `table service is alive as of: [${Date.now().toLocaleString()}`;
  }

  @Get(":table_id")
  async getTable(@Param('table_id') table_id: string, @Res() response: Response): Promise<Table> {
    if (!table_id) {
      response.status(400).send;
      return Promise.reject();
    }

    const found = await this.tableService.getTable(table_id);
    if (!found) {
      response.status(404).send;
      return Promise.reject();
    }

    response.json(found);
    return found;
  }

  @Post("createTable")
  async createTable(@Body() table: Table): Promise<Table> {
    return this.tableService.createTable(table);
  }

  @Post(":table_id/addPlayers")
  async addPlayers(@Param('table_id') table_id, @Res() response: Response, @Body('player_ids') player_ids: PlayerId[]): Promise<Table> {
    if (!table_id) {
      response.status(400).send;
      return Promise.reject();
    }

    const updatedTable = await this.tableService.addPlayers(table_id, player_ids);
    response.json(updatedTable);
    return updatedTable;
  }

}
