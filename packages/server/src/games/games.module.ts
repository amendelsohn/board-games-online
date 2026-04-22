import { Global, Module } from '@nestjs/common';
import { GamesRegistry } from './games-registry.service';
import { GamesController } from './games.controller';

@Global()
@Module({
  providers: [GamesRegistry],
  controllers: [GamesController],
  exports: [GamesRegistry],
})
export class GamesModule {}
