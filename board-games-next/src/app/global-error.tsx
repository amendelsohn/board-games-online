"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en" data-theme="light">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center bg-base-100 p-4">
          <div className="card w-full max-w-md bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-error">Something went wrong!</h2>
              <p className="py-4">
                {error.message || "An unexpected error has occurred"}
              </p>
              <div className="card-actions justify-center">
                <button onClick={() => reset()} className="btn btn-primary">
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
