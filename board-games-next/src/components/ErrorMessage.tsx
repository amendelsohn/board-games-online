import React from "react";

interface ErrorMessageProps {
  title: string;
  message: string;
  hints?: string[];
}

export function ErrorMessage({
  title,
  message,
  hints = [],
}: ErrorMessageProps) {
  return (
    <div
      style={{
        padding: "1rem",
        margin: "1rem 0",
        backgroundColor: "#FEE2E2",
        color: "#B91C1C",
        borderRadius: "0.5rem",
        textAlign: "center",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p>{message}</p>
      {hints.length > 0 && (
        <ul style={{ textAlign: "left" }}>
          {hints.map((hint, index) => (
            <li key={index}>{hint}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ServerConnectionError() {
  return (
    <ErrorMessage
      title="Server Connection Error"
      message="Could not connect to the game server. Please ensure:"
      hints={[
        "The backend server is running on port 8080",
        "You've started the server with pnpm dev:backend",
      ]}
    />
  );
}
