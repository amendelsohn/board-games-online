import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerController } from './player/player.controller';
import { PlayerService } from './player/player.service';
import { TableController } from './table/table.controller';
import { TableService } from './table/table.service';
import { DatabaseModule } from './database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Player, Table, GameState } from './database/entities';
import { GameStateService } from './game-state/game-state.service';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([Player, Table, GameState]),
  ],
  controllers: [AppController, PlayerController, TableController],
  providers: [AppService, PlayerService, TableService, GameStateService],
})
export class AppModule {}
