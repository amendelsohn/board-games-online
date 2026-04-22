import styles from "./Square.module.css";

interface SquareProps {
  value: string;
  onClick: () => void;
}

export default function Square({ value, onClick }: SquareProps) {
  return (
    <button
      className="btn btn-outline btn-square h-[50px] w-[50px] text-2xl font-bold"
      onClick={onClick}
      aria-label={`Square with value: ${value || "empty"}`}
    >
      {value}
    </button>
  );
}
