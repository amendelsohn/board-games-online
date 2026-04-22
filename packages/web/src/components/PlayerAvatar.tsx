import React from "react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  const a = (parts[0] ?? "")[0] ?? "";
  const b = (parts[1] ?? "")[0] ?? "";
  return (a + b).toUpperCase();
}

/**
 * Hash-pick a hue wedge — seven "token" colors derived from the theme
 * palette at varying hues. Each player is deterministically assigned one.
 * We use CSS vars with oklch so both light/dark themes stay coherent.
 */
const TOKENS: { bg: string; fg: string }[] = [
  { bg: "oklch(70% 0.14 30)", fg: "oklch(99% 0.01 30)" }, // terracotta
  { bg: "oklch(68% 0.14 75)", fg: "oklch(22% 0.04 60)" }, // amber
  { bg: "oklch(64% 0.12 150)", fg: "oklch(99% 0.01 150)" }, // moss
  { bg: "oklch(60% 0.12 220)", fg: "oklch(99% 0.01 220)" }, // slate blue
  { bg: "oklch(56% 0.16 280)", fg: "oklch(99% 0.01 280)" }, // violet
  { bg: "oklch(52% 0.18 340)", fg: "oklch(99% 0.01 340)" }, // plum
  { bg: "oklch(62% 0.14 195)", fg: "oklch(99% 0.01 195)" }, // teal
];

function hashIdx(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % TOKENS.length;
}

export function PlayerAvatar({
  name,
  size = "md",
  active = false,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  active?: boolean;
}) {
  const sizes = {
    sm: "h-8 w-8 text-[0.68rem]",
    md: "h-10 w-10 text-xs",
    lg: "h-14 w-14 text-sm",
  };
  const token = TOKENS[hashIdx(name)]!;

  return (
    <div
      className={[
        sizes[size],
        "shrink-0 rounded-full flex items-center justify-center",
        "font-display tracking-tight select-none",
        "ring-1 ring-black/5",
        active
          ? "ring-2 ring-primary outline outline-2 outline-offset-2 outline-primary/30 transition-all"
          : "",
      ].join(" ")}
      style={{
        background: `radial-gradient(circle at 30% 25%, color-mix(in oklch, ${token.bg} 85%, white 20%), ${token.bg} 70%)`,
        color: token.fg,
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.3), inset 0 -1px 0 oklch(0% 0 0 / 0.15)",
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
