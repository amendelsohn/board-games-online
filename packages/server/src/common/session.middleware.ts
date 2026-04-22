import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { LobbyStore } from '../state/lobby-store.service';

/**
 * Attach the LobbyStore to the request so @CurrentPlayer can reach it
 * without nestjs-level DI inside a param decorator.
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly lobby: LobbyStore) {}

  use(req: Request & { lobbyStore?: LobbyStore }, _res: Response, next: NextFunction): void {
    req.lobbyStore = this.lobby;
    next();
  }
}
