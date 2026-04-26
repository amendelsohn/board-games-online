import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import {
  createTableBody,
  joinTableParams,
  kickBody,
  updateConfigBody,
  type CreateTableBody,
  type CreateTableResponse,
  type GetTableResponse,
  type JoinTableResponse,
  type KickBody,
  type RematchTableResponse,
  type StartTableResponse,
  type TableWire,
  type UpdateConfigBody,
} from '@bgo/contracts';
import { TablesService } from './tables.service';
import { MatchService } from '../match/match.service';
import { PlayersService } from '../players/players.service';
import { LobbyStore, StoredTable } from '../state/lobby-store.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentPlayer } from '../common/current-player.decorator';
import { StoredPlayer } from '../state/lobby-store.service';

@Controller('tables')
export class TablesController {
  constructor(
    private readonly tables: TablesService,
    private readonly match: MatchService,
    private readonly players: PlayersService,
    private readonly lobby: LobbyStore,
  ) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createTableBody)) body: CreateTableBody,
    @CurrentPlayer() player: StoredPlayer,
  ): CreateTableResponse {
    const table = this.tables.create(body.gameType, player.id);
    return { table: this.hydrate(table) };
  }

  @Post(':joinCode/join')
  join(
    @Param(new ZodValidationPipe(joinTableParams)) params: { joinCode: string },
    @CurrentPlayer() player: StoredPlayer,
  ): JoinTableResponse {
    const table = this.tables.join(params.joinCode, player.id);
    return { table: this.hydrate(table) };
  }

  @Get(':id')
  get(@Param('id') id: string): GetTableResponse {
    const table = this.tables.requireTable(id);
    return { table: this.hydrate(table) };
  }

  @Post(':id/config')
  async updateConfig(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConfigBody)) body: UpdateConfigBody,
    @CurrentPlayer() player: StoredPlayer,
  ): Promise<GetTableResponse> {
    const table = this.tables.updateConfig(id, player.id, body.config);
    return { table: this.hydrate(table) };
  }

  @Post(':id/start')
  async start(
    @Param('id') id: string,
    @CurrentPlayer() player: StoredPlayer,
  ): Promise<StartTableResponse> {
    const table = await this.match.startMatch(id, player.id);
    return { table: this.hydrate(table) };
  }

  @Post(':id/rematch')
  rematch(
    @Param('id') id: string,
    @CurrentPlayer() player: StoredPlayer,
  ): RematchTableResponse {
    const table = this.tables.rematch(id, player.id);
    return { table: this.hydrate(table) };
  }

  @Post(':id/kick')
  kick(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(kickBody)) body: KickBody,
    @CurrentPlayer() player: StoredPlayer,
  ): GetTableResponse {
    const table = this.tables.kick(id, player.id, body.playerId);
    return { table: this.hydrate(table) };
  }

  @Post(':id/leave')
  leave(
    @Param('id') id: string,
    @CurrentPlayer() player: StoredPlayer,
  ): { ok: true } {
    this.tables.leave(id, player.id);
    return { ok: true };
  }

  private hydrate(table: StoredTable): TableWire {
    const storedPlayers = this.lobby.getPlayersByIds(table.playerIds);
    return {
      id: table.id,
      joinCode: table.joinCode,
      gameType: table.gameType,
      hostPlayerId: table.hostPlayerId,
      players: storedPlayers.map((p) => this.players.toWire(p)),
      status: table.status,
      matchId: table.matchId,
      config: table.config,
      createdAt: table.createdAt,
    };
  }
}
