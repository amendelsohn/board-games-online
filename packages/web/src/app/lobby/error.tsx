"use client";

import React, { useEffect } from "react";
import { ErrorMessage } from "@/components/ErrorMessage";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Lobby error:", error);
  }, [error]);

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[50vh]">
      <ErrorMessage
        title="Lobby Error"
        message={error.message || "An error occurred in the game lobby"}
        hints={[
          "Try refreshing the page",
          "Check your connection to the game server",
          "The game session may have expired or been closed",
        ]}
      />

      <div className="flex gap-4 mt-6">
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <a href="/" className="btn btn-outline">
          Return home
        </a>
      </div>
    </div>
  );
}
