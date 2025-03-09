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
    <div className="alert alert-error my-4 flex-col items-start">
      <h3 className="font-bold">{title}</h3>
      <p>{message}</p>
      {hints.length > 0 && (
        <ul className="list-disc pl-5 mt-2 w-full">
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
