import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import Table from './table/Table';
import Player from './player/Player';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("table")
  async getTable(): Promise<Table> {
    return this.appService.getTable();
  } 

  @Get("player")
  getPlayer(): Player {
    return this.appService.getPlayer();
  }

  @Get("initTable")
  async initTable(): Promise<Table> {
    return this.appService.initTable();
  }

}
