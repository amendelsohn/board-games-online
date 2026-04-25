import { useMemo, useState } from "react";
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
}: {
  card: HanabiHandCardView;
  size?: CardSize;
  /** True when this card's color/rank are visible to the viewer. */
  showIdentity: boolean;
  highlight?: boolean;
  onClick?: () => void;
  selected?: boolean;
  ghost?: boolean;
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
    >
      <HanabiFace color={visibleColor} rank={visibleRank} />
      <div
        style={{
          position: "absolute",
          left: 4,
          right: 4,
          bottom: 3,
        }}
      >
        <KnowledgeStrip k={card.knowledge} />
      </div>
    </CardShell>
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

function KnowledgeStrip({ k }: { k: CardKnowledge }) {
  // Show small dots for surviving possibilities. Bold means "told yes".
  const possC = new Set(k.possibleColors);
  const toldC = new Set(k.toldColors);
  const possR = new Set(k.possibleRanks);
  const toldR = new Set(k.toldRanks);
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
                width: told ? 7 : 5,
                height: told ? 7 : 5,
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
              className="text-[8px] tabular leading-none px-[1px]"
              style={{
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

function StacksView({ played }: { played: HanabiView["played"] }) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {COLORS.map((color) => {
        const top = played[color] ?? 0;
        return (
          <div key={color} className="flex flex-col items-center gap-1">
            <div
              className="rounded-lg flex items-center justify-center font-display"
              style={{
                width: 48,
                height: 64,
                background: top
                  ? `linear-gradient(160deg, ${COLOR_HEX[color].bg}, color-mix(in oklch, ${COLOR_HEX[color].bg} 80%, black))`
                  : "color-mix(in oklch, var(--color-neutral) 25%, var(--color-base-100))",
                color: top ? COLOR_HEX[color].ink : "var(--color-base-content)",
                fontSize: 28,
                fontWeight: 800,
                lineHeight: 1,
                boxShadow:
                  "inset 0 1px 0 oklch(100% 0 0 / 0.25), inset 0 -2px 4px oklch(0% 0 0 / 0.2), 0 2px 6px oklch(0% 0 0 / 0.18)",
              }}
            >
              {top || "·"}
            </div>
            <span className="text-[9px] uppercase tracking-[0.18em] text-base-content/55">
              {color}
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
    <div className="flex gap-2">
      {COLORS.map((c) => (
        <div key={c} className="flex flex-col items-center gap-0.5">
          <span
            className="rounded text-[10px] tabular px-1 py-0.5 font-bold"
            style={{
              background: COLOR_HEX[c].bg,
              color: COLOR_HEX[c].ink,
            }}
          >
            {c[0]!.toUpperCase()}
          </span>
          {RANKS.map((r) => {
            const n = grouped[c][r] ?? 0;
            if (n === 0) return null;
            return (
              <span
                key={r}
                className="text-[10px] tabular px-1 leading-none"
                style={{ opacity: 0.85 }}
              >
                {r}×{n}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ------------------------- Tokens -------------------------

function TokenRow({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-base-content/55">
      <span>{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => {
          const on = i < count;
          return (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 10,
                height: 10,
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
      <span className="tabular text-base-content/70 font-semibold">
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

  // Action mode: which seat we're about to act on.
  const [hintTarget, setHintTarget] = useState<string | null>(null);

  const fireworksScore = COLORS.reduce(
    (s, c) => s + (view.played[c] ?? 0),
    0,
  );

  const myHand = view.hands[me] ?? [];

  const playSlot = (slot: number) => {
    if (!isMyTurn || isOver) return;
    sendMove({ kind: "play", slot });
  };
  const discardSlot = (slot: number) => {
    if (!isMyTurn || isOver) return;
    if (view.info >= INFO_TOKENS_MAX) return;
    sendMove({ kind: "discard", slot });
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
      <Header
        view={view}
        nameOf={nameOf}
        isMyTurn={isMyTurn}
        score={fireworksScore}
      />

      <div className="flex flex-wrap items-center justify-center gap-6 w-full">
        <StacksView played={view.played} />
        <div className="flex flex-col gap-1 items-start">
          <TokenRow
            label="Info"
            count={view.info}
            max={INFO_TOKENS_MAX}
            color="oklch(70% 0.13 80)"
          />
          <TokenRow
            label="Fuse"
            count={view.fuses}
            max={FUSE_TOKENS_MAX}
            color="oklch(60% 0.16 25)"
          />
          <div className="text-[10px] uppercase tracking-[0.16em] text-base-content/55">
            Deck: {view.deckCount}
            {view.finalRoundTurnsLeft >= 0 && (
              <> · {view.finalRoundTurnsLeft} turn{view.finalRoundTurnsLeft === 1 ? "" : "s"} left</>
            )}
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

      {/* Own hand — face-down except for knowledge */}
      <div
        className="w-full rounded-2xl p-4 flex flex-col gap-3"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 70%, transparent)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -1px 0 oklch(0% 0 0 / 0.18)",
        }}
      >
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/60">
          <span className="inline-block h-2 w-2 rounded-full bg-primary/70" />
          Your hand — you can't see your own cards. Hints &amp; intuition only.
          {isMyTurn && !isOver && (
            <span className="ml-2 text-primary">your turn</span>
          )}
        </div>
        {myHand.length === 0 ? (
          <div className="text-sm italic text-base-content/55 py-3 text-center">
            empty
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap justify-center">
            {myHand.map((c, slot) => (
              <div key={c.id} className="flex flex-col items-center gap-1">
                <HandCard
                  card={c}
                  size="lg"
                  showIdentity={false}
                />
                {isMyTurn && !isOver && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => playSlot(slot)}
                      className="btn btn-xs btn-primary rounded-full px-2 font-semibold"
                      title="Play this slot"
                    >
                      play
                    </button>
                    <button
                      type="button"
                      onClick={() => discardSlot(slot)}
                      disabled={view.info >= INFO_TOKENS_MAX}
                      className="btn btn-xs btn-ghost rounded-full px-2 font-semibold"
                      title={
                        view.info >= INFO_TOKENS_MAX
                          ? "All info tokens are available"
                          : "Discard for an info token"
                      }
                    >
                      drop
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
  score,
}: {
  view: HanabiView;
  nameOf: (id: string) => string;
  isMyTurn: boolean;
  score: number;
}) {
  const status =
    view.phase === "gameOver"
      ? `Game over · final score ${score}`
      : isMyTurn
        ? `Your turn — score ${score}/25`
        : `Waiting on ${nameOf(view.current)} — score ${score}/25`;
  return (
    <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
      {status}
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
