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
    <div
      style={{
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
      }}
    >
      <ErrorMessage
        title="Something went wrong!"
        message={error.message || "An unexpected error occurred"}
        hints={[
          "Try refreshing the page",
          "Make sure both the frontend and backend servers are running",
        ]}
      />

      <button
        onClick={reset}
        style={{
          marginTop: "1rem",
          padding: "0.75rem 1.5rem",
          backgroundColor: "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
