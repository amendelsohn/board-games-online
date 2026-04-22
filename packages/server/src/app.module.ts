import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { StateModule } from './state/state.module';
import { GamesModule } from './games/games.module';
import { PlayersModule } from './players/players.module';
import { TablesModule } from './tables/tables.module';
import { MatchModule } from './match/match.module';
import { SessionMiddleware } from './common/session.middleware';

@Module({
  imports: [
    StateModule,
    GamesModule,
    PlayersModule,
    MatchModule,
    TablesModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
