import { forwardRef, Module } from '@nestjs/common';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { PlayersModule } from '../players/players.module';
import { MatchModule } from '../match/match.module';

@Module({
  imports: [PlayersModule, forwardRef(() => MatchModule)],
  providers: [TablesService],
  controllers: [TablesController],
  exports: [TablesService],
})
export class TablesModule {}
