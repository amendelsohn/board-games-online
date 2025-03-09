import { Module, OnModuleInit } from '@nestjs/common';
import { GameRegistryService } from './game-registry.service';
import { TicTacToeService } from './tic-tac-toe/tic-tac-toe.service';

@Module({
  providers: [GameRegistryService, TicTacToeService],
  exports: [GameRegistryService],
})
export class GamesModule implements OnModuleInit {
  constructor(
    private gameRegistry: GameRegistryService,
    private ticTacToeService: TicTacToeService,
  ) {}

  onModuleInit() {
    // Register all games
    this.gameRegistry.registerGame(this.ticTacToeService);

    // Add other games here as they are implemented
  }
}
