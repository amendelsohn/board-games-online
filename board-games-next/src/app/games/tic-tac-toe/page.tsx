import Board from "@/components/tic-tac-toe/Board";
import styles from "./page.module.css";
import Link from "next/link";

export const metadata = {
  title: "Tic Tac Toe - Board Games Online",
  description: "Play Tic Tac Toe online",
};

export default function TicTacToePage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Tic Tac Toe</h1>
      <Board />
      <div className={styles.links}>
        <Link href="/" className={styles.backLink}>
          &larr; Back to All Games
        </Link>
      </div>
    </div>
  );
}
