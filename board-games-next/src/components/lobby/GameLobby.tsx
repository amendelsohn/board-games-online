"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTable, getPlayer, startGame } from "@/lib/api";
import { Player, Table, TableStatus } from "@/types";
import styles from "./Lobby.module.css";
import { useGameSession } from "@/lib/hooks/useGameSession";

interface GameLobbyProps {
  joinCode: string;
}

export default function GameLobby({ joinCode }: GameLobbyProps) {
  const router = useRouter();
  const [table, setTable] = useState<Table | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [tableError, setTableError] = useState("");

  // Use our custom hook for player session and game state
  const {
    player: currentPlayer,
    isLoadingPlayer,
    playerError,
    isReady,
  } = useGameSession(table?.table_id || "", {
    // Don't poll for game state yet, we're just using this for player session
    pollingInterval: 0,
  });

  // Load table data
  useEffect(() => {
    console.log(`GameLobby: Initializing for join code ${joinCode}`);

    const fetchTableData = async () => {
      try {
        console.log(`GameLobby: Fetching table data for join code ${joinCode}`);
        const tableData = await getTable(joinCode);
        console.log(`GameLobby: Table data received:`, tableData);
        setTable(tableData);

        // If game has started, redirect to game
        if (tableData.status === TableStatus.PLAYING) {
          console.log(`GameLobby: Game has started, redirecting to game page`);
          router.push(
            `/games/${tableData.game_type}?table=${tableData.table_id}`
          );
          return;
        }

        // Fetch player data
        const playerPromises = tableData.player_ids.map((id) => getPlayer(id));
        const playerData = await Promise.all(playerPromises);
        console.log(`GameLobby: Player data received:`, playerData);
        setPlayers(playerData);
      } catch (err) {
        console.error(`GameLobby: Error fetching table data:`, err);
        setTableError(
          err instanceof Error ? err.message : "Failed to load game lobby"
        );
      } finally {
        setIsTableLoading(false);
      }
    };

    // Initial fetch
    fetchTableData();

    // Set up polling using an interval
    const intervalId = setInterval(fetchTableData, 5000);
    console.log(
      `GameLobby: Started polling interval for join code ${joinCode}`
    );

    return () => {
      // Clean up interval when component unmounts
      clearInterval(intervalId);
      console.log(
        `GameLobby: Cleared polling interval for join code ${joinCode}`
      );
    };
  }, [joinCode, router]);

  const handleStartGame = async () => {
    if (!table || !currentPlayer) return;

    setIsStarting(true);
    setTableError("");

    try {
      console.log(`GameLobby: Starting game for table ${table.table_id}`);
      // The server will automatically create the game state when starting the game
      await startGame(table.table_id, currentPlayer.player_id);
      router.push(`/games/${table.game_type}?table=${table.table_id}`);
    } catch (err) {
      console.error(`GameLobby: Error starting game:`, err);
      setTableError(
        err instanceof Error ? err.message : "Failed to start game"
      );
      setIsStarting(false);
    }
  };

  // Loading states
  if (isLoadingPlayer || isTableLoading) {
    return <div className={styles.loading}>Loading game lobby...</div>;
  }

  // Error states
  if (playerError) {
    return (
      <div className={styles.error}>
        Error: {playerError.message || "Failed to load player session"}
      </div>
    );
  }

  if (tableError || !table) {
    return (
      <div className={styles.error}>
        <p>{tableError || "Game not found or has been removed."}</p>
        <Link href="/" className={styles.link}>
          Return to Home
        </Link>
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div className={styles.error}>Error: Player session not available</div>
    );
  }

  const isHost = table.host_player_id === currentPlayer.player_id;

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

      {tableError && <p className={styles.error}>{tableError}</p>}

      <Link href="/" className={styles.backLink}>
        Leave Lobby
      </Link>
    </div>
  );
}
