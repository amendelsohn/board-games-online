"use client";

import React from "react";
import { Player } from "@/types";

interface PlayerStatsProps {
  player: Player;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
}

export default function PlayerStats({
  player,
  gamesPlayed = 0,
  wins = 0,
  losses = 0,
}: PlayerStatsProps) {
  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <div className="flex items-center gap-4 mb-4">
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-12">
              <span className="text-xl">
                {player.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div>
            <h2 className="card-title">{player.name}</h2>
            <p className="text-sm opacity-70">
              Player since {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="stats shadow">
          <div className="stat">
            <div className="stat-figure text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Games Played</div>
            <div className="stat-value text-primary">{gamesPlayed}</div>
          </div>

          <div className="stat">
            <div className="stat-figure text-success">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Wins</div>
            <div className="stat-value text-success">{wins}</div>
            <div className="stat-desc">
              {gamesPlayed > 0
                ? `${Math.round((wins / gamesPlayed) * 100)}%`
                : "0%"}
            </div>
          </div>

          <div className="stat">
            <div className="stat-figure text-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="inline-block w-8 h-8 stroke-current"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                ></path>
              </svg>
            </div>
            <div className="stat-title">Losses</div>
            <div className="stat-value text-error">{losses}</div>
            <div className="stat-desc">
              {gamesPlayed > 0
                ? `${Math.round((losses / gamesPlayed) * 100)}%`
                : "0%"}
            </div>
          </div>
        </div>

        <div className="divider"></div>

        <div className="card-actions">
          <div className="badge badge-outline">Casual Player</div>
          <div className="badge badge-outline">Tic-Tac-Toe</div>
        </div>
      </div>
    </div>
  );
}
