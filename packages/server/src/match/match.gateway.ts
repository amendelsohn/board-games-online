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
  type SubmitMovePayload,
} from '@bgo/contracts';
import type { PlayerId } from '@bgo/sdk';
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

  /**
   * Per-socket move timestamps for sliding-window rate limiting. Capped at
   * MOVE_RATE_MAX entries and pruned on every check; memory is O(sockets ×
   * MOVE_RATE_MAX) which for any realistic traffic is tiny.
   */
  private readonly moveTimestamps = new Map<string, number[]>();

  /** Max moves allowed per MOVE_RATE_WINDOW_MS per socket. */
  private static readonly MOVE_RATE_MAX = 10;
  private static readonly MOVE_RATE_WINDOW_MS = 1_000;

  /** Reject move payloads larger than this to shed abuse cheaply. */
  private static readonly MOVE_PAYLOAD_MAX_BYTES = 8_192;

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
    this.moveTimestamps.delete(client.id);
  }

  @SubscribeMessage(WS.SUBSCRIBE_MATCH)
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ): Promise<void> {
    const payload = this.parse(subscribeMatchPayload, raw);
    const sessionPlayer = this.resolvePlayer(payload);
    const viewerId = this.resolveViewer(sessionPlayer.id, payload);

    const matchId = payload.matchId;
    const existingSubs = this.subscriptions.get(client.id)!;
    if (existingSubs.has(matchId)) return; // already subscribed

    await client.join(`match:${matchId}`);
    await client.join(`player:${matchId}:${viewerId}`);

    const off = this.match.subscribeViews(matchId, viewerId, (snapshot) => {
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
    const current = await this.match.getView(matchId, viewerId);
    if (current) {
      client.emit(WS.VIEW_UPDATED, {
        matchId,
        version: current.version,
        phase: current.phase,
        currentActors: current.currentActors,
        view: current.view,
        isTerminal: current.isTerminal,
      });
      // If the match is already terminal (e.g. the client is reconnecting
      // after disconnect), also replay match_ended so downstream UI can
      // render the summary.
      if (current.isTerminal && current.outcome) {
        client.emit(WS.MATCH_ENDED, {
          matchId,
          outcome: current.outcome,
        });
      }
    }
  }

  @SubscribeMessage(WS.SUBMIT_MOVE)
  async submit(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; reason?: string }> {
    // Cheap size guard — rejects abusive payloads before we spend cycles on
    // Zod validation or state lookup.
    const size = raw === undefined ? 0 : JSON.stringify(raw).length;
    if (size > MatchGateway.MOVE_PAYLOAD_MAX_BYTES) {
      const reason = `Move payload too large (${size} > ${MatchGateway.MOVE_PAYLOAD_MAX_BYTES} bytes)`;
      client.emit(WS.ERROR, { code: 'PAYLOAD_TOO_LARGE', message: reason });
      return { ok: false, reason };
    }

    // Per-socket sliding-window rate limit. Returns structured error but
    // leaves the socket connected so legitimate play recovers naturally.
    if (!this.allowMoveForSocket(client.id)) {
      const reason = `Rate limit exceeded (max ${MatchGateway.MOVE_RATE_MAX}/${MatchGateway.MOVE_RATE_WINDOW_MS}ms)`;
      client.emit(WS.ERROR, { code: 'RATE_LIMITED', message: reason });
      return { ok: false, reason };
    }

    const payload = this.parse(submitMovePayload, raw);
    const sessionPlayer = this.resolvePlayerBySocket(client);
    const actor = this.resolveActor(sessionPlayer.id, payload);
    const result = await this.match.submitMove(
      payload.matchId,
      actor,
      payload.move,
    );
    if (!result.ok) {
      client.emit(WS.ERROR, { code: 'MOVE_REJECTED', message: result.reason });
    }
    return result;
  }

  private allowMoveForSocket(socketId: string): boolean {
    const now = Date.now();
    const windowStart = now - MatchGateway.MOVE_RATE_WINDOW_MS;
    const ts = this.moveTimestamps.get(socketId) ?? [];
    // Drop timestamps older than the window.
    while (ts.length > 0 && ts[0]! < windowStart) ts.shift();
    if (ts.length >= MatchGateway.MOVE_RATE_MAX) return false;
    ts.push(now);
    this.moveTimestamps.set(socketId, ts);
    return true;
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

  /** True when the server is *not* running a production build. */
  private isDevMode(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  /**
   * Dev-only: subscribe as any seated player so a single browser can switch
   * between perspectives. In prod the override is silently ignored and the
   * viewer is pinned to the session player.
   */
  private resolveViewer(
    sessionPlayerId: PlayerId,
    payload: SubscribeMatchPayload,
  ): PlayerId {
    if (!payload.viewerId) return sessionPlayerId;
    if (!this.isDevMode()) return sessionPlayerId;
    if (payload.viewerId === sessionPlayerId) return sessionPlayerId;
    const table = this.match.getMatchTable(payload.matchId);
    if (!table || !this.isParticipant(table, payload.viewerId)) {
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: 'viewerId is not in this match',
      });
    }
    return payload.viewerId;
  }

  /**
   * Dev-only: submit moves as any seated player (or the Storyteller). In
   * prod the override is silently ignored and the actor is pinned to the
   * session player.
   */
  private resolveActor(
    sessionPlayerId: PlayerId,
    payload: SubmitMovePayload,
  ): PlayerId {
    if (!payload.actor) return sessionPlayerId;
    if (!this.isDevMode()) return sessionPlayerId;
    if (payload.actor === sessionPlayerId) return sessionPlayerId;
    const table = this.match.getMatchTable(payload.matchId);
    if (!table || !this.isParticipant(table, payload.actor)) {
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: 'actor is not in this match',
      });
    }
    return payload.actor;
  }

  private isParticipant(
    table: { playerIds: PlayerId[] },
    id: PlayerId,
  ): boolean {
    return table.playerIds.includes(id);
  }
}
