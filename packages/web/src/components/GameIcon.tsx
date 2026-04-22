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
          {/* Q♠ silhouette — spade symbol with a subtle Q inside */}
          <g fill="var(--color-neutral)" opacity="0.85">
            {/* spade shape (approx — two mirrored bezier bulbs and a triangle stem) */}
            <path d="M28 41
              C 18 33, 10 28, 14 21
              C 17 16, 24 17, 28 23
              C 32 17, 39 16, 42 21
              C 46 28, 38 33, 28 41 Z" />
            {/* stem */}
            <path d="M24 43 L32 43 L30 38 L26 38 Z" />
          </g>
          {/* subtle "Q" carved into the spade */}
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
          {/* heart resting over the crown */}
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
    // Mini Kalah board: oval basin with stores at each end and 3 pits per side
    // (scaled-down from the real 6). A few warm-tone stones scattered inside.
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
          {/* wooden basin */}
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
          {/* left store */}
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
          {/* right store */}
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
          {/* top row of 3 pits */}
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
          {/* bottom row of 3 pits */}
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

  // Fallback — a single tinted die
  return (
    <div className={wrap}>
      <div className="absolute inset-0 flex items-center justify-center text-2xl font-display text-primary">
        ◆
      </div>
    </div>
  );
}
