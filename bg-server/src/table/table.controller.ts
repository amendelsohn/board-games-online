import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
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
  async getTable(@Param() params, @Res() response): Promise<Table> {
    const { table_id } = params;
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

}
