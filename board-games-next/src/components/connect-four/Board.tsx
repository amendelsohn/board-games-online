import { useState } from 'react';
import Square from './Square';
import styles from './Board.module.css';
import { ConnectFourMove, ConnectFourState, BOARD_ROWS, BOARD_COLS } from '@/lib/games/connect-four/game-logic';
import { canDropInColumn, getPlayerName, getPlayerColor } from '@/lib/games/connect-four/utils';
import connectFourLogic from '@/lib/games/connect-four/game-logic';

interface BoardProps {
  gameState: ConnectFourState;
  currentPlayerId: string;
  isCurrentPlayerTurn: boolean;
  onMove: (move: ConnectFourMove) => void;
  onPlayAgain?: () => void;
  disabled?: boolean;
  isResetting?: boolean;
  isHost?: boolean;
}

export default function Board({ 
  gameState, 
  currentPlayerId, 
  isCurrentPlayerTurn, 
  onMove, 
  onPlayAgain,
  disabled = false,
  isResetting = false,
  isHost = false
}: BoardProps) {
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

  const board = gameState.game_specific_state.board;
  const playerSymbols = gameState.game_specific_state.player_symbols;
  const currentPlayerSymbol = playerSymbols[currentPlayerId];
  const currentTurnSymbol = playerSymbols[gameState.current_player || ''];
  
  const winner = connectFourLogic.checkWinner(gameState);
  const isDraw = connectFourLogic.isDraw(gameState);
  const isGameOver = gameState.is_game_over;

  // Debug logging
  console.log('Board render - Game state:', {
    isGameOver,
    winner,
    isDraw,
    hasOnPlayAgain: !!onPlayAgain,
    gameStateIsGameOver: gameState.is_game_over,
    winningPlayers: gameState.winning_players,
    losingPlayers: gameState.losing_players
  });

  const handleColumnClick = (column: number) => {
    if (disabled || isGameOver || !isCurrentPlayerTurn) return;
    if (!canDropInColumn(board, column)) return;

    onMove({ column });
  };


  const renderSquare = (row: number, col: number) => {
    const value = board[row][col];
    const canDrop = canDropInColumn(board, col);
    const isDisabled = disabled || isGameOver || !isCurrentPlayerTurn || !canDrop;
    
    return (
      <Square
        key={`${row}-${col}`}
        value={value}
        disabled={isDisabled}
        onClick={() => handleColumnClick(col)}
        onMouseEnter={() => setHoveredColumn(col)}
        onMouseLeave={() => setHoveredColumn(null)}
        showHover={hoveredColumn === col && canDrop && isCurrentPlayerTurn && !isGameOver}
        currentPlayerSymbol={currentPlayerSymbol}
      />
    );
  };

  const getGameStatusMessage = () => {
    if (winner && winner !== 'draw') {
      const winnerPlayerId = Object.keys(playerSymbols).find(id => playerSymbols[id] === winner);
      const isCurrentPlayerWinner = winnerPlayerId === currentPlayerId;
      return {
        message: isCurrentPlayerWinner ? 'You won!' : `${getPlayerName(winner)} wins!`,
        className: styles.winner
      };
    }
    
    if (isDraw) {
      return {
        message: "It's a draw!",
        className: styles.draw
      };
    }
    
    if (isCurrentPlayerTurn) {
      return {
        message: 'Your turn',
        className: ''
      };
    }
    
    return {
      message: `${getPlayerName(currentTurnSymbol)}'s turn`,
      className: ''
    };
  };

  const statusInfo = getGameStatusMessage();

  return (
    <div className={styles.boardContainer}>
      <div className={styles.gameInfo}>
        <div className={styles.playerInfo}>
          <div className={`${styles.playerSymbol} ${currentPlayerSymbol === 'R' ? styles.red : styles.yellow}`} />
          <span>You are {getPlayerName(currentPlayerSymbol)}</span>
        </div>
        
        <div className={`${styles.gameStatus} ${statusInfo.className}`}>
          {statusInfo.message}
        </div>

        {isGameOver && onPlayAgain && isHost && (
          <div className={styles.playAgainContainer}>
            <button 
              className={`btn btn-primary ${isResetting ? 'loading' : ''}`}
              onClick={onPlayAgain}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Play Again'}
            </button>
          </div>
        )}
      </div>


      <div className={styles.board}>
        {Array.from({ length: BOARD_ROWS }, (_, row) =>
          Array.from({ length: BOARD_COLS }, (_, col) => renderSquare(row, col))
        )}
      </div>
    </div>
  );
}