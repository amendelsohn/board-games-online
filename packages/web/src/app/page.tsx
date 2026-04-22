"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameMetaWire } from "@bgo/contracts";
import { api } from "@/lib/apiClient";
import { ensurePlayer, getStoredName, storeName } from "@/lib/playerSession";

export default function Home() {
  const router = useRouter();
  const [games, setGames] = useState<GameMetaWire[] | null>(null);
  const [name, setName] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listGames().then((r) => setGames(r.games)).catch((err) => {
      setError((err as Error).message);
    });
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
    <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-10">
      <section className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-2">
          Board Games Online
        </h1>
        <p className="text-base-content/70 text-lg">
          Quick-play social games with friends. No account needed — pick a name,
          share a code, start playing.
        </p>
      </section>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <section className="grid md:grid-cols-2 gap-6">
        <div className="card bg-base-200 shadow">
          <div className="card-body">
            <h2 className="card-title">Your name</h2>
            <input
              type="text"
              placeholder="Pick a display name"
              className="input input-bordered w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && saveName(name.trim())}
              maxLength={40}
            />
            <p className="text-sm text-base-content/60">
              Other players at your table see this name.
            </p>
          </div>
        </div>

        <div className="card bg-base-200 shadow">
          <div className="card-body">
            <h2 className="card-title">Join a game</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ABCD"
                className="input input-bordered flex-1 uppercase tracking-widest font-mono"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={4}
              />
              <button
                type="button"
                className="btn btn-primary"
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
            <p className="text-sm text-base-content/60">
              Enter the 4-letter code from the host.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Start a new game</h2>
        {games === null ? (
          <div className="flex justify-center py-10">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : games.length === 0 ? (
          <div className="alert alert-info">
            <span>No games installed on this server.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((g) => (
              <button
                key={g.type}
                type="button"
                onClick={() => startNewGame(g.type)}
                disabled={pending !== null}
                className="card bg-base-100 shadow hover:shadow-xl transition-shadow text-left p-6 disabled:opacity-60"
              >
                <div className="card-title mb-2">{g.displayName}</div>
                <div className="text-sm text-base-content/70 mb-4">
                  {g.description}
                </div>
                <div className="flex justify-between items-center">
                  <span className="badge badge-outline">
                    {g.minPlayers === g.maxPlayers
                      ? `${g.minPlayers} players`
                      : `${g.minPlayers}–${g.maxPlayers} players`}
                  </span>
                  {pending === `create:${g.type}` ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <span className="text-primary font-semibold">Start →</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
