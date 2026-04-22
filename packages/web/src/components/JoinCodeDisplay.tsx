"use client";

import { useState } from "react";

export function JoinCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {code.split("").map((ch, i) => (
          <div
            key={i}
            className="w-14 h-16 md:w-16 md:h-20 rounded-xl bg-primary text-primary-content flex items-center justify-center text-4xl md:text-5xl font-mono font-black shadow-lg"
          >
            {ch}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={copy}
        className="btn btn-ghost btn-sm gap-1"
      >
        {copied ? "Copied!" : "Copy code"}
      </button>
    </div>
  );
}
