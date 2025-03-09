import React, { useRef, useState } from "react";
import styles from "./Lobby.module.css";

const GameLobby: React.FC = () => {
  const [players, setPlayers] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef(null);

  const handleEditName = (player) => {
    setEditingName(true);
    setCurrentPlayer(player);
    setNewName(player.name);
  };

  const handleSaveName = () => {
    setSavingName(true);
    // Implement the logic to save the new name
  };

  const handleCancelEditName = () => {
    setEditingName(false);
    setCurrentPlayer(null);
    setNewName("");
  };

  return (
    <div className={styles.playersContainer}>
      <h3>Players in Lobby:</h3>
      <ul className={styles.playersList}>
        {players.map((player) => (
          <li key={player.player_id} className={styles.playerItem}>
            {editingName && player.player_id === currentPlayer.player_id ? (
              <div className={styles.inlineEditContainer}>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={styles.inlineNameInput}
                  placeholder="Enter your name"
                  maxLength={20}
                  disabled={savingName}
                />
                <div className={styles.inlineButtonGroup}>
                  <button
                    onClick={handleSaveName}
                    disabled={savingName || !newName.trim()}
                    className={styles.inlineButton}
                    title="Save"
                  >
                    ✓
                  </button>
                  <button
                    onClick={handleCancelEditName}
                    disabled={savingName}
                    className={styles.inlineButton}
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className={styles.playerName}>{player.name}</span>
                {player.player_id === table.host_player_id && (
                  <span className={styles.hostBadge}>Host</span>
                )}
                {player.player_id === currentPlayer.player_id && (
                  <span className={styles.youBadge}>You</span>
                )}
                {player.player_id === currentPlayer.player_id && !editingName && (
                  <button
                    onClick={() => handleEditName(player)}
                    className={styles.editButton}
                    title="Edit name"
                  >
                    Edit
                  </button>
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
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GameLobby;
