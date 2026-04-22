import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  createPlayerBody,
  updateMeBody,
  type CreatePlayerBody,
  type CreatePlayerResponse,
  type GetMeResponse,
  type UpdateMeBody,
} from '@bgo/contracts';
import { PlayersService } from './players.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { setSessionCookie } from '../common/session';
import { CurrentPlayer } from '../common/current-player.decorator';
import { StoredPlayer } from '../state/lobby-store.service';

@Controller('players')
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createPlayerBody)) body: CreatePlayerBody,
    @Res({ passthrough: true }) res: Response,
  ): CreatePlayerResponse {
    const player = this.players.create(body.name);
    setSessionCookie(res, player.sessionToken);
    return {
      player: this.players.toWire(player),
      sessionToken: player.sessionToken,
    };
  }

  @Get('me')
  me(@CurrentPlayer() player: StoredPlayer): GetMeResponse {
    if (!player) throw new UnauthorizedException();
    return { player: this.players.toWire(player) };
  }

  @Patch('me')
  update(
    @CurrentPlayer() player: StoredPlayer,
    @Body(new ZodValidationPipe(updateMeBody)) body: UpdateMeBody,
  ): GetMeResponse {
    const next = this.players.rename(player.id, body.name);
    return { player: this.players.toWire(next) };
  }
}
