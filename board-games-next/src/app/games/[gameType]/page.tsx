"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPlayerSession } from "@/lib/playerSession";
import { getTable } from "@/lib/api";
import { Player, Table, TableStatus } from "@/types";
import GameBoard from "@/components/tic-tac-toe/GameBoard";
import Link from "next/link";
import styles from "../tic-tac-toe/page.module.css";

interface GamePageProps {
  params: {
    gameType: string;
  };
}

export default function GamePage({ params }: GamePageProps) {
  const { gameType } = params;
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table");

  const [player, setPlayer] = useState<Player | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load player and table data
  useEffect(() => {
    console.log(
      `GamePage: Initializing for game type ${gameType} and table ID ${tableId}`
    );

    const initGame = async () => {
      try {
        // Load player session
        const playerData = await getPlayerSession();
        setPlayer(playerData);
        console.log(`GamePage: Player session loaded:`, playerData);

        // If we have a table ID, load the table
        if (tableId) {
          console.log(`GamePage: Loading table data for table ID ${tableId}`);
          const tableData = await getTable(tableId);
          setTable(tableData);
          console.log(`GamePage: Table data loaded:`, tableData);
        }
      } catch (err) {
        console.error(`GamePage: Error initializing game:`, err);
        setError(err instanceof Error ? err.message : "Failed to load game");
      } finally {
        setIsLoading(false);
      }
    };

    initGame();
  }, [gameType, tableId]);

  if (isLoading) {
    return <div className={styles.loading}>Loading game...</div>;
  }

  if (error || !player) {
    return (
      <div className={styles.error}>
        <p>Error: {error || "Failed to load player data"}</p>
        <Link href="/" className={styles.backLink}>
          &larr; Back to Home
        </Link>
      </div>
    );
  }

  // If we have a table ID but no table data, show an error
  if (tableId && !table) {
    return (
      <div className={styles.error}>
        <p>Error: Table not found</p>
        <Link href="/" className={styles.backLink}>
          &larr; Back to Home
        </Link>
      </div>
    );
  }

  // Render the appropriate game component based on game type
  const renderGame = () => {
    // If we have a tableId, render the multiplayer game
    if (tableId) {
      switch (gameType) {
        case "tic-tac-toe":
          return <GameBoard tableId={tableId} />;
        default:
          return (
            <div className={styles.error}>
              <p>Unknown game type: {gameType}</p>
            </div>
          );
      }
    }

    // Otherwise, show a message that you need to join a game
    return (
      <div className={styles.error}>
        <p>Please join or create a game from the lobby to play.</p>
        <Link href="/lobby" className={styles.backLink}>
          Go to Lobby
        </Link>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {renderGame()}
      <div className={styles.links}>
        <Link href="/" className={styles.backLink}>
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}
