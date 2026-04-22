"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameMetaWire } from "@bgo/contracts";
import { api } from "@/lib/apiClient";
import { ensurePlayer, getStoredName, storeName } from "@/lib/playerSession";
import { GameIcon } from "@/components/GameIcon";

export default function Home() {
  const router = useRouter();
  const [games, setGames] = useState<GameMetaWire[] | null>(null);
  const [name, setName] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listGames()
      .then((r) => setGames(r.games))
      .catch((err) => setError((err as Error).message));
    setName(getStoredName() ?? "");
  }, []);

  const saveName = async (n: string) => {
    storeName(n);
    try {
      await api.updateMe({ name: n });
    } catch {
      // no session yet — will be set on first createPlayer
    }
  };

  const startNewGame = async (gameType: string) => {
    setError(null);
    setPending(`create:${gameType}`);
    try {
      const playerName = name.trim() || getStoredName() || undefined;
      await ensurePlayer(playerName);
      if (playerName) await saveName(playerName);
      const { table } = await api.createTable({ gameType });
      router.push(`/lobby/${table.joinCode}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(null);
    }
  };

  const joinExisting = async () => {
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) {
      setError("Join code must be 4 letters");
      return;
    }
    setPending("join");
    try {
      const playerName = name.trim() || getStoredName() || undefined;
      await ensurePlayer(playerName);
      if (playerName) await saveName(playerName);
      const { table } = await api.joinTable(code);
      router.push(`/lobby/${table.joinCode}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 md:py-16 flex flex-col gap-12">
      <section className="text-center flex flex-col items-center gap-4">
        <div className="badge badge-primary badge-outline">
          Real-time · no signups · play instantly
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
          Board games,{" "}
          <span className="text-primary">right in your browser</span>.
        </h1>
        <p className="text-base-content/70 text-lg md:text-xl max-w-2xl">
          Pick a game, share a 4-letter code, and play with anyone in seconds.
        </p>
      </section>

      {error && (
        <div className="alert alert-error max-w-2xl mx-auto">
          <span>{error}</span>
        </div>
      )}

      <section className="grid md:grid-cols-2 gap-4 max-w-3xl w-full mx-auto">
        <div className="card bg-base-200/60 border border-base-300">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Your display name</h2>
            <input
              type="text"
              placeholder="How should others see you?"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && saveName(name.trim())}
              maxLength={40}
            />
          </div>
        </div>

        <div className="card bg-base-200/60 border border-base-300">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Have a code?</h2>
            <div className="join w-full">
              <input
                type="text"
                placeholder="ABCD"
                className="input input-bordered join-item flex-1 uppercase tracking-[0.3em] font-mono text-center"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void joinExisting();
                }}
                maxLength={4}
              />
              <button
                type="button"
                className="btn btn-primary join-item"
                onClick={joinExisting}
                disabled={pending !== null}
              >
                {pending === "join" ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Join"
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl md:text-3xl font-bold">Start a new game</h2>
          {games && games.length > 0 && (
            <span className="text-sm text-base-content/60">
              {games.length} game{games.length === 1 ? "" : "s"} available
            </span>
          )}
        </div>
        {games === null ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : games.length === 0 ? (
          <div className="alert alert-info">
            <span>No games installed on this server yet.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {games.map((g) => (
              <button
                key={g.type}
                type="button"
                onClick={() => startNewGame(g.type)}
                disabled={pending !== null}
                className="group card bg-base-100 border border-base-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all text-left disabled:opacity-60 disabled:pointer-events-none"
              >
                <div className="card-body gap-3">
                  <GameIcon type={g.type} />
                  <div>
                    <div className="card-title text-xl">{g.displayName}</div>
                    <div className="text-sm text-base-content/70 mt-1">
                      {g.description}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="badge badge-outline">
                      {g.minPlayers === g.maxPlayers
                        ? `${g.minPlayers} players`
                        : `${g.minPlayers}–${g.maxPlayers} players`}
                    </span>
                    {pending === `create:${g.type}` ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <span className="text-primary font-semibold group-hover:translate-x-1 transition-transform">
                        Start →
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <Step n={1} title="Pick a game">
          Choose from the catalog above. Each game runs in its own module.
        </Step>
        <Step n={2} title="Share the code">
          You'll get a 4-letter code. Send it to friends — no accounts needed.
        </Step>
        <Step n={3} title="Play in real-time">
          Every move syncs instantly over WebSockets. Play from any device.
        </Step>
      </section>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card bg-base-100/60 border border-base-300">
      <div className="card-body gap-2">
        <div className="flex items-center gap-2 text-primary font-bold">
          <span className="w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm">
            {n}
          </span>
          <span>{title}</span>
        </div>
        <p className="text-sm text-base-content/70">{children}</p>
      </div>
    </div>
  );
}
