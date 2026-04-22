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
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Set<(e: MatchEventPayload["event"]) => void>>(
    new Set(),
  );

  useEffect(() => {
    if (!matchId || !playerId || !sessionToken) return;

    setConnectionState("connecting");
    const socket = io(BASE_WS_URL, {
      transports: ["websocket"],
      auth: { playerId, sessionToken },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("connected");
      setError(null);
      socket.emit(WS.SUBSCRIBE_MATCH, {
        matchId,
        playerId,
        sessionToken,
      });
    });

    socket.on("disconnect", () => setConnectionState("disconnected"));
    socket.on("connect_error", (err) => {
      setConnectionState("error");
      setError(err.message);
    });

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
      socket.emit(WS.LEAVE_MATCH, { matchId });
      socket.disconnect();
      socketRef.current = null;
      setConnectionState("idle");
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
      error,
      sendMove,
      addEventListener,
    ],
  );
}
