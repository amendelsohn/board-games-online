"use client";

import React from "react";

export default function Loading() {
  return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-5">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              style={{
                animation: "parlorWinPulse 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
        <p className="text-xs uppercase tracking-[0.22em] text-base-content/55">
          One moment
        </p>
      </div>
    </div>
  );
}
