import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerController } from './player/player.controller';
import { PlayerService } from './player/player.service';
import { TableController } from './table/table.controller';
import { TableService } from './table/table.service';

@Module({
  imports: [],
  controllers: [AppController, PlayerController, TableController],
  providers: [AppService, PlayerService, TableService],
})
export class AppModule {}
