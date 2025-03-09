"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getPlayerSession } from "@/lib/playerSession";
import { getTable } from "@/lib/api";
import { Player, Table, TableStatus } from "@/types";
import GameBoard from "@/components/tic-tac-toe/GameBoard";
import Link from "next/link";

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
    return (
      <div className="flex justify-center items-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="alert alert-error max-w-lg mx-auto shadow-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <h3 className="font-bold">Error</h3>
          <div className="text-xs">{error || "Failed to load player data"}</div>
        </div>
        <div className="flex-none">
          <Link href="/" className="btn btn-sm">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // If we have a table ID but no table data, show an error
  if (tableId && !table) {
    return (
      <div className="alert alert-error max-w-lg mx-auto shadow-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <h3 className="font-bold">Error</h3>
          <div className="text-xs">Table not found</div>
        </div>
        <div className="flex-none">
          <Link href="/" className="btn btn-sm">
            Back to Home
          </Link>
        </div>
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
            <div className="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Unknown game type: {gameType}</span>
            </div>
          );
      }
    }

    // Otherwise, show a message that you need to join a game
    return (
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title">No Game Selected</h2>
          <p>Please join or create a game from the lobby to play.</p>
          <div className="card-actions justify-end">
            <Link href="/lobby" className="btn btn-primary">
              Go to Lobby
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col items-center">
      {renderGame()}
      <div className="mt-8">
        <Link href="/" className="btn btn-outline btn-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
