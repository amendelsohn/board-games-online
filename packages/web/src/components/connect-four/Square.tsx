import styles from './Square.module.css';

interface SquareProps {
  value: string;
  onClick?: () => void;
  disabled?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  showHover?: boolean;
  currentPlayerSymbol?: string;
}

export default function Square({ 
  value, 
  onClick, 
  disabled = false, 
  onMouseEnter, 
  onMouseLeave, 
  showHover = false, 
  currentPlayerSymbol 
}: SquareProps) {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  const pieceClass = value === 'R' ? styles.red : value === 'Y' ? styles.yellow : '';
  const hoverClass = showHover && currentPlayerSymbol ? 
    (currentPlayerSymbol === 'R' ? styles.red : styles.yellow) : '';

  return (
    <div 
      className={`${styles.square} ${disabled ? styles.disabled : ''} ${!disabled ? styles.clickable : ''}`}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {value ? (
        <div className={`${styles.piece} ${pieceClass}`} />
      ) : showHover ? (
        <div className={`${styles.piece} ${styles.hoverPiece} ${hoverClass}`} />
      ) : null}
    </div>
  );
}