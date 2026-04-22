"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getClientModule } from "@bgo/sdk-client";
import type { PlayerWire, TableWire } from "@bgo/contracts";
import { api } from "@/lib/apiClient";
import { ensurePlayer } from "@/lib/playerSession";
import { useMatchSocket } from "@/lib/useMatchSocket";
import { registerAllClientGames } from "@/lib/registerClientGames";
import { PlayerAvatar } from "@/components/PlayerAvatar";

registerAllClientGames();

export default function PlayPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const matchId = typeof params.matchId === "string" ? params.matchId : null;
  const tableId = search.get("table");

  const [player, setPlayer] = useState<PlayerWire | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [table, setTable] = useState<TableWire | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await ensurePlayer();
        if (cancelled) return;
        setPlayer(session.player);
        setSessionToken(session.sessionToken);

        if (tableId) {
          const tbl = await api.getTable(tableId);
          if (!cancelled) setTable(tbl.table);
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  const socketState = useMatchSocket({
    matchId,
    playerId: player?.id ?? null,
    sessionToken,
  });
  const {
    view,
    phase,
    currentActors,
    connectionState,
    error,
    sendMove,
    addEventListener,
    isTerminal,
    outcome,
  } = socketState;

  const module_ = useMemo(() => {
    if (!table) return null;
    return getClientModule(table.gameType) ?? null;
  }, [table]);

  if (loadError) {
    return (
      <div className="alert alert-error max-w-md mx-auto mt-10">
        <span>{loadError}</span>
      </div>
    );
  }

  if (!matchId || !tableId) {
    return (
      <div className="alert alert-warning max-w-md mx-auto mt-10">
        <span>Missing match or table identifier.</span>
      </div>
    );
  }

  if (!table || !player || !sessionToken) {
    return (
      <div className="flex justify-center items-center mt-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!module_) {
    return (
      <div className="alert alert-error max-w-md mx-auto mt-10">
        <span>Unknown game type: {table.gameType}</span>
      </div>
    );
  }

  if (connectionState === "connecting" || !view) {
    return (
      <div className="flex flex-col items-center gap-4 mt-20">
        <span className="loading loading-spinner loading-lg" />
        <div className="text-base-content/70">Connecting to match…</div>
      </div>
    );
  }

  const Board = module_.Board;
  const Summary = module_.Summary;
  const isMyTurn = currentActors.includes(player.id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <MatchHeader
        gameType={table.gameType}
        players={table.players}
        currentActors={currentActors}
        me={player.id}
        phase={phase}
        connected={connectionState === "connected"}
      />

      {error && (
        <div className="alert alert-warning my-4">
          <span>{error}</span>
        </div>
      )}

      {isTerminal && outcome && (
        <OutcomeBanner
          outcome={outcome}
          me={player.id}
          players={table.players}
        />
      )}

      <div className="flex flex-col items-center mt-6">
        <Board
          view={view}
          phase={phase ?? "unknown"}
          me={player.id}
          players={table.players}
          isMyTurn={isMyTurn}
          sendMove={sendMove}
          onEvent={addEventListener}
          latencyMs={0}
        />
      </div>

      {isTerminal && Summary && outcome && (
        <div className="mt-8">
          <Summary view={view} outcome={outcome} />
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push("/")}
        >
          Back to home
        </button>
      </div>
    </div>
  );
}

function MatchHeader({
  gameType,
  players,
  currentActors,
  me,
  phase,
  connected,
}: {
  gameType: string;
  players: PlayerWire[];
  currentActors: string[];
  me: string;
  phase: string | null;
  connected: boolean;
}) {
  return (
    <div className="card bg-base-200/60 border border-base-300">
      <div className="card-body p-4 gap-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="badge badge-primary">{gameLabel(gameType)}</span>
            {phase && (
              <span className="badge badge-ghost">{phaseLabel(phase)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-base-content/70">
            <span
              className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-success" : "bg-error"}`}
              aria-label={connected ? "connected" : "disconnected"}
            />
            {connected ? "connected" : "disconnected"}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          {players.map((p) => {
            const isActive = currentActors.includes(p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${
                  isActive
                    ? "bg-primary/10 ring-1 ring-primary"
                    : "bg-base-100"
                }`}
              >
                <PlayerAvatar name={p.name} size="sm" />
                <div className="text-sm">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-base-content/60">
                    {p.id === me ? "you" : ""}
                  </div>
                </div>
                {isActive && (
                  <span className="badge badge-primary badge-xs ml-1">
                    turn
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OutcomeBanner({
  outcome,
  me,
  players,
}: {
  outcome: { kind: string; winners?: string[]; losers?: string[] };
  me: string;
  players: PlayerWire[];
}) {
  let heading = "Game over";
  let sub = "";
  let tone = "alert-info";
  if (outcome.kind === "draw") {
    heading = "Draw!";
    sub = "No winner this time.";
    tone = "alert-info";
  } else if (outcome.kind === "solo" && outcome.winners) {
    const winnerId = outcome.winners[0];
    const winner = players.find((p) => p.id === winnerId);
    if (winnerId === me) {
      heading = "You win!";
      tone = "alert-success";
    } else {
      heading = `${winner?.name ?? "Opponent"} wins`;
      tone = "alert-warning";
    }
  }
  return (
    <div className={`alert ${tone} my-4`}>
      <div>
        <div className="font-bold text-lg">{heading}</div>
        {sub && <div className="text-sm opacity-80">{sub}</div>}
      </div>
    </div>
  );
}

function gameLabel(type: string): string {
  if (type === "tic-tac-toe") return "Tic-Tac-Toe";
  if (type === "connect-four") return "Connect Four";
  return type;
}

function phaseLabel(phase: string): string {
  if (phase === "play") return "In progress";
  if (phase === "gameOver") return "Finished";
  return phase;
}
