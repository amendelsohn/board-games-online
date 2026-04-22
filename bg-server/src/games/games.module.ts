import { Module, OnModuleInit } from '@nestjs/common';
import { GameRegistryService } from './game-registry.service';
import { TicTacToeService } from './tic-tac-toe/tic-tac-toe.service';
import { ConnectFourService } from './connect-four/connect-four.service';

@Module({
  providers: [GameRegistryService, TicTacToeService, ConnectFourService],
  exports: [GameRegistryService],
})
export class GamesModule implements OnModuleInit {
  constructor(
    private gameRegistry: GameRegistryService,
    private ticTacToeService: TicTacToeService,
    private connectFourService: ConnectFourService,
  ) {}

  onModuleInit() {
    // Register all games
    this.gameRegistry.registerGame(this.ticTacToeService);
    this.gameRegistry.registerGame(this.connectFourService);

    // Add other games here as they are implemented
  }
}
