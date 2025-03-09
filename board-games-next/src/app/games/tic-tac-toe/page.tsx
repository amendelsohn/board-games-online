"use client";

import { useSearchParams } from "next/navigation";
import GameBoard from "@/components/tic-tac-toe/GameBoard";
import styles from "./page.module.css";
import Link from "next/link";

export default function TicTacToePage() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table");

  if (!tableId) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Tic Tac Toe</h1>
        <p>
          No table ID provided. Please join or create a game from the lobby.
        </p>
        <div className={styles.links}>
          <Link href="/" className={styles.backLink}>
            &larr; Back to All Games
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Tic Tac Toe</h1>
      <GameBoard tableId={tableId} />
      <div className={styles.links}>
        <Link href="/" className={styles.backLink}>
          &larr; Back to All Games
        </Link>
      </div>
    </div>
  );
}
