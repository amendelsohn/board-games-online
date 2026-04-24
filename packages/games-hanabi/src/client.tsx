import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card as CardShell,
  type BoardProps,
  type CardSize,
  type ClientGameModule,
} from "@bgo/sdk-client";
import {
  COLORS,
  FUSE_TOKENS_MAX,
  HANABI_TYPE,
  INFO_TOKENS_MAX,
  RANKS,
  type CardKnowledge,
  type HanabiColor,
  type HanabiConfig,
  type HanabiHandCardView,
  type HanabiMove,
  type HanabiRank,
  type HanabiView,
} from "./shared";

// ------------------------- Card visuals -------------------------

const COLOR_HEX: Record<HanabiColor, { bg: string; ink: string }> = {
  red: { bg: "oklch(64% 0.18 25)", ink: "oklch(96% 0.02 25)" },
  yellow: { bg: "oklch(82% 0.16 90)", ink: "oklch(28% 0.06 90)" },
  green: { bg: "oklch(58% 0.14 145)", ink: "oklch(96% 0.02 145)" },
  blue: { bg: "oklch(56% 0.14 245)", ink: "oklch(96% 0.02 245)" },
  white: { bg: "oklch(92% 0.01 80)", ink: "oklch(20% 0.01 80)" },
};

function HandCard({
  card,
  size = "md",
  showIdentity,
  highlight,
  onClick,
  selected,
  ghost,
  bigKnowledge,
  strikeDiscard,
}: {
  card: HanabiHandCardView;
  size?: CardSize;
  /** True when this card's color/rank are visible to the viewer. */
  showIdentity: boolean;
  highlight?: boolean;
  onClick?: () => void;
  selected?: boolean;
  ghost?: boolean;
  /** Scale knowledge dots + rank text for larger-sized own-hand cards. */
  bigKnowledge?: boolean;
  /** Show a strike-through indicator that discard is disabled. */
  strikeDiscard?: boolean;
}) {
  const knownColor =
    card.knowledge.possibleColors.length === 1
      ? card.knowledge.possibleColors[0]!
      : null;
  const knownRank =
    card.knowledge.possibleRanks.length === 1
      ? card.knowledge.possibleRanks[0]!
      : null;

  // What color do we paint the card face? If the viewer can see the actual
  // identity, use that. Otherwise prefer "known" (definitive single possibility).
  const visibleColor = showIdentity ? card.color : knownColor;
  const visibleRank = showIdentity ? card.rank : knownRank;

  // Partial knowledge (some info but not full identity) — dashed border.
  const hasPartialKnowledge =
    !showIdentity &&
    (card.knowledge.toldColors.length > 0 || card.knowledge.toldRanks.length > 0) &&
    (visibleColor === null || visibleRank === null);

  return (
    <CardShell
      size={size}
      selected={selected}
      ghost={ghost}
      highlight={highlight ? "warning" : undefined}
      onClick={onClick}
      ariaLabel={
        showIdentity
          ? `${visibleColor ?? "unknown"} ${visibleRank ?? "?"}`
          : `your card${visibleColor ? `, known ${visibleColor}` : ""}${visibleRank ? `, known ${visibleRank}` : ""}`
      }
      style={
        hasPartialKnowledge
          ? {
              outline: "1px dashed color-mix(in oklch, var(--color-primary) 55%, transparent)",
              outlineOffset: -3,
            }
          : undefined
      }
    >
      {!showIdentity && visibleColor === null && visibleRank === null ? (
        <HanabiCardBack />
      ) : (
        <HanabiFace color={visibleColor} rank={visibleRank} />
      )}
      {strikeDiscard && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 3,
            right: 4,
            fontSize: 12,
            fontWeight: 800,
            color: "var(--color-error)",
            opacity: 0.75,
            textShadow: "0 0 2px oklch(100% 0 0 / 0.9)",
          }}
        >
          ✕
        </span>
      )}
      <div
        style={{
          position: "absolute",
          left: 4,
          right: 4,
          bottom: 3,
        }}
      >
        <KnowledgeStrip k={card.knowledge} big={bigKnowledge} />
      </div>
    </CardShell>
  );
}

/**
 * Face-down Hanabi card — repeated firework-silhouette motif on warm
 * parchment. Visually distinct from any known-color face so the own-hand
 * panel reads as "closed book" at a glance.
 */
function HanabiCardBack() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(160deg, color-mix(in oklch, var(--color-warning) 14%, var(--color-base-100)) 0%, color-mix(in oklch, var(--color-warning) 22%, var(--color-base-200)) 100%)",
      }}
    >
      <svg
        viewBox="0 0 100 140"
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        style={{ display: "block", opacity: 0.38 }}
      >
        <defs>
          <pattern
            id="hanabi-back-pattern"
            x="0"
            y="0"
            width="22"
            height="26"
            patternUnits="userSpaceOnUse"
          >
            <g
              stroke="color-mix(in oklch, var(--color-warning) 70%, black)"
              strokeWidth="0.7"
              strokeLinecap="round"
              fill="none"
            >
              <g transform="translate(11 13)">
                {[0, 45, 90, 135].map((deg) => (
                  <line
                    key={deg}
                    x1="0"
                    y1="-4"
                    x2="0"
                    y2="4"
                    transform={`rotate(${deg})`}
                  />
                ))}
              </g>
            </g>
            <circle
              cx="11"
              cy="13"
              r="0.9"
              fill="color-mix(in oklch, var(--color-warning) 80%, black)"
            />
          </pattern>
        </defs>
        <rect width="100" height="140" fill="url(#hanabi-back-pattern)" />
        {/* Central monogram cartouche */}
        <g transform="translate(50 70)">
          <circle
            r="18"
            fill="color-mix(in oklch, var(--color-base-100) 85%, transparent)"
            stroke="color-mix(in oklch, var(--color-warning) 60%, black)"
            strokeWidth="0.8"
            opacity="0.9"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-display, serif)"
            fontSize="13"
            fontWeight={800}
            letterSpacing="-0.02em"
            fill="color-mix(in oklch, var(--color-warning) 60%, black)"
          >
            H
          </text>
        </g>
      </svg>
    </div>
  );
}

/**
 * Hanabi card face — a firework starburst in the card color, with a large
 * central rank numeral. Falls back to a neutral muted face when the
 * viewer doesn't know color or rank.
 */
function HanabiFace({
  color,
  rank,
}: {
  color: HanabiColor | null;
  rank: HanabiRank | null;
}) {
  const tint = color ? COLOR_HEX[color] : null;
  const bg = tint
    ? `linear-gradient(160deg, ${tint.bg}, color-mix(in oklch, ${tint.bg} 78%, black))`
    : "linear-gradient(160deg, color-mix(in oklch, var(--color-neutral) 30%, var(--color-base-100)), color-mix(in oklch, var(--color-neutral) 50%, var(--color-base-100)))";
  const ink = tint?.ink ?? "var(--color-base-content)";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: bg,
        color: ink,
      }}
    >
      <svg
        viewBox="0 0 100 140"
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ display: "block", color: ink }}
      >
        {/* Starburst */}
        <g
          transform="translate(50, 56)"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.55"
        >
          {[0, 30, 60, 90, 120, 150].map((deg) => (
            <line
              key={deg}
              x1="0"
              y1="0"
              x2="0"
              y2="-30"
              transform={`rotate(${deg})`}
            />
          ))}
          {[0, 30, 60, 90, 120, 150].map((deg) => (
            <line
              key={`s${deg}`}
              x1="0"
              y1="0"
              x2="0"
              y2="30"
              transform={`rotate(${deg})`}
            />
          ))}
          {/* Sparkle dots at the tips */}
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <circle
              key={`p${deg}`}
              cx={Math.sin((deg * Math.PI) / 180) * 26}
              cy={-Math.cos((deg * Math.PI) / 180) * 26}
              r="1.6"
              fill="currentColor"
            />
          ))}
        </g>
        {/* Rank corner */}
        <text
          x="9"
          y="18"
          fontSize="13"
          fontWeight={800}
          fontFamily="var(--font-display, serif)"
          fill="currentColor"
        >
          {rank ?? "?"}
        </text>
        <text
          x="91"
          y="132"
          textAnchor="end"
          fontSize="13"
          fontWeight={800}
          fontFamily="var(--font-display, serif)"
          fill="currentColor"
          transform="rotate(180, 91, 128)"
        >
          {rank ?? "?"}
        </text>
        {/* Big central rank */}
        <text
          x="50"
          y="74"
          textAnchor="middle"
          fontSize="38"
          fontWeight={800}
          fontFamily="var(--font-display, serif)"
          fill="currentColor"
          letterSpacing="-0.04em"
        >
          {rank ?? "·"}
        </text>
      </svg>
    </div>
  );
}

function KnowledgeStrip({ k, big }: { k: CardKnowledge; big?: boolean }) {
  // Show small dots for surviving possibilities. Bold means "told yes".
  const possC = new Set(k.possibleColors);
  const toldC = new Set(k.toldColors);
  const possR = new Set(k.possibleRanks);
  const toldR = new Set(k.toldRanks);
  const dotBase = big ? 7 : 5;
  const dotTold = big ? 9 : 7;
  const rankFs = big ? 11 : 8;
  return (
    <div className="flex items-center justify-between gap-1">
      <div className="flex gap-[2px]">
        {COLORS.map((c) => {
          const possible = possC.has(c);
          const told = toldC.has(c);
          if (!possible) return null;
          return (
            <span
              key={c}
              className="rounded-full"
              style={{
                width: told ? dotTold : dotBase,
                height: told ? dotTold : dotBase,
                background: COLOR_HEX[c].bg,
                boxShadow: told
                  ? "0 0 0 1.5px oklch(100% 0 0 / 0.7)"
                  : "0 0 0 0.5px oklch(0% 0 0 / 0.3)",
              }}
              title={told ? `told ${c}` : `could be ${c}`}
            />
          );
        })}
      </div>
      <div className="flex gap-[1px]">
        {RANKS.map((r) => {
          const possible = possR.has(r);
          const told = toldR.has(r);
          if (!possible) return null;
          return (
            <span
              key={r}
              className="tabular leading-none px-[1px]"
              style={{
                fontSize: rankFs,
                fontWeight: told ? 800 : 500,
                opacity: told ? 1 : 0.6,
              }}
            >
              {r}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------- Played stacks -------------------------

function StacksView({
  played,
  pulseColor,
}: {
  played: HanabiView["played"];
  pulseColor: HanabiColor | null;
}) {
  return (
    <div className="flex gap-3 flex-wrap justify-center">
      {COLORS.map((color) => {
        const top = played[color] ?? 0;
        const complete = top === 5;
        const shouldPulse = pulseColor === color;
        return (
          <div key={color} className="flex flex-col items-center gap-1">
            <div
              className="rounded-lg flex items-center justify-center font-display relative hanabi-stack-frame"
              style={{
                width: "clamp(64px, 14vw, 80px)",
                height: "clamp(86px, 19vw, 108px)",
                background: top
                  ? `linear-gradient(160deg, ${COLOR_HEX[color].bg}, color-mix(in oklch, ${COLOR_HEX[color].bg} 80%, black))`
                  : "color-mix(in oklch, var(--color-neutral) 22%, var(--color-base-100))",
                color: top ? COLOR_HEX[color].ink : "var(--color-base-content)",
                fontSize: top ? "clamp(32px, 7vw, 44px)" : "clamp(28px, 6vw, 36px)",
                fontWeight: 800,
                lineHeight: 1,
                boxShadow: complete
                  ? `inset 0 1px 0 oklch(100% 0 0 / 0.3), inset 0 -2px 4px oklch(0% 0 0 / 0.2), 0 0 0 2px color-mix(in oklch, var(--color-success) 65%, transparent), 0 0 20px color-mix(in oklch, var(--color-success) 38%, transparent)`
                  : "inset 0 1px 0 oklch(100% 0 0 / 0.25), inset 0 -2px 4px oklch(0% 0 0 / 0.2), 0 2px 6px oklch(0% 0 0 / 0.18)",
                animation: shouldPulse
                  ? "hanabi-firework-complete 900ms ease-out"
                  : undefined,
              }}
            >
              {/* Empty-stack firework silhouette */}
              {!top && (
                <svg
                  viewBox="0 0 100 100"
                  width="60%"
                  height="60%"
                  style={{ position: "absolute", opacity: 0.28 }}
                  aria-hidden
                >
                  <g
                    transform="translate(50 50)"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  >
                    {[0, 45, 90, 135].map((d) => (
                      <line
                        key={d}
                        x1="-16"
                        y1="0"
                        x2="16"
                        y2="0"
                        transform={`rotate(${d})`}
                      />
                    ))}
                  </g>
                </svg>
              )}
              {top ? <span style={{ position: "relative" }}>{top}</span> : null}
              {complete && (
                <svg
                  viewBox="0 0 100 100"
                  width="140%"
                  height="140%"
                  style={{ position: "absolute", pointerEvents: "none", opacity: 0.7 }}
                  aria-hidden
                >
                  <g
                    transform="translate(50 50)"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    opacity="0.75"
                  >
                    {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5].map((d) => (
                      <line
                        key={d}
                        x1="0"
                        y1="-40"
                        x2="0"
                        y2="-32"
                        transform={`rotate(${d})`}
                      />
                    ))}
                  </g>
                </svg>
              )}
            </div>
            <span className="text-[9px] uppercase tracking-[0.18em] text-base-content/65 font-mono tabular-nums">
              {color} · <span className="text-base-content/90 font-semibold">{top || "—"}</span>
              <span className="text-base-content/40">/5</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------- Discard -------------------------

function DiscardSummary({ discard }: { discard: HanabiView["discard"] }) {
  // Group by color, then by rank.
  const grouped = useMemo(() => {
    const map: Record<HanabiColor, Record<HanabiRank, number>> = {
      red: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      yellow: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      green: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      blue: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      white: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
    for (const c of discard) {
      map[c.color][c.rank]++;
    }
    return map;
  }, [discard]);
  if (discard.length === 0) {
    return (
      <div className="text-[10px] uppercase tracking-[0.18em] text-base-content/45 italic">
        Discard pile empty
      </div>
    );
  }
  return (
    <div className="flex gap-1.5">
      {COLORS.map((c) => {
        const hasAny = RANKS.some((r) => (grouped[c][r] ?? 0) > 0);
        if (!hasAny) return null;
        return (
          <div key={c} className="flex flex-col items-center gap-1">
            {/* Full color swatch bar — unambiguous */}
            <span
              className="rounded-sm"
              style={{
                width: 16,
                height: 6,
                background: `linear-gradient(180deg, ${COLOR_HEX[c].bg}, color-mix(in oklch, ${COLOR_HEX[c].bg} 80%, black))`,
                boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.28)",
              }}
              aria-label={c}
            />
            {RANKS.map((r) => {
              const n = grouped[c][r] ?? 0;
              if (n === 0) return null;
              return (
                <span
                  key={r}
                  className="text-[11px] tabular-nums font-mono leading-none px-1"
                  style={{ opacity: 0.9 }}
                >
                  {r}<span className="text-base-content/45">×</span>{n}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------- Tokens -------------------------

/**
 * Info & fuse rows use distinct geometry: info = rounded squares (notebook
 * chips), fuse = circles (bomb fuses). On top of the different palettes this
 * makes them readable at a glance without parsing the label.
 */
function TokenRow({
  label,
  count,
  max,
  color,
  shape,
  flash,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
  shape: "square" | "circle";
  flash?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-base-content/60"
      style={
        flash
          ? { animation: "hanabi-misfire-shake 600ms ease-out" }
          : undefined
      }
    >
      <span className="font-semibold">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => {
          const on = i < count;
          return (
            <span
              key={i}
              className={shape === "square" ? "rounded-sm" : "rounded-full"}
              style={{
                width: shape === "square" ? 11 : 10,
                height: shape === "square" ? 11 : 10,
                background: on
                  ? color
                  : "color-mix(in oklch, var(--color-base-300) 90%, transparent)",
                boxShadow: on
                  ? "inset 0 1px 0 oklch(100% 0 0 / 0.3), inset 0 -1px 1px oklch(0% 0 0 / 0.2)"
                  : "none",
              }}
            />
          );
        })}
      </div>
      <span className="tabular-nums text-base-content/80 font-semibold">
        {count}
      </span>
    </div>
  );
}

// ------------------------- Board -------------------------

function HanabiBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<HanabiView, HanabiMove>) {
  const playersById = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);
  const nameOf = (id: string) => playersById[id]?.name ?? id;

  const isOver = view.phase === "gameOver";

  // Slot-select action model on own hand.
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [hintTarget, setHintTarget] = useState<string | null>(null);

  const fireworksScore = COLORS.reduce(
    (s, c) => s + (view.played[c] ?? 0),
    0,
  );

  const myHand = view.hands[me] ?? [];

  // Track when a stack just completed (reaches 5) to fire a one-time pulse.
  const prevPlayed = useRef<HanabiView["played"]>(view.played);
  const [pulseColor, setPulseColor] = useState<HanabiColor | null>(null);
  useEffect(() => {
    const prev = prevPlayed.current;
    let newlyCompleted: HanabiColor | null = null;
    for (const c of COLORS) {
      if (view.played[c] === 5 && prev[c] !== 5) {
        newlyCompleted = c;
        break;
      }
    }
    prevPlayed.current = view.played;
    if (newlyCompleted) {
      setPulseColor(newlyCompleted);
      const t = setTimeout(() => setPulseColor(null), 1000);
      return () => clearTimeout(t);
    }
  }, [view.played]);

  // Track misfire (wrong play) to shake the fuse row.
  const prevLastAction = useRef(view.lastAction);
  const [fuseFlash, setFuseFlash] = useState(false);
  useEffect(() => {
    const prev = prevLastAction.current;
    const curr = view.lastAction;
    prevLastAction.current = curr;
    if (!curr || curr === prev) return;
    if (curr.kind === "play" && curr.success === false) {
      setFuseFlash(true);
      const t = setTimeout(() => setFuseFlash(false), 650);
      return () => clearTimeout(t);
    }
  }, [view.lastAction]);

  const discardDisabled = view.info >= INFO_TOKENS_MAX;

  const playSlot = (slot: number) => {
    if (!isMyTurn || isOver) return;
    sendMove({ kind: "play", slot });
    setSelectedSlot(null);
  };
  const discardSlot = (slot: number) => {
    if (!isMyTurn || isOver) return;
    if (discardDisabled) return;
    sendMove({ kind: "discard", slot });
    setSelectedSlot(null);
  };
  const giveColor = (target: string, color: HanabiColor) => {
    if (!isMyTurn || isOver) return;
    if (view.info <= 0) return;
    sendMove({ kind: "hintColor", target, color });
  };
  const giveRank = (target: string, rank: HanabiRank) => {
    if (!isMyTurn || isOver) return;
    if (view.info <= 0) return;
    sendMove({ kind: "hintRank", target, rank });
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-6xl">
      {/* Keyframes for firework-complete pulse and misfire shake */}
      <style>{`
        @keyframes hanabi-firework-complete {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.08); }
          60%  { transform: scale(0.98); }
          100% { transform: scale(1); }
        }
        @keyframes hanabi-misfire-shake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-3px); }
          30%  { transform: translateX(3px); }
          45%  { transform: translateX(-2px); }
          60%  { transform: translateX(2px); }
          75%  { transform: translateX(-1px); }
          100% { transform: translateX(0); }
        }
        @keyframes hanabi-turn-pulse {
          0%, 100% { box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary) 55%, transparent), 0 0 18px color-mix(in oklch, var(--color-primary) 18%, transparent); }
          50% { box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary) 65%, transparent), 0 0 28px color-mix(in oklch, var(--color-primary) 26%, transparent); }
        }
      `}</style>

      <Header
        view={view}
        nameOf={nameOf}
        isMyTurn={isMyTurn}
      />

      <ScoreDisplay score={fireworksScore} isOver={isOver} />

      <div className="flex flex-wrap items-start justify-center gap-6 w-full">
        <StacksView played={view.played} pulseColor={pulseColor} />
        <div className="flex flex-col gap-1.5 items-start">
          {view.finalRoundTurnsLeft >= 0 && (
            <span
              className="text-[10px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: "color-mix(in oklch, var(--color-warning) 15%, transparent)",
                color: "var(--color-warning)",
                border: "1px solid color-mix(in oklch, var(--color-warning) 40%, transparent)",
                boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.3)",
              }}
            >
              Final round · {view.finalRoundTurnsLeft} turn
              {view.finalRoundTurnsLeft === 1 ? "" : "s"} left
            </span>
          )}
          <TokenRow
            label="Info"
            count={view.info}
            max={INFO_TOKENS_MAX}
            color="oklch(70% 0.13 80)"
            shape="square"
          />
          <TokenRow
            label="Fuse"
            count={view.fuses}
            max={FUSE_TOKENS_MAX}
            color="var(--color-error)"
            shape="circle"
            flash={fuseFlash}
          />
          <div className="text-[10px] uppercase tracking-[0.16em] text-base-content/55 font-mono tabular-nums">
            Deck: {view.deckCount}
          </div>
        </div>
        <DiscardSummary discard={view.discard} />
      </div>

      {/* Other seats — visible identities */}
      <div className="flex flex-col gap-3 w-full">
        {view.players
          .filter((id) => id !== me)
          .map((id) => {
            const isTarget = hintTarget === id;
            const isCurrent = view.current === id;
            return (
              <SeatStrip
                key={id}
                id={id}
                view={view}
                playersById={playersById}
                me={me}
                isMyTurn={isMyTurn}
                isOver={isOver}
                hintTarget={hintTarget}
                setHintTarget={setHintTarget}
                isCurrent={isCurrent}
                isTarget={isTarget}
                giveColor={giveColor}
                giveRank={giveRank}
              />
            );
          })}
      </div>

      {/* Own hand — distinct parchment panel, with selection + action strip */}
      <div
        className="w-full rounded-2xl p-4 flex flex-col gap-3 transition-all"
        style={{
          background:
            "color-mix(in oklch, var(--color-warning) 10%, var(--color-base-200))",
          borderTop: "1px dashed color-mix(in oklch, var(--color-base-content) 25%, transparent)",
          boxShadow:
            isMyTurn && !isOver
              ? undefined
              : "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -1px 0 oklch(0% 0 0 / 0.18)",
          animation: isMyTurn && !isOver ? "hanabi-turn-pulse 2.4s ease-in-out infinite" : undefined,
        }}
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/70">
          <span className="inline-block h-2 w-2 rounded-full bg-primary/80" />
          <span>Your hand</span>
          <span className="text-base-content/40">·</span>
          <span className="text-base-content/55 normal-case tracking-normal font-normal">
            hints &amp; intuition only
          </span>
        </div>
        {myHand.length === 0 ? (
          <div className="text-sm italic text-base-content/55 py-3 text-center">
            empty
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap justify-center">
              {myHand.map((c, slot) => {
                const selectable = isMyTurn && !isOver;
                return (
                  <HandCard
                    key={c.id}
                    card={c}
                    size="lg"
                    showIdentity={false}
                    bigKnowledge
                    selected={selectedSlot === slot}
                    onClick={
                      selectable
                        ? () =>
                            setSelectedSlot(
                              selectedSlot === slot ? null : slot,
                            )
                        : undefined
                    }
                    strikeDiscard={discardDisabled && selectedSlot === slot}
                  />
                );
              })}
            </div>
            {isMyTurn && !isOver && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {selectedSlot === null ? (
                  <span className="text-[11px] text-base-content/55 italic">
                    Select a slot to play or discard
                  </span>
                ) : (
                  <>
                    <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-base-content/65">
                      Slot {selectedSlot + 1}:
                    </span>
                    <button
                      type="button"
                      onClick={() => playSlot(selectedSlot)}
                      className="btn btn-sm btn-primary rounded-full px-4 font-semibold"
                    >
                      Play slot {selectedSlot + 1}
                    </button>
                    <button
                      type="button"
                      onClick={() => discardSlot(selectedSlot)}
                      disabled={discardDisabled}
                      className="btn btn-sm btn-ghost rounded-full px-4 font-semibold"
                      title={
                        discardDisabled
                          ? "All info tokens are available — can't discard"
                          : "Discard for an info token"
                      }
                    >
                      Discard slot {selectedSlot + 1}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Last action banner */}
      {view.lastAction && <LastActionLine action={view.lastAction} nameOf={nameOf} />}

      {/* Game over */}
      {isOver && (
        <GameOverPanel view={view} score={fireworksScore} />
      )}
    </div>
  );
}

function Header({
  view,
  nameOf,
  isMyTurn,
}: {
  view: HanabiView;
  nameOf: (id: string) => string;
  isMyTurn: boolean;
}) {
  const status =
    view.phase === "gameOver"
      ? "Game over"
      : isMyTurn
        ? "Your turn"
        : `Waiting on ${nameOf(view.current)}`;
  return (
    <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
      {status}
    </div>
  );
}

function ScoreDisplay({ score, isOver }: { score: number; isOver: boolean }) {
  return (
    <div
      className="flex items-baseline gap-2 parlor-fade"
      style={{
        color: isOver && score === 25
          ? "var(--color-success)"
          : "var(--color-base-content)",
      }}
    >
      <span
        className="font-display tabular-nums tracking-tight leading-none"
        style={{ fontSize: "var(--text-display-sm, 2.25rem)", fontWeight: 800 }}
      >
        {score}
      </span>
      <span className="text-base-content/50 font-mono tabular-nums text-sm">
        / 25
      </span>
    </div>
  );
}

function SeatStrip({
  id,
  view,
  playersById,
  me,
  isMyTurn,
  isOver,
  hintTarget,
  setHintTarget,
  isCurrent,
  isTarget,
  giveColor,
  giveRank,
}: {
  id: string;
  view: HanabiView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
  isMyTurn: boolean;
  isOver: boolean;
  hintTarget: string | null;
  setHintTarget: (s: string | null) => void;
  isCurrent: boolean;
  isTarget: boolean;
  giveColor: (target: string, color: HanabiColor) => void;
  giveRank: (target: string, rank: HanabiRank) => void;
}) {
  void me;
  void hintTarget;
  const cards = view.hands[id] ?? [];
  const p = playersById[id] ?? { id, name: id };
  const canHint = isMyTurn && !isOver && view.info > 0;

  // Highlight cards that match the hovered hint (color or rank)
  const [hoverHint, setHoverHint] = useState<
    { type: "color"; color: HanabiColor } | { type: "rank"; rank: HanabiRank } | null
  >(null);

  const matched = cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => {
      if (!hoverHint) return false;
      if (hoverHint.type === "color") return c.color === hoverHint.color;
      return c.rank === hoverHint.rank;
    })
    .map(({ i }) => i);
  const matchedSet = new Set(matched);
  const hintingActive = hoverHint !== null;

  return (
    <div
      className={[
        "rounded-xl p-3 border flex flex-col gap-2 transition-colors",
        isCurrent
          ? "border-primary/55 bg-primary/10"
          : isTarget
            ? "border-warning/60 bg-warning/10"
            : "border-base-300/70 bg-base-100",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={[
            "text-sm font-semibold truncate max-w-[160px]",
            isCurrent ? "text-primary" : "",
          ].join(" ")}
        >
          {p.name}
        </span>
        {canHint && (
          <button
            type="button"
            onClick={() =>
              setHintTarget(isTarget ? null : id)
            }
            className={[
              "btn btn-xs rounded-full px-2 font-semibold",
              isTarget ? "btn-warning" : "btn-ghost",
            ].join(" ")}
          >
            {isTarget ? "cancel hint" : "hint"}
          </button>
        )}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {cards.map((c, i) => (
          <HandCard
            key={c.id}
            card={c}
            size="md"
            showIdentity={true}
            highlight={matchedSet.has(i)}
            ghost={hintingActive && !matchedSet.has(i)}
          />
        ))}
        {cards.length === 0 && (
          <span className="text-xs italic text-base-content/45">
            empty
          </span>
        )}
      </div>
      {isTarget && canHint && (
        <div className="flex flex-wrap gap-2 items-center pt-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Color:
          </span>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseEnter={() => setHoverHint({ type: "color", color: c })}
              onMouseLeave={() => setHoverHint(null)}
              onClick={() => {
                giveColor(id, c);
                setHintTarget(null);
                setHoverHint(null);
              }}
              className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tabular"
              style={{
                background: COLOR_HEX[c].bg,
                color: COLOR_HEX[c].ink,
              }}
            >
              {c}
            </button>
          ))}
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55 ml-2">
            Rank:
          </span>
          {RANKS.map((r) => (
            <button
              key={r}
              type="button"
              onMouseEnter={() => setHoverHint({ type: "rank", rank: r })}
              onMouseLeave={() => setHoverHint(null)}
              onClick={() => {
                giveRank(id, r);
                setHintTarget(null);
                setHoverHint(null);
              }}
              className="btn btn-xs btn-ghost rounded-full px-2 tabular font-bold"
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LastActionLine({
  action,
  nameOf,
}: {
  action: NonNullable<HanabiView["lastAction"]>;
  nameOf: (id: string) => string;
}) {
  let text: string;
  if (action.kind === "hint") {
    const what =
      action.hint.type === "color"
        ? action.hint.color
        : `rank ${action.hint.rank}`;
    text = `${nameOf(action.by)} → ${nameOf(action.target)}: "${what}" (${action.positions.length} card${action.positions.length === 1 ? "" : "s"})`;
  } else if (action.kind === "play") {
    text = `${nameOf(action.by)} ${action.success ? "played" : "misfired"} ${action.card.color} ${action.card.rank}${
      action.success ? "" : " — fuse lit"
    }`;
  } else {
    text = `${nameOf(action.by)} discarded ${action.card.color} ${action.card.rank}`;
  }
  return (
    <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/50 italic">
      {text}
    </div>
  );
}

function GameOverPanel({ view, score }: { view: HanabiView; score: number }) {
  let label: string;
  if (view.fuses >= FUSE_TOKENS_MAX) {
    label = "Game over — three fuses lit. Score: 0";
  } else if (score === 25) {
    label = "Perfect — 25/25 fireworks!";
  } else {
    label = `Game over — final score ${score}/25`;
  }
  let blurb: string;
  if (score >= 25) blurb = "Legendary — fireworks that gods would clap for.";
  else if (score >= 21) blurb = "Excellent — a memorable performance.";
  else if (score >= 16) blurb = "Honorable — applause from the crowd.";
  else if (score >= 11) blurb = "Decent — they enjoyed it.";
  else if (score >= 6) blurb = "Mediocre — somebody whistles.";
  else blurb = "Smoldering disappointment.";

  const ok = score > 0;
  return (
    <div
      className="max-w-3xl w-full rounded-2xl p-5 flex flex-col gap-2 parlor-fade"
      style={{
        background: ok
          ? "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))"
          : "color-mix(in oklch, var(--color-error) 14%, var(--color-base-100))",
        border: ok
          ? "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)"
          : "1px solid color-mix(in oklch, var(--color-error) 40%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
        ◆ Final score ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        {label}
      </div>
      <div className="text-sm text-base-content/70">{blurb}</div>
    </div>
  );
}

export const hanabiClientModule: ClientGameModule<
  HanabiView,
  HanabiMove,
  HanabiConfig
> = {
  type: HANABI_TYPE,
  Board: HanabiBoard,
};
