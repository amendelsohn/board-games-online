"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getTable,
  getPlayer,
  startGame,
  joinTable,
  updatePlayerName,
} from "@/lib/api";
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
  const [copySuccess, setCopySuccess] = useState(false);
  const [kickingPlayer, setKickingPlayer] = useState<string | null>(null);
  const [isKicked, setIsKicked] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  // Focus the name input when editing
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [editingName]);

  // Auto-join the lobby when component loads
  useEffect(() => {
    if (currentPlayer && table && !isKicked) {
      // Check if player is already in the lobby
      const isPlayerInLobby = table.player_ids.includes(
        currentPlayer.player_id
      );

      if (!isPlayerInLobby) {
        const autoJoin = async () => {
          try {
            console.log(
              `GameLobby: Auto-joining player ${currentPlayer.player_id} to lobby`
            );
            await joinTable(joinCode, currentPlayer.player_id);
            // Refresh table data after joining
            fetchTableData();
          } catch (err) {
            console.error(`GameLobby: Error auto-joining lobby:`, err);
            setTableError(
              err instanceof Error ? err.message : "Failed to join game lobby"
            );
          }
        };

        autoJoin();
      }
    }
  }, [currentPlayer, table, joinCode, isKicked]);

  // Load table data
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

      // Check if current player has been kicked
      if (
        currentPlayer &&
        !tableData.player_ids.includes(currentPlayer.player_id) &&
        !isTableLoading
      ) {
        setIsKicked(true);
      }
    } catch (err) {
      console.error(`GameLobby: Error fetching table data:`, err);
      setTableError(
        err instanceof Error ? err.message : "Failed to load game lobby"
      );
    } finally {
      setIsTableLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    console.log(`GameLobby: Initializing for join code ${joinCode}`);

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

  const handleCopyLink = () => {
    const url = `${window.location.origin}/lobby/${joinCode}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(() => {
        setTableError("Failed to copy link. Please try again.");
      });
  };

  const handleKickPlayer = async (playerId: string) => {
    if (
      !table ||
      !currentPlayer ||
      currentPlayer.player_id !== table.host_player_id
    )
      return;

    setKickingPlayer(playerId);

    try {
      // Make API call to kick player
      // This would need to be implemented on the server
      console.log(
        `GameLobby: Kicking player ${playerId} from lobby ${table.table_id}`
      );

      // Simple client-side implementation - update the table with the player removed
      const updatedPlayerIds = table.player_ids.filter((id) => id !== playerId);
      setTable({
        ...table,
        player_ids: updatedPlayerIds,
      });

      // Update players list
      setPlayers(players.filter((player) => player.player_id !== playerId));
    } catch (err) {
      console.error(`GameLobby: Error kicking player:`, err);
      setTableError(
        err instanceof Error ? err.message : "Failed to kick player"
      );
    } finally {
      setKickingPlayer(null);
    }
  };

  const handleStartEditing = (player: Player) => {
    if (player.player_id === currentPlayer?.player_id) {
      setNewName(player.name);
      setEditingName(true);
    }
  };

  const handleSaveName = async () => {
    if (!currentPlayer || !newName.trim()) return;

    setSavingName(true);
    setTableError("");

    try {
      console.log(
        `GameLobby: Updating name for player ${currentPlayer.player_id} to ${newName}`
      );
      const updatedPlayer = await updatePlayerName(
        currentPlayer.player_id,
        newName
      );

      // Update the players list with the new name
      setPlayers(
        players.map((player) =>
          player.player_id === currentPlayer.player_id
            ? { ...player, name: updatedPlayer.name }
            : player
        )
      );

      setEditingName(false);
    } catch (err) {
      console.error(`GameLobby: Error updating player name:`, err);
      setTableError(
        err instanceof Error ? err.message : "Failed to update name"
      );
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelEditing = () => {
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelEditing();
    }
  };

  // Kicked player view
  if (isKicked) {
    return (
      <div className={styles.kickedContainer}>
        <h2 className={styles.kickedTitle}>
          You've been removed from this lobby
        </h2>
        <p>The host has removed you from this game lobby.</p>
        <Link href="/" className={styles.button}>
          Return to Home
        </Link>
      </div>
    );
  }

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
      <h2>{table.game_type}</h2>

      <div className={styles.shareInfo}>
        <p>
          Invite Code: <strong>{table.join_code}</strong>
        </p>

        <button
          onClick={handleCopyLink}
          className={styles.copyButton}
          disabled={copySuccess}
        >
          {copySuccess ? "✅" : "📋"}
        </button>
      </div>

      <div className={styles.playersContainer}>
        <h3>Players in Lobby:</h3>
        <ul className={styles.playersList}>
          {players.map((player) => (
            <li key={player.player_id} className={styles.playerItem}>
              {player.player_id === currentPlayer.player_id && editingName ? (
                <div className={styles.inlineEditContainer}>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    className={styles.inlineInput}
                    placeholder="Your name"
                    maxLength={20}
                    disabled={savingName}
                  />
                  <div className={styles.inlineButtonGroup}>
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !newName.trim()}
                      className={styles.smallButton}
                      title="Save"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleCancelEditing}
                      disabled={savingName}
                      className={styles.smallButton}
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`${styles.playerName} ${
                    player.player_id === currentPlayer.player_id
                      ? styles.editable
                      : ""
                  }`}
                  onClick={() => handleStartEditing(player)}
                >
                  {player.name}
                  {player.player_id === currentPlayer.player_id && (
                    <span className={styles.editHint}>✎</span>
                  )}
                </div>
              )}

              {player.player_id === table.host_player_id && (
                <span className={styles.hostBadge}>Host</span>
              )}
              {player.player_id === currentPlayer.player_id && (
                <span className={styles.youBadge}>You</span>
              )}

              {isHost && player.player_id !== currentPlayer.player_id && (
                <button
                  onClick={() => handleKickPlayer(player.player_id)}
                  className={styles.kickButton}
                  disabled={!!kickingPlayer}
                >
                  {kickingPlayer === player.player_id
                    ? "Removing..."
                    : "Remove"}
                </button>
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

      {tableError && <p className={styles.error}>{tableError}</p>}

      <Link href="/" className={styles.backLink}>
        Leave Lobby
      </Link>
    </div>
  );
}
