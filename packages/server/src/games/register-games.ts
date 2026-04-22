import { ticTacToeServerModule } from '@bgo/games-tictactoe/server';
import { connectFourServerModule } from '@bgo/games-connectfour/server';
import { codenamesServerModule } from '@bgo/games-codenames/server';
import { spyfallServerModule } from '@bgo/games-spyfall/server';
import { reversiServerModule } from '@bgo/games-reversi/server';
import { checkersServerModule } from '@bgo/games-checkers/server';
import { gomokuServerModule } from '@bgo/games-gomoku/server';
import { dotsAndBoxesServerModule } from '@bgo/games-dotsandboxes/server';
import { battleshipServerModule } from '@bgo/games-battleship/server';
import { mastermindServerModule } from '@bgo/games-mastermind/server';
import { memoryServerModule } from '@bgo/games-memory/server';
import { nimServerModule } from '@bgo/games-nim/server';
import { rpsServerModule } from '@bgo/games-rps/server';
import type { GamesRegistry } from './games-registry.service';

/** Registers every installed game module with the registry at bootstrap. */
export function registerAllGames(registry: GamesRegistry): void {
  registry.register(ticTacToeServerModule);
  registry.register(connectFourServerModule);
  registry.register(codenamesServerModule);
  registry.register(spyfallServerModule);
  registry.register(reversiServerModule);
  registry.register(checkersServerModule);
  registry.register(gomokuServerModule);
  registry.register(dotsAndBoxesServerModule);
  registry.register(battleshipServerModule);
  registry.register(mastermindServerModule);
  registry.register(memoryServerModule);
  registry.register(nimServerModule);
  registry.register(rpsServerModule);
}
