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
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="surface-ivory max-w-md w-full px-7 py-8 text-center flex flex-col gap-3 parlor-fade">
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-error">
          ◆ Something gave way ◆
        </div>
        <h1
          className="font-display tracking-tight"
          style={{ fontSize: "var(--text-display-md)" }}
        >
          A piece fell off the table.
        </h1>
        <p className="text-sm text-base-content/65 leading-relaxed">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="mt-2">
          <button
            onClick={reset}
            type="button"
            className="btn btn-primary rounded-full px-6 font-semibold"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
