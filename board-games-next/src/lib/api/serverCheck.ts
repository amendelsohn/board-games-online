"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Checks if the API server is running
 * @returns Promise<boolean> - true if server is running, false otherwise
 */
export const isServerRunning = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/player/heartbeat`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // Add a short timeout to fail fast if server is not responding
      signal: AbortSignal.timeout(3000),
    });

    return response.ok;
  } catch (error) {
    console.error("Server check failed:", error);
    return false;
  }
};

/**
 * Displays a server connection error message
 */
export const ServerConnectionError = () => {
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
      <h3 style={{ marginTop: 0 }}>Server Connection Error</h3>
      <p>Could not connect to the game server. Please ensure:</p>
      <ul style={{ textAlign: "left" }}>
        <li>The backend server is running on port 8080</li>
        <li>
          You've started the server with <code>pnpm dev:backend</code>
        </li>
      </ul>
    </div>
  );
};
