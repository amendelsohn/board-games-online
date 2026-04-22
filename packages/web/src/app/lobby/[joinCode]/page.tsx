"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { TableWire } from "@bgo/contracts";
import { api } from "@/lib/apiClient";
import { ensurePlayer, getStoredName, storeName } from "@/lib/playerSession";

const POLL_INTERVAL_MS = 2000;

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const joinCode =
    typeof params.joinCode === "string" ? params.joinCode.toUpperCase() : null;

  const [table, setTable] = useState<TableWire | null>(null);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  const copyCode = () => {
    if (!joinCode) return;
    void navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-sm text-base-content/60">Join code</div>
              <div className="text-6xl font-mono font-bold tracking-widest">
                {table.joinCode}
              </div>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="btn btn-primary btn-sm"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="text-base-content/70 mt-2">
            Playing: <span className="font-semibold">{table.gameType}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning">
          <span>{error}</span>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold mb-2">
          Players ({table.players.length})
        </h2>
        <ul className="menu bg-base-200 rounded-box">
          {table.players.map((p) => (
            <li key={p.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.id === table.hostPlayerId && (
                    <span className="badge badge-primary badge-sm">host</span>
                  )}
                  {p.id === me.id && (
                    <span className="badge badge-ghost badge-sm">you</span>
                  )}
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
        </ul>
      </div>

      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">Your name</h2>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              defaultValue={me.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== me.name) void rename(v);
              }}
              maxLength={40}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button type="button" className="btn btn-ghost" onClick={leave}>
          Leave
        </button>
        {isHost && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canStart}
            onClick={start}
          >
            Start game
          </button>
        )}
      </div>
    </div>
  );
}
