import React from "react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-lg font-medium">Loading Lobby...</p>
        <p className="text-sm text-base-content/70">
          Connecting to game server
        </p>
      </div>
    </div>
  );
}
