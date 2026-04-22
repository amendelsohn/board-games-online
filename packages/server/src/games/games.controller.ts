import { Controller, Get } from '@nestjs/common';
import type { ListGamesResponse } from '@bgo/contracts';
import { GamesRegistry } from './games-registry.service';

@Controller('games')
export class GamesController {
  constructor(private readonly registry: GamesRegistry) {}

  @Get()
  list(): ListGamesResponse {
    return { games: this.registry.list() };
  }
}
