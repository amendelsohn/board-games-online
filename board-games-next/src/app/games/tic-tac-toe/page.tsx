"use client";

import { useSearchParams } from "next/navigation";
import GameBoard from "@/components/tic-tac-toe/GameBoard";
import Link from "next/link";

export default function TicTacToePage() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table");

  if (!tableId) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-center my-8">Tic Tac Toe</h1>
        <div className="alert alert-warning max-w-lg">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>
            No table ID provided. Please join or create a game from the lobby.
          </span>
        </div>
        <div className="mt-6">
          <Link href="/" className="btn btn-primary">
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
            Back to All Games
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold text-center my-8">Tic Tac Toe</h1>
      <GameBoard tableId={tableId} />
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
          Back to All Games
        </Link>
      </div>
    </div>
  );
}
