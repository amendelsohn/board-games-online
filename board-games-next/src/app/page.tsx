import Link from "next/link";
import styles from "@/styles/Home.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Welcome to Board Games Online</h1>
      <p className={styles.description}>Choose a game to play:</p>
      <div className={styles.grid}>
        <Link href="/games/tic-tac-toe" className={styles.card}>
          <h2>Tic Tac Toe &rarr;</h2>
          <p>Play the classic game of Tic Tac Toe</p>
        </Link>
        {/* Add more games here as they are developed */}
      </div>
    </div>
  );
}
