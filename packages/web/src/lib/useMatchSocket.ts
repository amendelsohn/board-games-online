"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  MatchEndedPayload,
  MatchEventPayload,
  PhaseChangedPayload,
  ViewUpdatedPayload,
  WsErrorPayload,
} from "@bgo/contracts";
import { WS } from "@bgo/contracts";
import { BASE_WS_URL } from "./apiClient";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface MatchSocketState<V = unknown> {
  view: V | null;
  phase: string | null;
  currentActors: string[];
  version: number;
  isTerminal: boolean;
  outcome: MatchEndedPayload["outcome"] | null;
  connectionState: ConnectionState;
  /** Number of reconnection attempts since the last successful connect. */
  reconnectAttempt: number;
  error: string | null;
  sendMove: (move: unknown) => Promise<void>;
  addEventListener: (fn: (event: MatchEventPayload["event"]) => void) => () => void;
}

export interface UseMatchSocketOptions {
  matchId: string | null;
  playerId: string | null;
  sessionToken: string | null;
}

/**
 * Subscribes a client to a live match over WebSocket. Emits the per-player
 * `view` returned by the server's GameModule.view() projection on every
 * state change. Unmounts cleanly; safe to toggle matchId.
 *
 * Resilience: socket.io's built-in manager handles reconnection with
 * exponential backoff + jitter (configured below: 1s → 30s cap, ±50%
 * randomization, unlimited attempts). On each successful (re)connect we
 * re-emit SUBSCRIBE_MATCH so the server replays the current view.
 */
export function useMatchSocket<V = unknown>({
  matchId,
  playerId,
  sessionToken,
}: UseMatchSocketOptions): MatchSocketState<V> {
  const [view, setView] = useState<V | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [currentActors, setCurrentActors] = useState<string[]>([]);
  const [version, setVersion] = useState(-1);
  const [isTerminal, setIsTerminal] = useState(false);
  const [outcome, setOutcome] =
    useState<MatchEndedPayload["outcome"] | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Set<(e: MatchEventPayload["event"]) => void>>(
    new Set(),
  );

  useEffect(() => {
    if (!matchId || !playerId || !sessionToken) return;

    setConnectionState("connecting");
    setReconnectAttempt(0);
    const socket = io(BASE_WS_URL, {
      transports: ["websocket"],
      auth: { playerId, sessionToken },
      // Exponential backoff with jitter, capped at 30s. Unlimited retries —
      // the user can leave the page to abort.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
      timeout: 10_000,
    });
    socketRef.current = socket;

    // Both the initial handshake and every reconnect fire `connect`.
    // Re-emitting subscribe_match lets the server replay the current view.
    socket.on("connect", () => {
      setConnectionState("connected");
      setReconnectAttempt(0);
      setError(null);
      socket.emit(WS.SUBSCRIBE_MATCH, {
        matchId,
        playerId,
        sessionToken,
      });
    });

    socket.on("disconnect", (reason) => {
      // "io client disconnect" = we called socket.disconnect() ourselves;
      // anything else means the transport dropped and the manager will retry.
      if (reason === "io client disconnect") {
        setConnectionState("idle");
      } else {
        setConnectionState("reconnecting");
      }
    });

    socket.on("connect_error", (err) => {
      // First failed handshake — manager will keep retrying. Surface the
      // reason once so the UI can show something useful.
      setError(err.message);
      setConnectionState((s) => (s === "reconnecting" ? s : "reconnecting"));
    });

    // Manager-level events (reconnection state machine).
    const manager = socket.io;
    const onReconnectAttempt = (attempt: number) => {
      setConnectionState("reconnecting");
      setReconnectAttempt(attempt);
    };
    const onReconnect = () => {
      // Followed by `connect` on the socket, which will flip us to "connected".
      setReconnectAttempt(0);
    };
    const onReconnectFailed = () => {
      setConnectionState("error");
      setError("Could not reconnect to match.");
    };
    manager.on("reconnect_attempt", onReconnectAttempt);
    manager.on("reconnect", onReconnect);
    manager.on("reconnect_failed", onReconnectFailed);

    socket.on(WS.VIEW_UPDATED, (payload: ViewUpdatedPayload) => {
      if (payload.matchId !== matchId) return;
      setView(payload.view as V);
      setPhase(payload.phase);
      setCurrentActors(payload.currentActors);
      setVersion(payload.version);
      setIsTerminal(payload.isTerminal);
    });
    socket.on(WS.PHASE_CHANGED, (payload: PhaseChangedPayload) => {
      if (payload.matchId !== matchId) return;
      setPhase(payload.phase);
    });
    socket.on(WS.MATCH_EVENT, (payload: MatchEventPayload) => {
      if (payload.matchId !== matchId) return;
      for (const fn of listenersRef.current) fn(payload.event);
    });
    socket.on(WS.MATCH_ENDED, (payload: MatchEndedPayload) => {
      if (payload.matchId !== matchId) return;
      setOutcome(payload.outcome);
      setIsTerminal(true);
    });
    socket.on(WS.ERROR, (payload: WsErrorPayload) => {
      setError(payload.message);
    });

    return () => {
      // Leave cleanly if we're actually connected; otherwise just shut down
      // the manager so any pending reconnect timer is cancelled.
      if (socket.connected) {
        socket.emit(WS.LEAVE_MATCH, { matchId });
      }
      manager.off("reconnect_attempt", onReconnectAttempt);
      manager.off("reconnect", onReconnect);
      manager.off("reconnect_failed", onReconnectFailed);
      socket.disconnect();
      socketRef.current = null;
      setConnectionState("idle");
      setReconnectAttempt(0);
    };
  }, [matchId, playerId, sessionToken]);

  const sendMove = useCallback(
    async (move: unknown) => {
      const socket = socketRef.current;
      if (!socket || socket.disconnected) {
        throw new Error("Not connected");
      }
      if (!matchId) throw new Error("No match");
      await new Promise<void>((resolve, reject) => {
        socket
          .timeout(5000)
          .emit(
            WS.SUBMIT_MOVE,
            { matchId, move },
            (err: Error | null, ack: { ok: boolean; reason?: string }) => {
              if (err) return reject(err);
              if (!ack?.ok) return reject(new Error(ack?.reason ?? "Move rejected"));
              resolve();
            },
          );
      });
    },
    [matchId],
  );

  const addEventListener = useCallback(
    (fn: (e: MatchEventPayload["event"]) => void) => {
      listenersRef.current.add(fn);
      return () => listenersRef.current.delete(fn);
    },
    [],
  );

  return useMemo(
    () => ({
      view,
      phase,
      currentActors,
      version,
      isTerminal,
      outcome,
      connectionState,
      reconnectAttempt,
      error,
      sendMove,
      addEventListener,
    }),
    [
      view,
      phase,
      currentActors,
      version,
      isTerminal,
      outcome,
      connectionState,
      reconnectAttempt,
      error,
      sendMove,
      addEventListener,
    ],
  );
}
