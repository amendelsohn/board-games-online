import React from "react";

/**
 * Game-specific iconography. Simple SVG glyphs that hint at the game
 * without needing external assets.
 */
export function GameIcon({ type }: { type: string }) {
  if (type === "tic-tac-toe") {
    return (
      <div className="w-14 h-14 rounded-xl bg-primary/10 grid grid-cols-3 grid-rows-3 gap-0.5 p-1.5">
        <span className="flex items-center justify-center font-bold text-primary">×</span>
        <span className="flex items-center justify-center font-bold text-secondary">○</span>
        <span />
        <span />
        <span className="flex items-center justify-center font-bold text-primary">×</span>
        <span />
        <span className="flex items-center justify-center font-bold text-secondary">○</span>
        <span />
        <span className="flex items-center justify-center font-bold text-primary">×</span>
      </div>
    );
  }
  if (type === "connect-four") {
    return (
      <div className="w-14 h-14 rounded-xl bg-primary grid grid-cols-4 grid-rows-4 gap-0.5 p-1">
        {Array.from({ length: 16 }).map((_, i) => {
          const filled = [5, 10, 13, 14, 15].includes(i);
          const color = i % 2 === 0 ? "bg-error" : "bg-warning";
          return (
            <span
              key={i}
              className={`rounded-full ${filled ? color : "bg-primary-content/20"}`}
            />
          );
        })}
      </div>
    );
  }
  if (type === "codenames") {
    return (
      <div className="w-14 h-14 rounded-xl bg-primary/10 grid grid-cols-5 grid-rows-5 gap-0.5 p-1.5">
        {Array.from({ length: 25 }).map((_, i) => {
          const kind = [0, 3, 6, 9, 12, 15, 18, 21, 24].includes(i)
            ? "bg-error"
            : [1, 4, 7, 10, 13, 16, 19, 22].includes(i)
              ? "bg-info"
              : i === 8
                ? "bg-neutral"
                : "bg-base-300";
          return <span key={i} className={`rounded-sm ${kind}`} />;
        })}
      </div>
    );
  }
  if (type === "spyfall") {
    return (
      <div className="w-14 h-14 rounded-xl bg-neutral flex items-center justify-center text-3xl">
        🕵️
      </div>
    );
  }
  // Generic fallback
  return (
    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
      🎲
    </div>
  );
}
