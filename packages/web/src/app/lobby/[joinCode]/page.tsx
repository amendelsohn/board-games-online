"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PlayerWire, TableWire } from "@bgo/contracts";
import { getClientModule } from "@bgo/sdk-client";
import { api } from "@/lib/apiClient";
import { ensurePlayer, getStoredName, storeName } from "@/lib/playerSession";
import { registerAllClientGames } from "@/lib/registerClientGames";
import { recordRecentTable } from "@/lib/recentTables";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { JoinCodeDisplay } from "@/components/JoinCodeDisplay";

registerAllClientGames();

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
        recordRecentTable({
          tableId: r.table.id,
          joinCode: r.table.joinCode,
          gameType: r.table.gameType,
        });
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

  const module_ = useMemo(() => {
    if (!table) return null;
    return getClientModule(table.gameType) ?? null;
  }, [table]);

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

  const updateConfig = async (nextConfig: unknown) => {
    if (!table) return;
    try {
      const r = await api.updateConfig(table.id, { config: nextConfig });
      setTable(r.table);
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
      <div className="max-w-md mx-auto mt-16 px-6">
        <div className="surface-ivory p-5 text-error">No join code in URL.</div>
      </div>
    );
  }

  if (error && !table) {
    return (
      <div className="max-w-md mx-auto mt-16 px-6 flex flex-col gap-4">
        <div className="surface-ivory p-5 text-error">{error}</div>
        <button
          className="btn btn-ghost self-start"
          onClick={() => router.push("/")}
        >
          ← Back home
        </button>
      </div>
    );
  }

  if (!table || !me) {
    return <LobbyLoading />;
  }

  const isHost = me.id === table.hostPlayerId;
  const minPlayers = moduleMinPlayers(table.gameType);
  const canStart = isHost && table.players.length >= minPlayers;
  const LobbyPanel = module_?.LobbyPanel;

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 pt-8 md:pt-12 pb-20 flex flex-col gap-12">
      {/* ========== Header: game + code ========== */}
      <section className="flex flex-col items-center gap-5 text-center parlor-rise">
        <div className="rule-ornament">
          <span className="rule-ornament-line" />
          <span>◆ {gameLabel(table.gameType)} ◆</span>
          <span className="rule-ornament-line" />
        </div>
        <h1
          className="font-display"
          style={{ fontSize: "var(--text-display-sm)" }}
        >
          Table's set. Waiting on friends.
        </h1>
        <p className="text-base-content/65 max-w-md">
          Share this code with anyone you'd like to join. Anyone with it can
          walk right in — no account needed.
        </p>
        <div className="mt-2">
          <JoinCodeDisplay code={table.joinCode} />
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="border border-warning/40 bg-warning/10 text-warning-content px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      {/* ========== Players ========== */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-tight">At the table</h2>
          <span className="text-xs tabular uppercase tracking-[0.2em] text-base-content/50">
            {table.players.length} / {minPlayers}
            {minPlayers === 2 ? "+ needed" : " min"}
          </span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {table.players.map((p, i) => (
            <li
              key={p.id}
              className="parlor-rise rise-stagger surface-ivory p-4 flex items-center justify-between gap-3"
              style={{ ["--i" as string]: i }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatar name={p.name} size="md" />
                <div className="min-w-0">
                  <div className="font-display text-lg leading-tight truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-base-content/55 flex items-center gap-2 mt-0.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-success"
                      aria-hidden
                    />
                    {p.id === table.hostPlayerId ? "host" : "player"}
                    {p.id === me.id ? " · you" : ""}
                  </div>
                </div>
              </div>
              {isHost && p.id !== me.id && (
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.18em] text-base-content/45 hover:text-error transition-colors"
                  onClick={() => kick(p.id)}
                >
                  kick
                </button>
              )}
            </li>
          ))}
          {table.players.length < minPlayers && (
            <li
              className="surface-felt p-4 flex items-center gap-3"
              style={{
                borderStyle: "dashed",
              }}
            >
              <div className="h-10 w-10 rounded-full bg-base-300/80 animate-pulse" />
              <span className="text-sm text-base-content/55 italic">
                Waiting for{" "}
                {minPlayers - table.players.length === 1
                  ? "one more"
                  : `${minPlayers - table.players.length} more`}
                …
              </span>
            </li>
          )}
        </ul>
      </section>

      {LobbyPanel && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl tracking-tight">Game setup</h2>
          <div className="surface-ivory p-5 md:p-6">
            <LobbyPanel
              config={table.config ?? {}}
              onChange={updateConfig}
              players={table.players}
              isHost={isHost}
            />
          </div>
        </section>
      )}

      {/* ========== Your name (inline edit) ========== */}
      <section className="surface-felt p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 mb-1">
            You'll appear as
          </div>
          <input
            type="text"
            className="w-full bg-transparent border-0 outline-none font-display text-2xl"
            defaultValue={me.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== me.name) void rename(v);
            }}
            maxLength={40}
          />
        </div>
        <div className="hidden sm:block w-px self-stretch bg-base-300/70" />
        <button
          type="button"
          className="text-xs uppercase tracking-[0.2em] text-base-content/50 hover:text-base-content transition-colors"
          onClick={leave}
        >
          Leave table
        </button>
      </section>

      {/* ========== Start CTA — sticky-feeling footer row ========== */}
      <section className="flex items-center justify-between gap-3 pt-2">
        <div className="text-sm text-base-content/60">
          {canStart
            ? "Everyone's ready when you are."
            : isHost
              ? `Need ${minPlayers - table.players.length} more to begin.`
              : "Waiting for the host to start…"}
        </div>
        {isHost && (
          <button
            type="button"
            className={[
              "btn btn-primary",
              "px-7 rounded-full font-semibold tracking-wide",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
            disabled={!canStart}
            onClick={start}
          >
            Begin →
          </button>
        )}
      </section>
    </div>
  );
}

function LobbyLoading() {
  return (
    <div className="max-w-md mx-auto mt-24 px-6 flex flex-col items-center gap-4">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-primary"
            style={{
              animation: "parlorWinPulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
      <div className="text-sm text-base-content/60 uppercase tracking-[0.2em]">
        Setting the table…
      </div>
    </div>
  );
}

function gameLabel(type: string): string {
  if (type === "tic-tac-toe") return "Tic-Tac-Toe";
  if (type === "connect-four") return "Connect Four";
  if (type === "codenames") return "Codenames";
  if (type === "spyfall") return "Spyfall";
  return type;
}

function moduleMinPlayers(type: string): number {
  if (type === "codenames") return 4;
  if (type === "spyfall") return 3;
  return 2;
}

