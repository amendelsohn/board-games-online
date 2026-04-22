"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinTable } from "@/lib/api";
import { Player } from "@/types";

interface JoinGameProps {
  player: Player;
}

export default function JoinGame({ player }: JoinGameProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  const handleJoinGame = async () => {
    if (!joinCode.trim()) {
      setError("Please enter a join code");
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      await joinTable(joinCode.toUpperCase(), player.player_id);
      router.push(`/lobby/${joinCode.toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join game");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-md h-full">
      <div className="card-body">
        <h2 className="card-title">Join Existing Game</h2>

        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Enter 4-letter Join Code:</span>
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="ABCD"
            className="input input-bordered input-primary w-full text-center text-xl tracking-widest uppercase"
          />
        </div>

        <div className="card-actions justify-end mt-4">
          <button
            onClick={handleJoinGame}
            disabled={isJoining || !joinCode.trim()}
            className="btn btn-primary w-full"
          >
            {isJoining ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Joining...
              </>
            ) : (
              "Join Game"
            )}
          </button>
        </div>

        {error && <div className="mt-3 text-error text-sm">{error}</div>}
      </div>
    </div>
  );
}
