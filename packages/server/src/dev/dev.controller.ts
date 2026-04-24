import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  fillTableBody,
  type FillTableBody,
  type FillTableResponse,
  type TableWire,
} from '@bgo/contracts';
import { TablesService } from '../tables/tables.service';
import { PlayersService } from '../players/players.service';
import { GamesRegistry } from '../games/games-registry.service';
import {
  LobbyStore,
  StoredPlayer,
  StoredTable,
} from '../state/lobby-store.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentPlayer } from '../common/current-player.decorator';

/**
 * Dev-only endpoints. Everything here refuses to run in production builds so
 * the surface area on deployed servers is zero. Used by the web app's
 * one-click "🐞 debug" table flow to fill a table with fake seats so a single
 * browser can play-test a multi-player game.
 */
@Controller('dev')
export class DevController {
  constructor(
    private readonly tables: TablesService,
    private readonly players: PlayersService,
    private readonly games: GamesRegistry,
    private readonly lobby: LobbyStore,
  ) {}

  @Post('tables/:id/fill')
  fill(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(fillTableBody)) body: FillTableBody,
    @CurrentPlayer() player: StoredPlayer,
  ): FillTableResponse {
    this.requireDevMode();
    let table = this.tables.requireTable(id);
    this.tables.requireHost(table, player.id);
    const mod = this.games.get(table.gameType);
    const target = Math.min(body.count ?? mod.maxPlayers, mod.maxPlayers);
    while (table.playerIds.length < target) {
      const seat = table.playerIds.length + 1;
      const bot = this.players.create(`Debug ${seat}`);
      table = this.tables.join(table.joinCode, bot.id);
    }
    return { table: this.hydrate(table) };
  }

  private requireDevMode(): void {
    if (process.env.NODE_ENV === 'production') {
      // 404 rather than 403 so prod builds present no signal that the route
      // exists at all.
      throw new NotFoundException();
    }
  }

  private hydrate(table: StoredTable): TableWire {
    const storedPlayers = this.lobby.getPlayersByIds(table.playerIds);
    return {
      id: table.id,
      joinCode: table.joinCode,
      gameType: table.gameType,
      hostPlayerId: table.hostPlayerId,
      hostIsPlayer: table.hostIsPlayer,
      players: storedPlayers.map((p) => this.players.toWire(p)),
      status: table.status,
      matchId: table.matchId,
      config: table.config,
      createdAt: table.createdAt,
    };
  }
}
