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

  // Kicked state
  if (isKicked) {
    return (
      <div className="card bg-base-100 shadow-lg p-6 max-w-md mx-auto">
        <div className="card-body items-center text-center">
          <h2 className="card-title text-error">
            You've been removed from this lobby
          </h2>
          <p className="mb-6">The host has removed you from this game lobby.</p>
          <div className="card-actions">
            <Link href="/" className="btn btn-primary">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading states
  if (isLoadingPlayer || isTableLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Error states
  if (playerError) {
    return (
      <div className="alert alert-error max-w-lg mx-auto">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          Error: {playerError.message || "Failed to load player session"}
        </span>
      </div>
    );
  }

  if (tableError || !table) {
    return (
      <div className="alert alert-error flex-col max-w-lg mx-auto">
        <span>
          Error: {tableError || "Game not found or has been removed."}
        </span>
        <div className="mt-4">
          <Link href="/" className="btn btn-sm">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!currentPlayer) {
    return (
      <div className="alert alert-error max-w-lg mx-auto">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Error: Player session not available</span>
      </div>
    );
  }

  const isHost = table.host_player_id === currentPlayer.player_id;

  return (
    <div className="card bg-base-100 shadow-lg max-w-xl mx-auto">
      <div className="card-body">
        <h2 className="card-title justify-center">{table.game_type}</h2>

        <div className="bg-base-200 rounded-box p-4 flex items-center justify-center my-4">
          <div className="join">
            <div className="join-item px-4 py-2 bg-base-100 flex items-center">
              <span className="font-bold">Code:</span>
              <span className="ml-2 text-lg tracking-wider">
                {table.join_code}
              </span>
            </div>
            <button
              onClick={handleCopyLink}
              className="btn join-item btn-primary btn-sm"
              disabled={copySuccess}
            >
              {copySuccess ? (
                <span className="text-success">✓</span>
              ) : (
                <span>Copy Link</span>
              )}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold mb-2">Players in Lobby:</h3>
          <ul className="space-y-2">
            {players.map((player) => (
              <li
                key={player.player_id}
                className="flex items-center justify-between p-3 bg-base-200 rounded-box"
              >
                {player.player_id === currentPlayer.player_id && editingName ? (
                  <div className="join w-full max-w-xs">
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={handleNameKeyDown}
                      className="input input-bordered input-sm join-item w-full"
                      placeholder="Your name"
                      maxLength={20}
                      disabled={savingName}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !newName.trim()}
                      className="btn btn-success btn-sm join-item"
                      title="Save"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleCancelEditing}
                      disabled={savingName}
                      className="btn btn-error btn-sm join-item"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    className={`flex-1 flex items-center ${
                      player.player_id === currentPlayer.player_id
                        ? "cursor-pointer hover:text-primary"
                        : ""
                    }`}
                    onClick={() => handleStartEditing(player)}
                  >
                    <div className="avatar placeholder mr-2">
                      <div className="bg-neutral-focus text-neutral-content rounded-full w-8">
                        <span>{player.name.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                    <span>{player.name}</span>
                    {player.player_id === currentPlayer.player_id && (
                      <span className="ml-2 text-info text-sm">
                        (Click to edit)
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  {player.player_id === table.host_player_id && (
                    <div className="badge badge-warning">Host</div>
                  )}
                  {player.player_id === currentPlayer.player_id && (
                    <div className="badge badge-success">You</div>
                  )}

                  {isHost && player.player_id !== currentPlayer.player_id && (
                    <button
                      onClick={() => handleKickPlayer(player.player_id)}
                      className="btn btn-error btn-xs"
                      disabled={!!kickingPlayer}
                    >
                      {kickingPlayer === player.player_id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        "Remove"
                      )}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {isHost && (
          <div className="card-actions justify-center mt-4">
            <button
              onClick={handleStartGame}
              disabled={isStarting || players.length < 2}
              className="btn btn-primary btn-lg"
            >
              {isStarting ? (
                <span className="loading loading-spinner loading-sm mr-2"></span>
              ) : null}
              {isStarting ? "Starting Game..." : "Start Game"}
            </button>

            {players.length < 2 && (
              <div className="text-sm text-base-content mt-2 opacity-75">
                Need at least 2 players to start
              </div>
            )}
          </div>
        )}

        {!isHost && (
          <div className="alert">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-info shrink-0 w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <span>Waiting for the host to start the game...</span>
          </div>
        )}

        {tableError && <div className="text-error mt-2">{tableError}</div>}

        <div className="card-actions justify-center mt-6">
          <Link href="/" className="btn btn-outline">
            Leave Lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
