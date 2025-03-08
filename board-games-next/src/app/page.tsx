import Link from "next/link";
import styles from "@/styles/Home.module.css";

export default function Home() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Welcome to Board Games Online</h1>
      <p className={styles.description}>Play board games with friends online</p>

      <div className={styles.grid}>
        <Link href="/lobby" className={styles.card}>
          <h2>Play Online &rarr;</h2>
          <p>Create or join a multiplayer game</p>
        </Link>

        <Link href="/games/tic-tac-toe" className={styles.card}>
          <h2>Practice Mode &rarr;</h2>
          <p>Play Tic Tac Toe locally</p>
        </Link>
      </div>
    </div>
  );
}
