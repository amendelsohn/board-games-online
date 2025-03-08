"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTable, getPlayer, startGame } from "@/lib/api";
import { Player, Table, TableStatus } from "@/types";
import styles from "./Lobby.module.css";

interface GameLobbyProps {
  joinCode: string;
  currentPlayer: Player;
}

export default function GameLobby({ joinCode, currentPlayer }: GameLobbyProps) {
  const router = useRouter();
  const [table, setTable] = useState<Table | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  // Load table data
  useEffect(() => {
    const fetchTableData = async () => {
      try {
        console.log("Fetching table data for join code:", joinCode);
        const tableData = await getTable(joinCode);
        console.log("Table data received:", tableData);
        setTable(tableData);

        // If game has started, redirect to game
        if (tableData.status === TableStatus.PLAYING) {
          router.push(
            `/games/${tableData.game_type}?table=${tableData.table_id}`
          );
          return;
        }

        // Fetch player data
        const playerPromises = tableData.player_ids.map((id) => getPlayer(id));
        const playerData = await Promise.all(playerPromises);
        console.log("Player data received:", playerData);
        setPlayers(playerData);
      } catch (err) {
        console.error("Error fetching table data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load game lobby"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchTableData();

    // Set up polling to refresh data
    const interval = setInterval(fetchTableData, 5000);
    setPollingInterval(interval);

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [joinCode, router]);

  const handleStartGame = async () => {
    if (!table) return;

    setIsStarting(true);
    setError("");

    try {
      await startGame(table.table_id, currentPlayer.player_id);
      router.push(`/games/${table.game_type}?table=${table.table_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
      setIsStarting(false);
    }
  };

  const isHost = table?.host_player_id === currentPlayer.player_id;

  if (isLoading) {
    return <div className={styles.loading}>Loading game lobby...</div>;
  }

  if (!table) {
    return (
      <div className={styles.error}>
        <p>Game not found or has been removed.</p>
        <Link href="/" className={styles.link}>
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.gameLobbyContainer}>
      <h2>Game Lobby</h2>

      <div className={styles.lobbyInfo}>
        <p>
          <strong>Join Code:</strong> {table.join_code}
        </p>
        <p>
          <strong>Game Type:</strong> {table.game_type}
        </p>
        <p>
          <strong>Status:</strong> {table.status}
        </p>
      </div>

      <div className={styles.playersContainer}>
        <h3>Players in Lobby:</h3>
        <ul className={styles.playersList}>
          {players.map((player) => (
            <li key={player.player_id} className={styles.playerItem}>
              {player.name}{" "}
              {player.player_id === table.host_player_id && (
                <span className={styles.hostBadge}>Host</span>
              )}
              {player.player_id === currentPlayer.player_id && (
                <span className={styles.youBadge}>You</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <div className={styles.hostControls}>
          <button
            onClick={handleStartGame}
            disabled={isStarting || players.length < 2}
            className={styles.button}
          >
            {isStarting ? "Starting Game..." : "Start Game"}
          </button>

          {players.length < 2 && (
            <p className={styles.hint}>Need at least 2 players to start</p>
          )}
        </div>
      )}

      {!isHost && (
        <p className={styles.waitingMessage}>
          Waiting for the host to start the game...
        </p>
      )}

      <div className={styles.shareInfo}>
        <h3>Invite Friends</h3>
        <p>
          Share this join code with friends: <strong>{table.join_code}</strong>
        </p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <Link href="/" className={styles.backLink}>
        Leave Lobby
      </Link>
    </div>
  );
}
