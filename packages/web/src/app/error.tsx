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
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[50vh]">
      <ErrorMessage
        title="Something went wrong!"
        message={error.message || "An unexpected error occurred"}
        hints={[
          "Try refreshing the page",
          "Make sure both the frontend and backend servers are running",
        ]}
      />

      <button onClick={reset} className="btn btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}
