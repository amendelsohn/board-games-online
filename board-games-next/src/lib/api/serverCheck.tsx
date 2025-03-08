"use client";

import React from "react";

// Hard-coded API URL to avoid process.env type issues
const API_URL = "http://localhost:8080";

/**
 * Checks if the API server is running
 * @returns Promise<boolean> - true if server is running, false otherwise
 */
export const isServerRunning = async (): Promise<boolean> => {
  try {
    console.log("Checking server connection...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("Server check timed out");
      controller.abort();
    }, 3000);

    console.log("Fetching from:", `${API_URL}/player/heartbeat`);
    const response = await fetch(`${API_URL}/player/heartbeat`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      // Add cache: 'no-store' to prevent caching
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log("Server response:", data);
      return true;
    } else {
      console.error("Server returned error status:", response.status);
      return false;
    }
  } catch (error) {
    console.error("Server check failed:", error);
    return false;
  }
};

/**
 * Displays a server connection error message
 */
export const ServerConnectionError: React.FC = () => {
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
          You&apos;ve started the server with <code>pnpm dev:backend</code>
        </li>
      </ul>
    </div>
  );
};
