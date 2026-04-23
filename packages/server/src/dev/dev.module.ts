import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { PlayersModule } from '../players/players.module';
import { TablesModule } from '../tables/tables.module';

@Module({
  imports: [PlayersModule, TablesModule],
  controllers: [DevController],
})
export class DevModule {}
