import React from "react";

/**
 * Game iconography. Tactile SVG-like glyphs — feel like physical game
 * bits sitting on a shelf. Each game has a distinct silhouette so the
 * catalog doesn't devolve into "generic rounded icon" monoculture.
 */
export function GameIcon({
  type,
  size = "md",
}: {
  type: string;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "lg"
      ? "h-16 w-16"
      : size === "sm"
        ? "h-10 w-10"
        : "h-14 w-14";
  const wrap = [
    box,
    "relative shrink-0 rounded-xl",
    "ring-1 ring-base-300/80",
    "bg-base-100",
    "overflow-hidden",
  ].join(" ");

  if (type === "tic-tac-toe") {
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          {/* grid lines */}
          <g
            stroke="color-mix(in oklch, currentColor 25%, transparent)"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <line x1="22" y1="10" x2="22" y2="46" />
            <line x1="34" y1="10" x2="34" y2="46" />
            <line x1="10" y1="22" x2="46" y2="22" />
            <line x1="10" y1="34" x2="46" y2="34" />
          </g>
          {/* X top-left */}
          <g
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <line x1="13" y1="13" x2="19" y2="19" />
            <line x1="19" y1="13" x2="13" y2="19" />
          </g>
          {/* O center */}
          <circle
            cx="28"
            cy="28"
            r="3.4"
            fill="none"
            stroke="var(--color-secondary)"
            strokeWidth="2.5"
          />
          {/* X bottom-right */}
          <g
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <line x1="37" y1="37" x2="43" y2="43" />
            <line x1="43" y1="37" x2="37" y2="43" />
          </g>
        </svg>
      </div>
    );
  }

  if (type === "connect-four") {
    return (
      <div className={wrap}>
        <div
          className="absolute inset-1.5 rounded-lg grid grid-cols-4 grid-rows-4 gap-[3px] p-1"
          style={{ background: "var(--color-primary)" }}
        >
          {Array.from({ length: 16 }).map((_, i) => {
            const filled: Record<number, string> = {
              5: "var(--color-error)",
              9: "var(--color-warning)",
              10: "var(--color-error)",
              13: "var(--color-warning)",
              14: "var(--color-error)",
              15: "var(--color-warning)",
            };
            const fill = filled[i];
            return (
              <span
                key={i}
                className="rounded-full"
                style={{
                  background:
                    fill ??
                    "color-mix(in oklch, var(--color-primary-content) 22%, transparent)",
                  boxShadow: fill
                    ? "inset 0 -1px 0 oklch(0% 0 0 / 0.18)"
                    : undefined,
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "codenames") {
    // 5x5 card grid with 3 reds, 3 blues, 1 assassin
    const roles = [
      "r", "n", "b", "n", "r",
      "n", "b", "n", "r", "n",
      "b", "n", "a", "n", "b",
      "n", "r", "n", "b", "n",
      "r", "n", "b", "n", "r",
    ];
    const colorFor = (r: string) =>
      r === "r"
        ? "var(--color-error)"
        : r === "b"
          ? "var(--color-info)"
          : r === "a"
            ? "var(--color-neutral)"
            : "color-mix(in oklch, var(--color-base-300) 90%, transparent)";
    return (
      <div className={wrap}>
        <div className="absolute inset-1.5 grid grid-cols-5 grid-rows-5 gap-[2px]">
          {roles.map((r, i) => (
            <span
              key={i}
              className="rounded-[2px]"
              style={{ background: colorFor(r) }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === "spyfall") {
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <defs>
            <radialGradient id="spy-bg" cx="50%" cy="30%" r="80%">
              <stop
                offset="0%"
                stopColor="var(--color-warning)"
                stopOpacity="0.25"
              />
              <stop
                offset="100%"
                stopColor="var(--color-neutral)"
                stopOpacity="0.05"
              />
            </radialGradient>
          </defs>
          <rect width="56" height="56" fill="url(#spy-bg)" />
          {/* hat brim */}
          <ellipse
            cx="28"
            cy="23"
            rx="15"
            ry="3.5"
            fill="var(--color-neutral)"
          />
          {/* hat top */}
          <rect
            x="19"
            y="11"
            width="18"
            height="12"
            rx="3"
            fill="var(--color-neutral)"
          />
          {/* hat band */}
          <rect
            x="19"
            y="20"
            width="18"
            height="3"
            fill="var(--color-primary)"
          />
          {/* eyes */}
          <circle cx="23" cy="32" r="2" fill="var(--color-base-content)" />
          <circle cx="33" cy="32" r="2" fill="var(--color-base-content)" />
          {/* question mark — the spy is asking questions */}
          <text
            x="28"
            y="48"
            textAnchor="middle"
            fontSize="10"
            fontFamily="var(--font-display)"
            fill="var(--color-base-content)"
            opacity="0.8"
          >
            ?
          </text>
        </svg>
      </div>
    );
  }

  // Fallback — a single tinted die
  return (
    <div className={wrap}>
      <div className="absolute inset-0 flex items-center justify-center text-2xl font-display text-primary">
        ◆
      </div>
    </div>
  );
}
