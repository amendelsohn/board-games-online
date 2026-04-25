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

  if (type === "reversi") {
    // 4x4 mini-board of discs — alternating black/white to evoke a
    // flipped line-of-capture.
    const pattern: ("B" | "W" | null)[] = [
      "W", "B", "W", "B",
      "B", "W", "W", "W",
      "B", "B", "B", "W",
      "W", "B", "W", "B",
    ];
    return (
      <div className={wrap}>
        <div
          className="absolute inset-1.5 rounded-lg grid grid-cols-4 grid-rows-4 gap-[3px] p-1"
          style={{
            background:
              "color-mix(in oklch, var(--color-success) 55%, var(--color-base-300))",
            boxShadow:
              "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -1px 0 oklch(0% 0 0 / 0.18)",
          }}
        >
          {pattern.map((d, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                background:
                  d === "B"
                    ? "var(--color-primary)"
                    : d === "W"
                      ? "var(--color-secondary)"
                      : "color-mix(in oklch, oklch(0% 0 0) 12%, transparent)",
                boxShadow:
                  d !== null
                    ? "inset 0 -1px 0 oklch(0% 0 0 / 0.25), inset 0 1px 0 oklch(100% 0 0 / 0.25)"
                    : undefined,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === "battleship") {
    // 5×5 grid of blue "water" cells with a 3-cell ship silhouette and
    // a couple of hit/miss markers — a tiny battleship tableau.
    const cells: ("water" | "ship" | "hit" | "miss")[] = [
      "water", "miss",  "water", "water", "water",
      "water", "water", "water", "water", "hit",
      "water", "water", "ship",  "ship",  "ship",
      "water", "hit",   "water", "water", "water",
      "water", "water", "water", "miss",  "water",
    ];
    const fill = (k: "water" | "ship" | "hit" | "miss") => {
      if (k === "water") return "var(--color-info)";
      if (k === "ship") return "var(--color-neutral)";
      if (k === "hit") return "var(--color-error)";
      return "var(--color-info)"; // miss tile is water-colored with a dot
    };
    return (
      <div className={wrap}>
        <div className="absolute inset-1.5 grid grid-cols-5 grid-rows-5 gap-[2px]">
          {cells.map((k, i) => (
            <span
              key={i}
              className="rounded-[2px] relative"
              style={{
                background: fill(k),
                boxShadow:
                  "inset 0 1px 0 oklch(100% 0 0 / 0.2), inset 0 -1px 0 oklch(0% 0 0 / 0.15)",
              }}
            >
              {k === "miss" && (
                <span
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    color: "var(--color-base-content)",
                    opacity: 0.55,
                    fontSize: "0.7em",
                    lineHeight: 1,
                  }}
                >
                  •
                </span>
              )}
            </span>
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

  if (type === "checkers") {
    // A 4x4 corner of the board with a few red & black discs; one crowned.
    const dark = "color-mix(in oklch, var(--color-neutral) 55%, var(--color-base-300))";
    const light = "color-mix(in oklch, var(--color-base-100) 85%, var(--color-base-200))";
    const discs: Record<number, "r" | "b" | "B"> = {
      1: "b",
      3: "b",
      4: "b",
      10: "r",
      13: "B",
      15: "r",
    };
    return (
      <div className={wrap}>
        <div
          className="absolute inset-1.5 grid grid-cols-4 grid-rows-4 gap-0 rounded-md overflow-hidden"
          style={{ boxShadow: "inset 0 0 0 1.5px oklch(0% 0 0 / 0.3)" }}
        >
          {Array.from({ length: 16 }).map((_, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const isDark = (row + col) % 2 === 1;
            const disc = discs[i];
            const discBg =
              disc === "r"
                ? "var(--color-error)"
                : "var(--color-neutral)";
            return (
              <span
                key={i}
                className="relative flex items-center justify-center"
                style={{ background: isDark ? dark : light }}
              >
                {disc && (
                  <span
                    className="rounded-full flex items-center justify-center"
                    style={{
                      width: "72%",
                      height: "72%",
                      background: `radial-gradient(circle at 35% 30%, color-mix(in oklch, ${discBg} 80%, white) 0%, ${discBg} 55%, color-mix(in oklch, ${discBg} 70%, black) 100%)`,
                      boxShadow:
                        "inset 0 -1px 0 oklch(0% 0 0 / 0.25), 0 1px 1.5px oklch(0% 0 0 / 0.3)",
                    }}
                  >
                    {disc === "B" && (
                      <span
                        aria-hidden
                        style={{
                          fontSize: "0.6rem",
                          lineHeight: 1,
                          color: "var(--color-warning)",
                          textShadow: "0 1px 1px oklch(0% 0 0 / 0.5)",
                        }}
                      >
                        ♛
                      </span>
                    )}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "chess") {
    // A 4x4 corner of a chess board with a white king & knight silhouette
    // and a black queen looming diagonally — tactile, instantly chess.
    const light =
      "color-mix(in oklch, var(--color-base-100) 78%, var(--color-warning) 8%)";
    const dark =
      "color-mix(in oklch, var(--color-neutral) 55%, var(--color-base-300))";
    const pieces: Record<number, { glyph: string; color: "w" | "b" }> = {
      1: { glyph: "♛", color: "b" },
      6: { glyph: "♞", color: "w" },
      9: { glyph: "♟", color: "b" },
      13: { glyph: "♔", color: "w" },
    };
    return (
      <div className={wrap}>
        <div
          className="absolute inset-1.5 grid grid-cols-4 grid-rows-4 gap-0 rounded-md overflow-hidden"
          style={{ boxShadow: "inset 0 0 0 1.5px oklch(0% 0 0 / 0.3)" }}
        >
          {Array.from({ length: 16 }).map((_, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const isLight = (row + col) % 2 === 0;
            const p = pieces[i];
            return (
              <span
                key={i}
                className="relative flex items-center justify-center"
                style={{ background: isLight ? light : dark }}
              >
                {p && (
                  <span
                    aria-hidden
                    style={{
                      fontSize: "0.95rem",
                      lineHeight: 1,
                      fontWeight: 800,
                      color:
                        p.color === "w"
                          ? "var(--color-base-100)"
                          : "color-mix(in oklch, var(--color-neutral) 95%, black)",
                      textShadow:
                        p.color === "w"
                          ? "0 0 0.5px oklch(0% 0 0 / 0.9), 0 1px 1px oklch(0% 0 0 / 0.3)"
                          : "0 0 0.5px oklch(100% 0 0 / 0.5), 0 1px 1px oklch(0% 0 0 / 0.4)",
                    }}
                  >
                    {p.glyph}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "gomoku") {
    // Mini 5x5 intersection of a Go board with a diagonal of five stones
    // (black+white alternating) cutting across — evokes the winning line.
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <rect
            width="56"
            height="56"
            fill="color-mix(in oklch, var(--color-warning) 32%, var(--color-base-300) 68%)"
          />
          {/* 5x5 grid lines — cell centers at 8,18,28,38,48 */}
          <g
            stroke="color-mix(in oklch, var(--color-neutral) 55%, transparent)"
            strokeWidth="1"
            strokeLinecap="round"
          >
            {[8, 18, 28, 38, 48].map((pos) => (
              <g key={pos}>
                <line x1="8" y1={pos} x2="48" y2={pos} />
                <line x1={pos} y1="8" x2={pos} y2="48" />
              </g>
            ))}
          </g>
          <circle
            cx="28"
            cy="28"
            r="1.8"
            fill="color-mix(in oklch, var(--color-neutral) 80%, transparent)"
          />
          {/* Diagonal winning line of 5 alternating stones */}
          {[
            { x: 8, y: 8, c: "B" },
            { x: 18, y: 18, c: "W" },
            { x: 28, y: 28, c: "B" },
            { x: 38, y: 38, c: "W" },
            { x: 48, y: 48, c: "B" },
          ].map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r="5"
              fill={
                s.c === "B"
                  ? "var(--color-neutral)"
                  : "var(--color-base-100)"
              }
              stroke={
                s.c === "W"
                  ? "color-mix(in oklch, var(--color-neutral) 40%, transparent)"
                  : "none"
              }
              strokeWidth="0.75"
            />
          ))}
        </svg>
      </div>
    );
  }

  if (type === "dots-and-boxes") {
    // 2×2 grid of boxes: a few drawn edges, one box filled. Dots at every intersection.
    // Coordinate system: dots at (x ∈ {12, 28, 44}, y ∈ {12, 28, 44}).
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          {/* Filled top-left box — the "captured" one */}
          <rect
            x="12"
            y="12"
            width="16"
            height="16"
            fill="color-mix(in oklch, var(--color-primary) 28%, transparent)"
          />
          {/* Drawn edges around the filled box + a couple of extras */}
          <g
            stroke="var(--color-primary)"
            strokeWidth="2.25"
            strokeLinecap="round"
          >
            {/* top-left box — all 4 sides */}
            <line x1="12" y1="12" x2="28" y2="12" />
            <line x1="12" y1="28" x2="28" y2="28" />
            <line x1="12" y1="12" x2="12" y2="28" />
            <line x1="28" y1="12" x2="28" y2="28" />
          </g>
          <g
            stroke="var(--color-secondary)"
            strokeWidth="2.25"
            strokeLinecap="round"
          >
            {/* extra edges from the other player */}
            <line x1="28" y1="28" x2="44" y2="28" />
            <line x1="44" y1="28" x2="44" y2="44" />
          </g>
          {/* Faint edges for the rest of the grid so the structure reads */}
          <g
            stroke="color-mix(in oklch, currentColor 18%, transparent)"
            strokeWidth="1.25"
            strokeLinecap="round"
          >
            <line x1="28" y1="12" x2="44" y2="12" />
            <line x1="44" y1="12" x2="44" y2="28" />
            <line x1="12" y1="28" x2="12" y2="44" />
            <line x1="12" y1="44" x2="28" y2="44" />
            <line x1="28" y1="44" x2="44" y2="44" />
            <line x1="28" y1="28" x2="28" y2="44" />
          </g>
          {/* Dots */}
          <g fill="var(--color-base-content)">
            <circle cx="12" cy="12" r="2" />
            <circle cx="28" cy="12" r="2" />
            <circle cx="44" cy="12" r="2" />
            <circle cx="12" cy="28" r="2" />
            <circle cx="28" cy="28" r="2" />
            <circle cx="44" cy="28" r="2" />
            <circle cx="12" cy="44" r="2" />
            <circle cx="28" cy="44" r="2" />
            <circle cx="44" cy="44" r="2" />
          </g>
        </svg>
      </div>
    );
  }

  if (type === "mastermind") {
    // A row of 4 colored code pegs with a little 2-dot feedback cluster
    // tucked in the corner — echoes the physical Mastermind board.
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <defs>
            <radialGradient id="mm-peg" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="white" stopOpacity="0.55" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* code row */}
          {[
            { cx: 12, fill: "var(--color-error)" },
            { cx: 23, fill: "var(--color-warning)" },
            { cx: 34, fill: "var(--color-success)" },
            { cx: 45, fill: "var(--color-info)" },
          ].map((p, i) => (
            <g key={i}>
              <circle cx={p.cx} cy="28" r="6" fill={p.fill} />
              <circle cx={p.cx} cy="28" r="6" fill="url(#mm-peg)" />
            </g>
          ))}
          {/* feedback peg cluster — 1 black + 1 white */}
          <circle cx="19" cy="46" r="2.6" fill="var(--color-base-content)" />
          <circle
            cx="26"
            cy="46"
            r="2.6"
            fill="var(--color-base-100)"
            stroke="color-mix(in oklch, var(--color-base-content) 35%, transparent)"
            strokeWidth="0.8"
          />
          <circle
            cx="33"
            cy="46"
            r="2.3"
            fill="color-mix(in oklch, var(--color-base-content) 10%, transparent)"
          />
          <circle
            cx="39"
            cy="46"
            r="2.3"
            fill="color-mix(in oklch, var(--color-base-content) 10%, transparent)"
          />
          {/* decoding band */}
          <line
            x1="6"
            y1="13"
            x2="50"
            y2="13"
            stroke="color-mix(in oklch, var(--color-base-content) 18%, transparent)"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (type === "nim") {
    // Three pile silhouettes — 3, 5, 7 stones, bottom-aligned on a shelf line.
    const piles: { x: number; count: number; tint: string }[] = [
      { x: 13, count: 3, tint: "var(--color-primary)" },
      { x: 28, count: 5, tint: "var(--color-secondary)" },
      { x: 43, count: 7, tint: "var(--color-accent)" },
    ];
    const baseline = 48;
    const stoneW = 11;
    const stoneH = 4;
    const gap = 1.5;
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          {/* shelf line */}
          <line
            x1="6"
            y1="50"
            x2="50"
            y2="50"
            stroke="color-mix(in oklch, currentColor 25%, transparent)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {piles.map((p, pi) => (
            <g key={pi}>
              {Array.from({ length: p.count }).map((_, k) => {
                const y = baseline - (k + 1) * (stoneH + gap);
                return (
                  <ellipse
                    key={k}
                    cx={p.x}
                    cy={y + stoneH / 2}
                    rx={stoneW / 2}
                    ry={stoneH / 2}
                    fill={p.tint}
                    opacity={0.9 - k * 0.06}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (type === "memory") {
    // A 3x3 grid of cards: two matching face-up pairs and the rest
    // diagonally striped backs — hints at "find the match, remember the rest".
    type Cell =
      | { kind: "back" }
      | { kind: "face"; symbol: string; color: string };
    const cells: Cell[] = [
      { kind: "back" },
      { kind: "face", symbol: "★", color: "var(--color-primary)" },
      { kind: "back" },
      { kind: "face", symbol: "◆", color: "var(--color-secondary)" },
      { kind: "back" },
      { kind: "face", symbol: "◆", color: "var(--color-secondary)" },
      { kind: "back" },
      { kind: "face", symbol: "★", color: "var(--color-primary)" },
      { kind: "back" },
    ];
    return (
      <div className={wrap}>
        <div
          className="absolute inset-1.5 grid grid-cols-3 grid-rows-3 gap-[3px] rounded-md p-0.5"
          style={{
            background:
              "color-mix(in oklch, var(--color-base-300) 90%, transparent)",
          }}
        >
          {cells.map((cell, i) => {
            if (cell.kind === "face") {
              return (
                <span
                  key={i}
                  className="rounded-[3px] relative flex items-center justify-center"
                  style={{
                    background: `color-mix(in oklch, ${cell.color} 20%, var(--color-base-100))`,
                    boxShadow: `inset 0 0 0 1px ${cell.color}`,
                  }}
                >
                  <span
                    style={{
                      color: cell.color,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {cell.symbol}
                  </span>
                </span>
              );
            }
            return (
              <span
                key={i}
                className="rounded-[3px]"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, color-mix(in oklch, var(--color-primary) 32%, transparent) 0 2px, color-mix(in oklch, var(--color-secondary) 24%, transparent) 2px 4px)",
                  boxShadow:
                    "inset 0 0 0 0.5px color-mix(in oklch, oklch(0% 0 0) 30%, transparent)",
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "rps") {
    // Rock / Paper / Scissors arranged in a triangle — a tiny tactile RPS diorama.
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <defs>
            <radialGradient id="rps-bg" cx="50%" cy="55%" r="70%">
              <stop
                offset="0%"
                stopColor="var(--color-primary)"
                stopOpacity="0.1"
              />
              <stop
                offset="100%"
                stopColor="var(--color-secondary)"
                stopOpacity="0"
              />
            </radialGradient>
          </defs>
          <rect width="56" height="56" fill="url(#rps-bg)" />
          {/* dashed triangle connecting the three throws */}
          <polygon
            points="28,14 44,40 12,40"
            fill="none"
            stroke="color-mix(in oklch, currentColor 25%, transparent)"
            strokeWidth="1"
            strokeDasharray="2 3"
            strokeLinecap="round"
          />
          {/* rock — top: chunky round stone */}
          <g>
            <ellipse
              cx="28"
              cy="15"
              rx="6.5"
              ry="5"
              fill="var(--color-primary)"
            />
            <ellipse
              cx="26"
              cy="13.5"
              rx="2"
              ry="1.2"
              fill="oklch(100% 0 0 / 0.25)"
            />
          </g>
          {/* paper — bottom-left: folded sheet */}
          <g transform="translate(6 32)">
            <rect
              x="0"
              y="0"
              width="12"
              height="14"
              rx="1.5"
              fill="var(--color-base-100)"
              stroke="var(--color-secondary)"
              strokeWidth="1.5"
            />
            <line
              x1="2.5"
              y1="4"
              x2="9.5"
              y2="4"
              stroke="var(--color-secondary)"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <line
              x1="2.5"
              y1="7"
              x2="9.5"
              y2="7"
              stroke="var(--color-secondary)"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <line
              x1="2.5"
              y1="10"
              x2="7"
              y2="10"
              stroke="var(--color-secondary)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>
          {/* scissors — bottom-right: open blades with finger loops */}
          <g
            transform="translate(36 32)"
            stroke="var(--color-primary)"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          >
            <line x1="2" y1="2" x2="12" y2="13" />
            <line x1="12" y1="2" x2="2" y2="13" />
            <circle cx="2" cy="2" r="2" fill="var(--color-base-100)" />
            <circle cx="12" cy="2" r="2" fill="var(--color-base-100)" />
          </g>
        </svg>
      </div>
    );
  }

  if (type === "hearts") {
    // A heart perched atop a stylized Q♠ — the two cards that define Hearts.
    // The spade is the neutral silhouette behind; the heart pops in error red.
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <defs>
            <radialGradient id="hearts-bg" cx="50%" cy="45%" r="75%">
              <stop
                offset="0%"
                stopColor="var(--color-error)"
                stopOpacity="0.12"
              />
              <stop
                offset="100%"
                stopColor="var(--color-neutral)"
                stopOpacity="0.06"
              />
            </radialGradient>
          </defs>
          <rect width="56" height="56" fill="url(#hearts-bg)" />
          <g fill="var(--color-neutral)" opacity="0.85">
            <path d="M28 41
              C 18 33, 10 28, 14 21
              C 17 16, 24 17, 28 23
              C 32 17, 39 16, 42 21
              C 46 28, 38 33, 28 41 Z" />
            <path d="M24 43 L32 43 L30 38 L26 38 Z" />
          </g>
          <text
            x="28"
            y="33"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fontFamily="var(--font-display, serif)"
            fill="color-mix(in oklch, var(--color-base-100) 85%, transparent)"
            opacity="0.85"
          >
            Q
          </text>
          <path
            d="M28 19
              C 24 13, 16 14, 16 21
              C 16 26, 22 29, 28 34
              C 34 29, 40 26, 40 21
              C 40 14, 32 13, 28 19 Z"
            fill="var(--color-error)"
            stroke="color-mix(in oklch, var(--color-error) 60%, black)"
            strokeWidth="0.6"
            style={{
              filter: "drop-shadow(0 1px 1px oklch(0% 0 0 / 0.25))",
            }}
          />
        </svg>
      </div>
    );
  }

  if (type === "mancala") {
    // Mini Kalah board: oval basin with stores at each end and 3 pits per side.
    const pit = (cx: number, cy: number, seeds: { dx: number; dy: number }[]) => (
      <g key={`${cx},${cy}`}>
        <circle
          cx={cx}
          cy={cy}
          r="4.5"
          fill="color-mix(in oklch, var(--color-base-100) 85%, transparent)"
          stroke="color-mix(in oklch, var(--color-base-content) 22%, transparent)"
          strokeWidth="0.5"
        />
        {seeds.map((s, i) => (
          <circle
            key={i}
            cx={cx + s.dx}
            cy={cy + s.dy}
            r="1"
            fill="var(--color-warning)"
          />
        ))}
      </g>
    );
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <rect
            x="4"
            y="14"
            width="48"
            height="28"
            rx="10"
            fill="color-mix(in oklch, var(--color-primary) 55%, var(--color-base-300))"
            stroke="color-mix(in oklch, oklch(0% 0 0) 30%, transparent)"
            strokeWidth="0.75"
          />
          <ellipse
            cx="10.5"
            cy="28"
            rx="3.2"
            ry="9"
            fill="color-mix(in oklch, var(--color-base-100) 75%, var(--color-primary) 10%)"
            stroke="color-mix(in oklch, oklch(0% 0 0) 22%, transparent)"
            strokeWidth="0.5"
          />
          <circle cx="10" cy="24" r="1" fill="var(--color-warning)" />
          <circle cx="11.2" cy="27" r="1" fill="var(--color-warning)" />
          <circle cx="9.8" cy="30" r="1" fill="var(--color-warning)" />
          <circle cx="11" cy="33" r="1" fill="var(--color-warning)" />
          <ellipse
            cx="45.5"
            cy="28"
            rx="3.2"
            ry="9"
            fill="color-mix(in oklch, var(--color-base-100) 75%, var(--color-primary) 10%)"
            stroke="color-mix(in oklch, oklch(0% 0 0) 22%, transparent)"
            strokeWidth="0.5"
          />
          <circle cx="45" cy="25" r="1" fill="var(--color-warning)" />
          <circle cx="46" cy="28" r="1" fill="var(--color-warning)" />
          <circle cx="45" cy="31" r="1" fill="var(--color-warning)" />
          {pit(20, 22, [
            { dx: -1, dy: 0 },
            { dx: 1, dy: -0.5 },
          ])}
          {pit(28, 22, [
            { dx: 0, dy: 0 },
            { dx: -1.2, dy: 1 },
            { dx: 1.1, dy: -0.8 },
          ])}
          {pit(36, 22, [{ dx: 0.2, dy: 0 }])}
          {pit(20, 34, [
            { dx: -0.8, dy: -0.5 },
            { dx: 0.9, dy: 0.9 },
          ])}
          {pit(28, 34, [
            { dx: 0, dy: 0 },
            { dx: -1.1, dy: -0.8 },
          ])}
          {pit(36, 34, [
            { dx: 0, dy: 0 },
            { dx: 1, dy: 0.6 },
            { dx: -1, dy: 0.5 },
            { dx: 0.5, dy: -1 },
          ])}
        </svg>
      </div>
    );
  }

  if (type === "liars-dice") {
    // Three overlapping d6 silhouettes showing different faces — a small
    // dice cluster in the shadow of a tipped cup. Pips are painted as
    // small circles on each face.
    const cube = (
      x: number,
      y: number,
      size: number,
      tone: string,
      pipPositions: [number, number][],
      pipColor: string,
      tilt = 0,
    ) => {
      const pips = pipPositions.map(([px, py], i) => (
        <circle
          key={i}
          cx={x + px * size}
          cy={y + py * size}
          r={size * 0.085}
          fill={pipColor}
        />
      ));
      return (
        <g transform={`rotate(${tilt} ${x + size / 2} ${y + size / 2})`}>
          <rect
            x={x}
            y={y}
            width={size}
            height={size}
            rx={size * 0.18}
            fill={tone}
            stroke="color-mix(in oklch, currentColor 18%, transparent)"
            strokeWidth="0.6"
          />
          {/* top glint */}
          <rect
            x={x + size * 0.12}
            y={y + size * 0.1}
            width={size * 0.76}
            height={size * 0.16}
            rx={size * 0.08}
            fill="oklch(100% 0 0 / 0.22)"
          />
          {pips}
        </g>
      );
    };
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          {/* subtle back glow */}
          <defs>
            <radialGradient id="ld-bg" cx="50%" cy="55%" r="75%">
              <stop
                offset="0%"
                stopColor="var(--color-warning)"
                stopOpacity="0.2"
              />
              <stop
                offset="100%"
                stopColor="var(--color-neutral)"
                stopOpacity="0"
              />
            </radialGradient>
          </defs>
          <rect width="56" height="56" fill="url(#ld-bg)" />
          {/* back die — a 5, off-primary tone, tilted left */}
          {cube(
            6,
            16,
            22,
            "var(--color-secondary)",
            [
              [0.25, 0.25],
              [0.75, 0.25],
              [0.5, 0.5],
              [0.25, 0.75],
              [0.75, 0.75],
            ],
            "var(--color-secondary-content)",
            -12,
          )}
          {/* right die — a 3, primary tone, tilted right */}
          {cube(
            28,
            20,
            22,
            "var(--color-primary)",
            [
              [0.25, 0.25],
              [0.5, 0.5],
              [0.75, 0.75],
            ],
            "var(--color-primary-content)",
            8,
          )}
          {/* front die — a single pip, ivory */}
          {cube(
            17,
            30,
            20,
            "var(--color-base-100)",
            [[0.5, 0.5]],
            "var(--color-base-content)",
            -3,
          )}
        </svg>
      </div>
    );
  }

  if (type === "yahtzee") {
    // Four dice stacked in a loose pyramid, each showing a different face.
    const pipLayout: Record<number, [number, number][]> = {
      1: [[10, 10]],
      2: [[6, 6], [14, 14]],
      3: [[6, 6], [10, 10], [14, 14]],
      5: [[6, 6], [14, 6], [10, 10], [6, 14], [14, 14]],
      6: [[6, 6], [14, 6], [6, 10], [14, 10], [6, 14], [14, 14]],
    };
    const dice: {
      x: number;
      y: number;
      rot: number;
      face: keyof typeof pipLayout;
      fill: string;
    }[] = [
      { x: 6, y: 26, rot: -9, face: 5, fill: "var(--color-base-100)" },
      { x: 28, y: 30, rot: 6, face: 2, fill: "color-mix(in oklch, var(--color-warning) 35%, var(--color-base-100))" },
      { x: 18, y: 7, rot: -3, face: 3, fill: "color-mix(in oklch, var(--color-primary) 30%, var(--color-base-100))" },
      { x: 35, y: 10, rot: 14, face: 6, fill: "color-mix(in oklch, var(--color-secondary) 28%, var(--color-base-100))" },
    ];
    const dieSize = 16;
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <defs>
            <radialGradient id="yah-bg" cx="50%" cy="60%" r="70%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="56" height="56" fill="url(#yah-bg)" />
          {dice.map((d, i) => {
            const cx = d.x + dieSize / 2;
            const cy = d.y + dieSize / 2;
            return (
              <g key={i} transform={`rotate(${d.rot} ${cx} ${cy})`}>
                <rect
                  x={d.x}
                  y={d.y}
                  width={dieSize}
                  height={dieSize}
                  rx="3"
                  fill={d.fill}
                  stroke="color-mix(in oklch, var(--color-base-content) 28%, transparent)"
                  strokeWidth="0.9"
                />
                {pipLayout[d.face]!.map(([px, py], pi) => (
                  <circle
                    key={pi}
                    cx={d.x + (px / 20) * dieSize}
                    cy={d.y + (py / 20) * dieSize}
                    r="1.1"
                    fill="var(--color-base-content)"
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (type === "avalon") {
    // Round-table motif: an amber crown over two crossed swords — one
    // loyal (info-blue), one treacherous (error-red) — ringed by a shield.
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <defs>
            <radialGradient id="avalon-bg" cx="50%" cy="40%" r="75%">
              <stop offset="0%" stopColor="var(--color-warning)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--color-neutral)" stopOpacity="0.05" />
            </radialGradient>
          </defs>
          <rect width="56" height="56" fill="url(#avalon-bg)" />
          <circle
            cx="28"
            cy="32"
            r="19"
            fill="none"
            stroke="color-mix(in oklch, var(--color-neutral) 45%, transparent)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <g stroke="var(--color-info)" strokeWidth="2.4" strokeLinecap="round">
            <line x1="14" y1="44" x2="40" y2="22" />
          </g>
          <g stroke="var(--color-error)" strokeWidth="2.4" strokeLinecap="round">
            <line x1="16" y1="22" x2="42" y2="44" />
          </g>
          <circle cx="14" cy="44" r="1.8" fill="var(--color-info)" />
          <circle cx="42" cy="44" r="1.8" fill="var(--color-error)" />
          <g>
            <rect x="18" y="20" width="20" height="5" rx="1" fill="var(--color-warning)" />
            <polygon points="18,20 22,10 26,20" fill="var(--color-warning)" />
            <polygon points="24,20 28,8 32,20" fill="var(--color-warning)" />
            <polygon points="30,20 34,10 38,20" fill="var(--color-warning)" />
            <circle cx="22" cy="22.5" r="1" fill="var(--color-error)" />
            <circle cx="28" cy="22.5" r="1.1" fill="var(--color-info)" />
            <circle cx="34" cy="22.5" r="1" fill="var(--color-success)" />
          </g>
        </svg>
      </div>
    );
  }

  if (type === "coup") {
    // A short coin stack on the left, a fanned pair of face-down cards on
    // the right — bluffing + bankroll, the two things Coup is about.
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <defs>
            <radialGradient id="coup-bg" cx="50%" cy="55%" r="75%">
              <stop
                offset="0%"
                stopColor="var(--color-warning)"
                stopOpacity="0.18"
              />
              <stop
                offset="100%"
                stopColor="var(--color-neutral)"
                stopOpacity="0.04"
              />
            </radialGradient>
            <linearGradient id="coup-card-back" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-secondary)" />
            </linearGradient>
          </defs>
          <rect width="56" height="56" fill="url(#coup-bg)" />
          {/* coin tower (left) — 4 stacked coins */}
          <g>
            {[40, 34, 28, 22].map((cy, i) => (
              <g key={i}>
                <ellipse
                  cx="15"
                  cy={cy}
                  rx="8"
                  ry="2.6"
                  fill="var(--color-warning)"
                  stroke="color-mix(in oklch, oklch(0% 0 0) 35%, transparent)"
                  strokeWidth="0.6"
                />
                <ellipse
                  cx="15"
                  cy={cy - 0.8}
                  rx="6"
                  ry="1.2"
                  fill="oklch(100% 0 0 / 0.25)"
                />
              </g>
            ))}
            {/* the topmost coin gets a subtle rim */}
            <ellipse
              cx="15"
              cy="22"
              rx="3"
              ry="0.9"
              fill="color-mix(in oklch, var(--color-warning) 65%, black)"
              opacity="0.3"
            />
          </g>
          {/* fanned card pair (right) */}
          <g transform="translate(32 14)">
            {/* back card — tilted left */}
            <g transform="rotate(-15 8 18)">
              <rect
                x="0"
                y="0"
                width="16"
                height="22"
                rx="2"
                fill="url(#coup-card-back)"
                stroke="color-mix(in oklch, oklch(0% 0 0) 35%, transparent)"
                strokeWidth="0.75"
              />
              <rect
                x="1.5"
                y="1.5"
                width="13"
                height="19"
                rx="1.5"
                fill="none"
                stroke="oklch(100% 0 0 / 0.3)"
                strokeWidth="0.7"
              />
              {/* ornamental dot pattern on the back */}
              <circle cx="8" cy="11" r="1.6" fill="oklch(100% 0 0 / 0.55)" />
              <circle cx="8" cy="7" r="0.7" fill="oklch(100% 0 0 / 0.35)" />
              <circle cx="8" cy="15" r="0.7" fill="oklch(100% 0 0 / 0.35)" />
            </g>
            {/* front card — tilted right, overlapping */}
            <g transform="rotate(14 14 18)">
              <rect
                x="6"
                y="2"
                width="16"
                height="22"
                rx="2"
                fill="url(#coup-card-back)"
                stroke="color-mix(in oklch, oklch(0% 0 0) 35%, transparent)"
                strokeWidth="0.75"
              />
              <rect
                x="7.5"
                y="3.5"
                width="13"
                height="19"
                rx="1.5"
                fill="none"
                stroke="oklch(100% 0 0 / 0.3)"
                strokeWidth="0.7"
              />
              <circle cx="14" cy="13" r="1.6" fill="oklch(100% 0 0 / 0.55)" />
              <circle cx="14" cy="9" r="0.7" fill="oklch(100% 0 0 / 0.35)" />
              <circle cx="14" cy="17" r="0.7" fill="oklch(100% 0 0 / 0.35)" />
            </g>
          </g>
        </svg>
      </div>
    );
  }

  if (type === "love-letter") {
    // Sealed love letter — an envelope with a crimson heart-shaped wax seal
    // and a pale pink ribbon flourish.
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <defs>
            <radialGradient id="ll-bg" cx="50%" cy="35%" r="80%">
              <stop
                offset="0%"
                stopColor="var(--color-error)"
                stopOpacity="0.12"
              />
              <stop
                offset="100%"
                stopColor="var(--color-base-300)"
                stopOpacity="0.05"
              />
            </radialGradient>
          </defs>
          <rect width="56" height="56" fill="url(#ll-bg)" />
          {/* envelope body */}
          <rect
            x="8"
            y="16"
            width="40"
            height="28"
            rx="2.5"
            fill="var(--color-base-100)"
            stroke="color-mix(in oklch, var(--color-neutral) 45%, transparent)"
            strokeWidth="1.2"
          />
          {/* envelope flap (triangle at top) */}
          <path
            d="M8 18.5 L28 33 L48 18.5"
            fill="color-mix(in oklch, var(--color-base-200) 80%, var(--color-neutral) 10%)"
            stroke="color-mix(in oklch, var(--color-neutral) 45%, transparent)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* envelope bottom folds (faint) */}
          <g
            stroke="color-mix(in oklch, var(--color-neutral) 25%, transparent)"
            strokeWidth="0.8"
            fill="none"
          >
            <line x1="8" y1="44" x2="22" y2="32" />
            <line x1="48" y1="44" x2="34" y2="32" />
          </g>
          {/* heart wax seal in the center */}
          <g
            style={{
              filter: "drop-shadow(0 1px 1px oklch(0% 0 0 / 0.3))",
            }}
          >
            <path
              d="M28 36
                C 22 31, 18 28, 20 24
                C 22 21, 26 21.5, 28 25
                C 30 21.5, 34 21, 36 24
                C 38 28, 34 31, 28 36 Z"
              fill="var(--color-error)"
              stroke="color-mix(in oklch, var(--color-error) 55%, black)"
              strokeWidth="0.75"
            />
            {/* seal highlight */}
            <ellipse
              cx="25"
              cy="25"
              rx="1.6"
              ry="1"
              fill="oklch(100% 0 0 / 0.35)"
            />
            {/* a subtle "8" stamped into the seal — nods to Princess rank */}
            <text
              x="28"
              y="32.5"
              textAnchor="middle"
              fontSize="5"
              fontWeight="700"
              fontFamily="var(--font-display, serif)"
              fill="color-mix(in oklch, var(--color-error) 45%, black)"
              opacity="0.8"
            >
              8
            </text>
          </g>
        </svg>
      </div>
    );
  }

  if (type === "secret-hitler") {
    // Crossed Liberal (info-blue) and Fascist (error-red) policy cards
    // over a ballot box, with a question-mark medallion where they cross.
    return (
      <div className={wrap}>
        <svg viewBox="0 0 56 56" className="h-full w-full">
          <defs>
            <radialGradient id="sh-bg" cx="50%" cy="35%" r="80%">
              <stop
                offset="0%"
                stopColor="var(--color-error)"
                stopOpacity="0.15"
              />
              <stop
                offset="100%"
                stopColor="var(--color-neutral)"
                stopOpacity="0.05"
              />
            </radialGradient>
          </defs>
          <rect width="56" height="56" fill="url(#sh-bg)" />
          {/* ballot box */}
          <rect
            x="14"
            y="36"
            width="28"
            height="14"
            rx="1.5"
            fill="var(--color-neutral)"
            stroke="color-mix(in oklch, oklch(0% 0 0) 40%, transparent)"
            strokeWidth="0.6"
          />
          <rect
            x="24"
            y="38"
            width="8"
            height="1.6"
            rx="0.6"
            fill="color-mix(in oklch, oklch(0% 0 0) 55%, transparent)"
          />
          <rect
            x="14"
            y="36"
            width="28"
            height="2"
            fill="oklch(100% 0 0 / 0.12)"
          />
          {/* Liberal card (blue) tilted left */}
          <g transform="translate(14 9) rotate(-18 8 11)">
            <rect
              x="0"
              y="0"
              width="16"
              height="22"
              rx="2"
              fill="var(--color-info)"
              stroke="color-mix(in oklch, var(--color-info) 35%, black)"
              strokeWidth="0.6"
            />
            <text
              x="8"
              y="15"
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fontFamily="var(--font-display, serif)"
              fill="var(--color-info-content)"
            >
              L
            </text>
          </g>
          {/* Fascist card (red) tilted right, overlapping */}
          <g transform="translate(26 9) rotate(18 8 11)">
            <rect
              x="0"
              y="0"
              width="16"
              height="22"
              rx="2"
              fill="var(--color-error)"
              stroke="color-mix(in oklch, var(--color-error) 40%, black)"
              strokeWidth="0.6"
            />
            <text
              x="8"
              y="15"
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fontFamily="var(--font-display, serif)"
              fill="var(--color-error-content)"
            >
              F
            </text>
          </g>
          {/* Question-mark badge where the cards cross */}
          <circle
            cx="28"
            cy="24"
            r="5.5"
            fill="var(--color-base-100)"
            stroke="color-mix(in oklch, var(--color-base-content) 30%, transparent)"
            strokeWidth="0.8"
          />
          <text
            x="28"
            y="27.6"
            textAnchor="middle"
            fontSize="9"
            fontWeight="800"
            fontFamily="var(--font-display, serif)"
            fill="var(--color-base-content)"
          >
            ?
          </text>
        </svg>
      </div>
    );
  }

  if (type === "skull") {
    // Three stacked face-down discs with a single skull peeking — evokes the
    // "place a disc, bluff about your skull" vibe.
    return (
      <div className={wrap}>
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 w-full h-full p-1.5"
          aria-hidden
        >
          <defs>
            <radialGradient id="skull-disc" cx="0.35" cy="0.35">
              <stop offset="0%" stopColor="oklch(55% 0.02 260)" />
              <stop offset="100%" stopColor="oklch(20% 0.02 260)" />
            </radialGradient>
            <radialGradient id="skull-face" cx="0.35" cy="0.35">
              <stop
                offset="0%"
                stopColor="color-mix(in oklch, var(--color-error) 75%, white)"
              />
              <stop
                offset="100%"
                stopColor="color-mix(in oklch, var(--color-error) 65%, black)"
              />
            </radialGradient>
          </defs>
          {/* bottom disc */}
          <ellipse
            cx="28"
            cy="44"
            rx="18"
            ry="5"
            fill="url(#skull-disc)"
            opacity="0.6"
          />
          {/* middle disc */}
          <ellipse
            cx="28"
            cy="36"
            rx="19"
            ry="5.5"
            fill="url(#skull-disc)"
            opacity="0.85"
          />
          {/* skull disc on top */}
          <circle cx="28" cy="22" r="14" fill="url(#skull-face)" />
          {/* Eye sockets */}
          <circle cx="23" cy="21" r="3" fill="oklch(15% 0.02 25)" />
          <circle cx="33" cy="21" r="3" fill="oklch(15% 0.02 25)" />
          {/* teeth */}
          <rect
            x="24.5"
            y="27"
            width="7"
            height="3.5"
            rx="0.8"
            fill="oklch(100% 0 0 / 0.7)"
          />
          <line
            x1="26"
            y1="27"
            x2="26"
            y2="30.5"
            stroke="oklch(15% 0.02 25)"
            strokeWidth="0.7"
          />
          <line
            x1="28"
            y1="27"
            x2="28"
            y2="30.5"
            stroke="oklch(15% 0.02 25)"
            strokeWidth="0.7"
          />
          <line
            x1="30"
            y1="27"
            x2="30"
            y2="30.5"
            stroke="oklch(15% 0.02 25)"
            strokeWidth="0.7"
          />
        </svg>
      </div>
    );
  }

  if (type === "quoridor") {
    // 3x3 grid corner with two pawns and a single wall between cells.
    const cell = "color-mix(in oklch, var(--color-base-100) 85%, transparent)";
    return (
      <div className={wrap}>
        <div
          className="absolute inset-1.5 grid grid-cols-3 grid-rows-3 gap-[3px] rounded-sm"
          style={{
            background:
              "color-mix(in oklch, var(--color-base-300) 85%, transparent)",
            padding: "3px",
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="rounded-[2px]"
              style={{ background: cell }}
            />
          ))}
        </div>
        {/* Wall — horizontal, between row 1 and row 2, spanning cols 0..1 */}
        <div
          className="absolute rounded-[2px]"
          style={{
            left: "15%",
            right: "36%",
            top: "46%",
            height: "5%",
            background:
              "color-mix(in oklch, var(--color-warning) 60%, var(--color-base-content))",
            boxShadow: "0 1px 2px oklch(0% 0 0 / 0.25)",
          }}
        />
        {/* Pawn 1 — top-right */}
        <span
          className="absolute rounded-full"
          style={{
            top: "18%",
            left: "62%",
            width: "14%",
            height: "14%",
            background:
              "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--color-primary) 80%, white), var(--color-primary))",
            boxShadow: "0 1px 2px oklch(0% 0 0 / 0.3)",
          }}
        />
        {/* Pawn 2 — bottom-left */}
        <span
          className="absolute rounded-full"
          style={{
            top: "68%",
            left: "20%",
            width: "14%",
            height: "14%",
            background:
              "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--color-error) 80%, white), var(--color-error))",
            boxShadow: "0 1px 2px oklch(0% 0 0 / 0.3)",
          }}
        />
      </div>
    );
  }

  if (type === "for-sale") {
    // A stack of numbered property cards fanned out — and a single cheque
    // poking from behind.
    return (
      <div className={wrap}>
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 w-full h-full p-2"
          aria-hidden
        >
          {/* Cheque in back */}
          <g transform="translate(8 10) rotate(-8)">
            <rect
              width="30"
              height="16"
              rx="2"
              fill="color-mix(in oklch, var(--color-success) 35%, var(--color-base-100))"
              stroke="color-mix(in oklch, var(--color-success) 60%, black)"
              strokeWidth="0.8"
            />
            <text
              x="15"
              y="11"
              textAnchor="middle"
              fontSize="7"
              fontWeight="800"
              fontFamily="var(--font-display, serif)"
              fill="var(--color-base-content)"
            >
              $12
            </text>
          </g>
          {/* Middle property card */}
          <g transform="translate(14 16) rotate(4)">
            <rect
              width="18"
              height="26"
              rx="2"
              fill="color-mix(in oklch, var(--color-warning) 35%, var(--color-base-100))"
              stroke="color-mix(in oklch, var(--color-warning) 65%, black)"
              strokeWidth="0.8"
            />
            <text
              x="9"
              y="18"
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fontFamily="var(--font-display, serif)"
              fill="var(--color-base-content)"
            >
              18
            </text>
          </g>
          {/* Front property card */}
          <g transform="translate(24 20) rotate(-3)">
            <rect
              width="18"
              height="26"
              rx="2"
              fill="color-mix(in oklch, var(--color-error) 40%, var(--color-base-100))"
              stroke="color-mix(in oklch, var(--color-error) 70%, black)"
              strokeWidth="0.8"
            />
            <text
              x="9"
              y="18"
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fontFamily="var(--font-display, serif)"
              fill="var(--color-base-content)"
            >
              27
            </text>
          </g>
        </svg>
      </div>
    );
  }

  if (type === "splendor") {
    // Five small gem tokens fanned below a single card with a bonus pip —
    // communicates "tokens fund cards that fund more tokens."
    return (
      <div className={wrap}>
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 w-full h-full p-1"
          aria-hidden
        >
          {/* Card */}
          <rect
            x="16"
            y="8"
            width="24"
            height="22"
            rx="2.5"
            fill="color-mix(in oklch, var(--color-base-100) 88%, transparent)"
            stroke="color-mix(in oklch, var(--color-primary) 55%, black)"
            strokeWidth="0.8"
          />
          <text
            x="35.5"
            y="16"
            textAnchor="end"
            fontSize="7"
            fontWeight="800"
            fontFamily="var(--font-display, serif)"
            fill="var(--color-base-content)"
          >
            3
          </text>
          {/* Card bonus pip */}
          <circle
            cx="21"
            cy="14"
            r="3"
            fill="color-mix(in oklch, var(--color-info) 65%, black)"
            stroke="color-mix(in oklch, var(--color-info) 80%, white)"
            strokeWidth="0.6"
          />
          {/* Gem tokens */}
          {(
            [
              {
                cx: 10,
                cy: 40,
                fill: "color-mix(in oklch, var(--color-info) 60%, black)",
              },
              {
                cx: 20,
                cy: 44,
                fill: "color-mix(in oklch, var(--color-success) 60%, black)",
              },
              {
                cx: 30,
                cy: 46,
                fill: "color-mix(in oklch, var(--color-warning) 60%, black)",
              },
              {
                cx: 40,
                cy: 44,
                fill: "color-mix(in oklch, var(--color-error) 60%, black)",
              },
              {
                cx: 48,
                cy: 40,
                fill: "oklch(30% 0.02 260)",
              },
            ] as Array<{ cx: number; cy: number; fill: string }>
          ).map((g, i) => (
            <g key={i}>
              <circle
                cx={g.cx}
                cy={g.cy}
                r="5"
                fill={g.fill}
                stroke="oklch(100% 0 0 / 0.35)"
                strokeWidth="0.6"
              />
              <ellipse
                cx={g.cx - 1.5}
                cy={g.cy - 1.6}
                rx="1.6"
                ry="1"
                fill="oklch(100% 0 0 / 0.5)"
              />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (type === "no-thanks") {
    // A "card on offer" with chips piled on top — minimal, signals the bid.
    return (
      <div className={wrap}>
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 w-full h-full p-1.5"
          aria-hidden
        >
          {/* Card */}
          <rect
            x="14"
            y="10"
            width="28"
            height="36"
            rx="3"
            fill="color-mix(in oklch, var(--color-info) 65%, var(--color-base-100))"
            stroke="color-mix(in oklch, var(--color-info) 75%, black)"
            strokeWidth="0.8"
          />
          <text
            x="28"
            y="33"
            textAnchor="middle"
            fontSize="14"
            fontWeight="800"
            fontFamily="var(--font-display, serif)"
            fill="oklch(96% 0.02 240)"
          >
            17
          </text>
          {/* Chips piled */}
          {[
            { cx: 20, cy: 14, r: 4 },
            { cx: 28, cy: 12, r: 4 },
            { cx: 36, cy: 14, r: 4 },
            { cx: 24, cy: 8, r: 3.5 },
            { cx: 32, cy: 8, r: 3.5 },
          ].map((c, i) => (
            <g key={i}>
              <circle
                cx={c.cx}
                cy={c.cy}
                r={c.r}
                fill="color-mix(in oklch, var(--color-warning) 75%, white)"
                stroke="color-mix(in oklch, var(--color-warning) 65%, black)"
                strokeWidth="0.5"
              />
              <ellipse
                cx={c.cx - 1}
                cy={c.cy - 1}
                rx="1.5"
                ry="0.8"
                fill="oklch(100% 0 0 / 0.55)"
              />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (type === "pentago") {
    // 6×6 board hinted by a 2×2 of mini-quadrants, with a curved arrow showing
    // the rotation mechanic.
    return (
      <div className={wrap}>
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 w-full h-full p-1"
          aria-hidden
        >
          {/* Four quadrants */}
          {[
            { x: 6, y: 6, fill: "color-mix(in oklch, var(--color-base-300) 70%, var(--color-info))" },
            { x: 30, y: 6, fill: "color-mix(in oklch, var(--color-base-300) 70%, var(--color-success))" },
            { x: 6, y: 30, fill: "color-mix(in oklch, var(--color-base-300) 70%, var(--color-warning))" },
            { x: 30, y: 30, fill: "color-mix(in oklch, var(--color-base-300) 70%, var(--color-error))" },
          ].map((q, i) => (
            <rect
              key={i}
              x={q.x}
              y={q.y}
              width="20"
              height="20"
              rx="2"
              fill={q.fill}
              stroke="color-mix(in oklch, var(--color-base-content) 35%, transparent)"
              strokeWidth="0.5"
            />
          ))}
          {/* A few stones */}
          <circle cx="14" cy="14" r="3" fill="oklch(95% 0.01 90)" stroke="oklch(0% 0 0 / 0.4)" strokeWidth="0.3" />
          <circle cx="22" cy="22" r="3" fill="oklch(20% 0.01 260)" />
          <circle cx="38" cy="14" r="3" fill="oklch(20% 0.01 260)" />
          <circle cx="46" cy="46" r="3" fill="oklch(95% 0.01 90)" stroke="oklch(0% 0 0 / 0.4)" strokeWidth="0.3" />
          <circle cx="14" cy="38" r="3" fill="oklch(95% 0.01 90)" stroke="oklch(0% 0 0 / 0.4)" strokeWidth="0.3" />
          <circle cx="38" cy="38" r="3" fill="oklch(20% 0.01 260)" />
          {/* Rotation arrow on top-right */}
          <path
            d="M 36 8 A 6 6 0 0 1 48 14"
            stroke="var(--color-base-content)"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 47 11 L 48 14 L 45 14"
            stroke="var(--color-base-content)"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (type === "sushi-go") {
    // A small fan of sushi cards: a nigiri, a maki, a tempura.
    return (
      <div className={wrap}>
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 w-full h-full p-1"
          aria-hidden
        >
          {/* Three cards fanned */}
          {[
            { x: 5, y: 14, rot: -10, fill: "color-mix(in oklch, var(--color-warning) 70%, white)" },
            { x: 18, y: 10, rot: 0, fill: "color-mix(in oklch, var(--color-error) 60%, white)" },
            { x: 31, y: 14, rot: 10, fill: "color-mix(in oklch, var(--color-success) 65%, white)" },
          ].map((c, i) => (
            <g key={i} transform={`rotate(${c.rot} ${c.x + 9} ${c.y + 16})`}>
              <rect
                x={c.x}
                y={c.y}
                width="18"
                height="32"
                rx="2"
                fill={c.fill}
                stroke="color-mix(in oklch, var(--color-base-content) 30%, transparent)"
                strokeWidth="0.5"
              />
            </g>
          ))}
          {/* Center card pictogram (salmon nigiri) */}
          <ellipse cx="27" cy="32" rx="8" ry="2" fill="oklch(96% 0.01 80)" stroke="oklch(0% 0 0 / 0.3)" strokeWidth="0.3" />
          <ellipse cx="27" cy="29" rx="8" ry="2.5" fill="oklch(72% 0.14 30)" stroke="oklch(0% 0 0 / 0.3)" strokeWidth="0.3" />
          <line x1="20" y1="29" x2="34" y2="29" stroke="oklch(95% 0.04 30)" strokeWidth="0.6" />
          {/* Chopsticks */}
          <line x1="38" y1="48" x2="50" y2="36" stroke="oklch(50% 0.05 60)" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="40" y1="50" x2="52" y2="38" stroke="oklch(50% 0.05 60)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (type === "hanabi") {
    // Fireworks bursts in three colors — readable at small sizes.
    return (
      <div className={wrap}>
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 w-full h-full p-1"
          aria-hidden
        >
          {/* Background dark sky */}
          <rect
            x="2"
            y="2"
            width="52"
            height="52"
            rx="3"
            fill="color-mix(in oklch, oklch(20% 0.02 260) 90%, var(--color-base-100))"
          />
          {/* Three bursts */}
          {[
            { cx: 18, cy: 18, color: "oklch(75% 0.18 30)" }, // red
            { cx: 38, cy: 22, color: "oklch(85% 0.16 90)" }, // yellow
            { cx: 28, cy: 38, color: "oklch(70% 0.14 245)" }, // blue
          ].map((b, i) => (
            <g key={i}>
              {Array.from({ length: 8 }).map((_, k) => {
                const a = (k * Math.PI) / 4;
                const x2 = b.cx + Math.cos(a) * 8;
                const y2 = b.cy + Math.sin(a) * 8;
                return (
                  <line
                    key={k}
                    x1={b.cx}
                    y1={b.cy}
                    x2={x2}
                    y2={y2}
                    stroke={b.color}
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                );
              })}
              {Array.from({ length: 8 }).map((_, k) => {
                const a = (k * Math.PI) / 4;
                const cx = b.cx + Math.cos(a) * 9.5;
                const cy = b.cy + Math.sin(a) * 9.5;
                return (
                  <circle
                    key={k}
                    cx={cx}
                    cy={cy}
                    r="1.2"
                    fill={b.color}
                  />
                );
              })}
              <circle
                cx={b.cx}
                cy={b.cy}
                r="2"
                fill="oklch(100% 0 0 / 0.85)"
              />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (type === "go-fish") {
    // A fanned pair of cards above a ripple with a small fish silhouette —
    // reads as "cards + pond" at every size.
    return (
      <div className={wrap}>
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          {/* Soft pond backdrop */}
          <rect
            x="2"
            y="2"
            width="52"
            height="52"
            rx="5"
            fill="color-mix(in oklch, var(--color-info) 16%, var(--color-base-100))"
          />
          {/* Water ripples */}
          <g
            stroke="color-mix(in oklch, var(--color-info) 55%, transparent)"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M 8 42 Q 14 39, 20 42 T 32 42 T 44 42 T 50 42" />
            <path
              d="M 10 47 Q 16 44, 22 47 T 34 47 T 46 47"
              opacity="0.55"
            />
          </g>
          {/* Fish silhouette */}
          <g
            fill="color-mix(in oklch, var(--color-primary) 75%, var(--color-base-content))"
          >
            <path d="M 14 37 C 17 34, 23 34, 26 37 C 23 40, 17 40, 14 37 Z" />
            <path d="M 11 37 L 14.5 34.5 L 14.5 39.5 Z" />
            <circle cx="23" cy="36.4" r="0.8" fill="var(--color-base-100)" />
          </g>
          {/* Back card (tilted left) */}
          <g transform="translate(20, 10) rotate(-14)">
            <rect
              x="0"
              y="0"
              width="18"
              height="26"
              rx="2.5"
              fill="var(--color-base-100)"
              stroke="color-mix(in oklch, var(--color-base-content) 22%, transparent)"
              strokeWidth="1"
            />
            <text
              x="3"
              y="9"
              fontSize="7"
              fontWeight={700}
              fontFamily="var(--font-display, serif)"
              fill="var(--color-error)"
              letterSpacing="-0.04em"
            >
              7
            </text>
            {/* Heart pip */}
            <path
              d="M 9 14 C 7 12, 4 10, 4 8 C 4 6.6, 5 5.6, 6.2 5.6 C 7.2 5.6, 8.2 6.2, 8.8 7 C 9.4 6.2, 10.4 5.6, 11.4 5.6 C 12.6 5.6, 13.6 6.6, 13.6 8 C 13.6 10, 10.6 12, 9 14 Z"
              fill="var(--color-error)"
              transform="translate(0, 4) scale(0.85)"
            />
          </g>
          {/* Front card (tilted right) */}
          <g transform="translate(26, 12) rotate(16)">
            <rect
              x="0"
              y="0"
              width="18"
              height="26"
              rx="2.5"
              fill="var(--color-base-100)"
              stroke="color-mix(in oklch, var(--color-base-content) 28%, transparent)"
              strokeWidth="1"
            />
            <text
              x="3"
              y="9"
              fontSize="7"
              fontWeight={700}
              fontFamily="var(--font-display, serif)"
              fill="var(--color-base-content)"
              letterSpacing="-0.04em"
            >
              A
            </text>
            {/* Spade pip */}
            <path
              d="M 9 16 C 9 16, 3.5 11, 3.5 7.6 C 3.5 6, 4.8 4.7, 6.4 4.7 C 7.4 4.7, 8.3 5.2, 8.7 5.9 L 8.1 10 L 9.9 10 L 9.3 5.9 C 9.7 5.2, 10.6 4.7, 11.6 4.7 C 13.2 4.7, 14.5 6, 14.5 7.6 C 14.5 11, 9 16, 9 16 Z"
              fill="var(--color-base-content)"
              transform="translate(0, 3) scale(0.85)"
            />
          </g>
          {/* Bubble trail */}
          <g fill="color-mix(in oklch, var(--color-info) 60%, var(--color-base-100))">
            <circle cx="44" cy="36" r="1.4" />
            <circle cx="47" cy="32" r="0.9" />
            <circle cx="49" cy="28" r="0.7" />
          </g>
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
