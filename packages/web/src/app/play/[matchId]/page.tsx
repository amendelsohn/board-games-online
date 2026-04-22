"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getClientModule } from "@bgo/sdk-client";
import type { TableWire } from "@bgo/contracts";
import { api } from "@/lib/apiClient";
import { ensurePlayer } from "@/lib/playerSession";
import { useMatchSocket } from "@/lib/useMatchSocket";
import { registerAllClientGames } from "@/lib/registerClientGames";

registerAllClientGames();

/**
 * Generic match screen. Resolves the table's game-type → ClientGameModule,
 * renders that module's Board with a WS-backed view.
 */
export default function PlayPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const matchId = typeof params.matchId === "string" ? params.matchId : null;
  const tableId = search.get("table");

  const [player, setPlayer] = useState<{ id: string; name: string } | null>(null);
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

  const { view, phase, currentActors, connectionState, error, sendMove, addEventListener } =
    useMatchSocket({
      matchId,
      playerId: player?.id ?? null,
      sessionToken,
    });

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
  const isMyTurn = currentActors.includes(player.id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-4">
        <div className="text-sm text-base-content/70">
          Match: <span className="font-mono">{matchId.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={[
              "inline-block w-2 h-2 rounded-full",
              connectionState === "connected" ? "bg-success" : "bg-error",
            ].join(" ")}
          />
          <span className="text-base-content/70">{connectionState}</span>
          {phase && <span className="badge badge-ghost">{phase}</span>}
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4 max-w-md">
          <span>{error}</span>
        </div>
      )}

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

      <div className="mt-8">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => router.push("/")}
        >
          Leave match
        </button>
      </div>
    </div>
  );
}
