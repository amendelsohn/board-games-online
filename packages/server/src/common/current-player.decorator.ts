import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { readSessionToken } from './session';
import { LobbyStore, StoredPlayer } from '../state/lobby-store.service';

/**
 * Extract the current player from the session cookie / Authorization header.
 * Throws 401 if missing or invalid. Controllers that don't need a player
 * should not use this decorator.
 *
 * The LobbyStore is fetched from the nestjs app ref — Nest's param decorators
 * can't DI directly, but we access the module via the ExecutionContext.
 */
export const CurrentPlayer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StoredPlayer => {
    const req = ctx.switchToHttp().getRequest<Request & { lobbyStore?: LobbyStore }>();
    const store = req.lobbyStore;
    if (!store) {
      throw new UnauthorizedException('Session middleware not wired');
    }
    const token = readSessionToken(req);
    if (!token) {
      throw new UnauthorizedException('No session');
    }
    const player = store.getPlayerByToken(token);
    if (!player) {
      throw new UnauthorizedException('Invalid session');
    }
    return player;
  },
);
