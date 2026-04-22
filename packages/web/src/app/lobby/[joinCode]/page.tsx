"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PlayerWire, TableWire } from "@bgo/contracts";
import { api } from "@/lib/apiClient";
import { ensurePlayer, getStoredName, storeName } from "@/lib/playerSession";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";

const POLL_INTERVAL_MS = 2000;

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const joinCode =
    typeof params.joinCode === "string" ? params.joinCode.toUpperCase() : null;

  const [table, setTable] = useState<TableWire | null>(null);
  const [me, setMe] = useState<PlayerWire | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePoll = useCallback(
    (tableId: string) => {
      if (pollRef.current) clearTimeout(pollRef.current);
      const tick = async () => {
        try {
          const r = await api.getTable(tableId);
          setTable(r.table);
          if (r.table.status === "playing" && r.table.matchId) {
            router.push(`/play/${r.table.matchId}?table=${r.table.id}`);
            return;
          }
        } catch (err) {
          setError((err as Error).message);
        }
        pollRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      };
      pollRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    },
    [router],
  );

  useEffect(() => {
    if (!joinCode) return;
    let cancelled = false;

    (async () => {
      try {
        const session = await ensurePlayer(getStoredName() ?? undefined);
        if (cancelled) return;
        setMe(session.player);

        const r = await api.joinTable(joinCode);
        if (cancelled) return;
        setTable(r.table);
        schedulePoll(r.table.id);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [joinCode, schedulePoll]);

  const start = async () => {
    if (!table) return;
    try {
      const r = await api.startTable(table.id);
      if (r.table.matchId) {
        router.push(`/play/${r.table.matchId}?table=${r.table.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const kick = async (targetId: string) => {
    if (!table) return;
    try {
      const r = await api.kickPlayer(table.id, { playerId: targetId });
      setTable(r.table);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const rename = async (newName: string) => {
    try {
      await api.updateMe({ name: newName });
      storeName(newName);
      setMe((m) => (m ? { ...m, name: newName } : m));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const leave = async () => {
    if (!table) return;
    try {
      await api.leaveTable(table.id);
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!joinCode) {
    return (
      <div className="alert alert-error max-w-md mx-auto mt-10">
        <span>No join code in URL</span>
      </div>
    );
  }

  if (error && !table) {
    return (
      <div className="max-w-md mx-auto mt-10 flex flex-col gap-4">
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
        <button className="btn" onClick={() => router.push("/")}>
          Back home
        </button>
      </div>
    );
  }

  if (!table || !me) {
    return (
      <div className="flex justify-center items-center mt-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const isHost = me.id === table.hostPlayerId;
  const canStart = isHost && table.players.length >= 2;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-8">
      <section className="text-center flex flex-col items-center gap-4">
        <div className="text-sm text-base-content/60 uppercase tracking-widest">
          Share this code with your friends
        </div>
        <JoinCodeDisplay code={table.joinCode} />
        <div className="text-base-content/70">
          Playing{" "}
          <span className="font-semibold">{gameLabel(table.gameType)}</span>
        </div>
      </section>

      {error && (
        <div className="alert alert-warning">
          <span>{error}</span>
        </div>
      )}

      <section>
        <div className="flex justify-between items-end mb-3">
          <h2 className="text-xl font-bold">Players</h2>
          <span className="text-sm text-base-content/60">
            {table.players.length}{" "}
            {table.players.length === 1 ? "player" : "players"}
          </span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {table.players.map((p) => (
            <li
              key={p.id}
              className="card bg-base-200/60 border border-base-300"
            >
              <div className="card-body p-4 flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar name={p.name} size="md" />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-base-content/60 flex gap-1">
                      {p.id === table.hostPlayerId && (
                        <span className="badge badge-primary badge-xs">
                          host
                        </span>
                      )}
                      {p.id === me.id && (
                        <span className="badge badge-ghost badge-xs">you</span>
                      )}
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
                    </div>
                  </div>
                </div>
                {isHost && p.id !== me.id && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => kick(p.id)}
                  >
                    kick
                  </button>
                )}
              </div>
            </li>
          ))}
          {table.players.length < 2 && (
            <li className="card bg-base-100 border border-dashed border-base-300 animate-pulse">
              <div className="card-body p-4 flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-base-300" />
                <div className="text-base-content/50 text-sm">
                  Waiting for another player…
                </div>
              </div>
            </li>
          )}
        </ul>
      </section>

      <section className="card bg-base-200/60 border border-base-300">
        <div className="card-body gap-2">
          <h2 className="card-title text-base">Your name</h2>
          <input
            type="text"
            className="input input-bordered"
            defaultValue={me.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== me.name) void rename(v);
            }}
            maxLength={40}
          />
        </div>
      </section>

      <div className="flex justify-between items-center">
        <button type="button" className="btn btn-ghost" onClick={leave}>
          Leave
        </button>
        {isHost ? (
          <button
            type="button"
            className="btn btn-primary btn-wide"
            disabled={!canStart}
            onClick={start}
          >
            {canStart
              ? "Start game"
              : `Need ${2 - table.players.length} more player${2 - table.players.length === 1 ? "" : "s"}`}
          </button>
        ) : (
          <div className="text-sm text-base-content/60">
            Waiting for the host to start…
          </div>
        )}
      </div>
    </div>
  );
}

function gameLabel(type: string): string {
  if (type === "tic-tac-toe") return "Tic-Tac-Toe";
  if (type === "connect-four") return "Connect Four";
  return type;
}
