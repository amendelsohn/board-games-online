import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { ZodSchema } from 'zod';
import {
  subscribeMatchPayload,
  submitMovePayload,
  leaveMatchPayload,
  WS,
  type SubscribeMatchPayload,
} from '@bgo/contracts';
import { MatchService } from './match.service';
import { LobbyStore, StoredPlayer } from '../state/lobby-store.service';

/** Socket.IO rooms are keyed by matchId. Views are scoped per player. */
@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class MatchGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger(MatchGateway.name);

  @WebSocketServer()
  server!: Server;

  /** Map socket.id → { matchId → unsubscribe } so we can clean up on disconnect. */
  private readonly subscriptions = new Map<string, Map<string, () => void>>();

  constructor(
    private readonly match: MatchService,
    private readonly lobby: LobbyStore,
  ) {}

  afterInit(): void {
    // Forward event-listener fires from the match service to connected clients.
    this.match.subscribeEvents((matchId, event) => {
      const payload = {
        matchId,
        event: { kind: event.kind, payload: event.payload },
      };
      if (!event.to || event.to === 'all') {
        this.server.to(`match:${matchId}`).emit(WS.MATCH_EVENT, payload);
      } else {
        const targets = Array.isArray(event.to) ? event.to : [event.to];
        for (const playerId of targets) {
          this.server
            .to(`player:${matchId}:${playerId}`)
            .emit(WS.MATCH_EVENT, payload);
        }
      }
    });
  }

  handleConnection(client: Socket): void {
    this.subscriptions.set(client.id, new Map());
  }

  handleDisconnect(client: Socket): void {
    const subs = this.subscriptions.get(client.id);
    if (subs) {
      for (const off of subs.values()) off();
      this.subscriptions.delete(client.id);
    }
  }

  @SubscribeMessage(WS.SUBSCRIBE_MATCH)
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ): Promise<void> {
    const payload = this.parse(subscribeMatchPayload, raw);
    const player = this.resolvePlayer(payload);

    const matchId = payload.matchId;
    const existingSubs = this.subscriptions.get(client.id)!;
    if (existingSubs.has(matchId)) return; // already subscribed

    await client.join(`match:${matchId}`);
    await client.join(`player:${matchId}:${player.id}`);

    const off = this.match.subscribeViews(matchId, player.id, (snapshot) => {
      client.emit(WS.VIEW_UPDATED, {
        matchId,
        version: snapshot.version,
        phase: snapshot.phase,
        currentActors: snapshot.currentActors,
        view: snapshot.view,
        isTerminal: snapshot.isTerminal,
      });
      if (snapshot.isTerminal && snapshot.outcome) {
        client.emit(WS.MATCH_ENDED, {
          matchId,
          outcome: snapshot.outcome,
        });
      }
    });
    existingSubs.set(matchId, off);

    // Emit current view immediately.
    const current = await this.match.getView(matchId, player.id);
    if (current) {
      client.emit(WS.VIEW_UPDATED, {
        matchId,
        version: current.version,
        phase: current.phase,
        currentActors: current.currentActors,
        view: current.view,
        isTerminal: current.isTerminal,
      });
    }
  }

  @SubscribeMessage(WS.SUBMIT_MOVE)
  async submit(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; reason?: string }> {
    const payload = this.parse(submitMovePayload, raw);
    const player = this.resolvePlayerBySocket(client);
    const result = await this.match.submitMove(
      payload.matchId,
      player.id,
      payload.move,
    );
    if (!result.ok) {
      client.emit(WS.ERROR, { code: 'MOVE_REJECTED', message: result.reason });
    }
    return result;
  }

  @SubscribeMessage(WS.LEAVE_MATCH)
  async leave(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: true }> {
    const payload = this.parse(leaveMatchPayload, raw);
    const subs = this.subscriptions.get(client.id);
    const off = subs?.get(payload.matchId);
    if (off) {
      off();
      subs!.delete(payload.matchId);
    }
    await client.leave(`match:${payload.matchId}`);
    return { ok: true };
  }

  // ---- helpers ----

  private parse<T>(schema: ZodSchema<T>, raw: unknown): T {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new WsException({
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      });
    }
    return parsed.data;
  }

  private resolvePlayer(payload: SubscribeMatchPayload): StoredPlayer {
    const player = this.lobby.getPlayerByToken(payload.sessionToken);
    if (!player || player.id !== payload.playerId) {
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: 'Invalid session',
      });
    }
    return player;
  }

  private resolvePlayerBySocket(client: Socket): StoredPlayer {
    const auth = (client.handshake.auth ?? {}) as {
      sessionToken?: string;
      playerId?: string;
    };
    const token = auth.sessionToken ?? '';
    const player = this.lobby.getPlayerByToken(token);
    if (!player) {
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: 'No session on socket',
      });
    }
    return player;
  }
}
