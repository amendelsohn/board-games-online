"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="alert alert-error max-w-md">
        <span>{error.message || "An unexpected error occurred"}</span>
      </div>
      <button onClick={reset} className="btn btn-primary">
        Try again
      </button>
    </div>
  );
}
