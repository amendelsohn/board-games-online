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
    console.error("Games error:", error);
  }, [error]);

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[50vh]">
      <ErrorMessage
        title="Games Loading Error"
        message={error.message || "An error occurred while loading games"}
        hints={[
          "Try refreshing the page",
          "Check your internet connection",
          "Make sure the backend server is running",
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
