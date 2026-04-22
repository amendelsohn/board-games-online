import { forwardRef, Module } from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchGateway } from './match.gateway';
import { PlayersModule } from '../players/players.module';
import { TablesModule } from '../tables/tables.module';

@Module({
  imports: [PlayersModule, forwardRef(() => TablesModule)],
  providers: [MatchService, MatchGateway],
  exports: [MatchService],
})
export class MatchModule {}
