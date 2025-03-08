import styles from "./Square.module.css";

interface SquareProps {
  value: string;
  onClick: () => void;
}

export default function Square({ value, onClick }: SquareProps) {
  return (
    <button
      className={styles.square}
      onClick={onClick}
      aria-label={`Square with value: ${value || "empty"}`}
    >
      {value}
    </button>
  );
}
