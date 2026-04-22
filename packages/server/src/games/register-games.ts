import { ticTacToeServerModule } from '@bgo/games-tictactoe/server';
import { connectFourServerModule } from '@bgo/games-connectfour/server';
import { codenamesServerModule } from '@bgo/games-codenames/server';
import { spyfallServerModule } from '@bgo/games-spyfall/server';
import { mastermindServerModule } from '@bgo/games-mastermind/server';
import type { GamesRegistry } from './games-registry.service';

/** Registers every installed game module with the registry at bootstrap. */
export function registerAllGames(registry: GamesRegistry): void {
  registry.register(ticTacToeServerModule);
  registry.register(connectFourServerModule);
  registry.register(codenamesServerModule);
  registry.register(spyfallServerModule);
  registry.register(mastermindServerModule);
}
