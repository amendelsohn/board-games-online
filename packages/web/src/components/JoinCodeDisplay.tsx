"use client";

import { useState } from "react";

/**
 * Join code rendered as four letterpress-stamped tiles — feels like a
 * physical game token more than a text string. Each tile riser has a
 * tiny staggered entrance.
 */
export function JoinCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2 md:gap-3">
        {code.split("").map((ch, i) => (
          <button
            key={i}
            type="button"
            onClick={copy}
            aria-label={`Copy code: ${code}`}
            className={[
              "tile-stamp parlor-drop",
              "h-16 w-14 md:h-20 md:w-16",
              "flex items-center justify-center",
              "text-4xl md:text-5xl",
              "transition-transform duration-200",
              "hover:-translate-y-0.5 active:translate-y-0",
            ].join(" ")}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {ch}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={copy}
        className={[
          "text-xs tracking-[0.2em] uppercase font-semibold",
          "px-3 py-1.5 rounded-full",
          "border border-base-300",
          "bg-base-200/60 hover:bg-base-200",
          "text-base-content/70 hover:text-base-content",
          "transition-colors",
        ].join(" ")}
      >
        {copied ? "Copied" : "Tap to copy"}
      </button>
    </div>
  );
}
