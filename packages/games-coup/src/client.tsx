import { useMemo, useState } from "react";
import {
  Card as CardShell,
  HandActionLayout,
  type BoardProps,
  type ClientGameModule,
  type SummaryProps,
} from "@bgo/sdk-client";
import {
  COUP_TYPE,
  actionIsBlockable,
  actionIsChallengeable,
  actionNeedsTarget,
  blockersFor,
  claimFor,
  type ActionType,
  type Card,
  type CoupMove,
  type CoupView,
  type HandCard,
  type OpponentHandView,
} from "./shared";

type PlayerLike = { id: string; name: string };

// ------------------------- Shared bits -------------------------

const CARD_LABEL: Record<Card, string> = {
  duke: "Duke",
  assassin: "Assassin",
  captain: "Captain",
  ambassador: "Ambassador",
  contessa: "Contessa",
};

const CARD_COLOR: Record<Card, string> = {
  duke: "var(--color-primary)",
  assassin: "var(--color-neutral)",
  captain: "var(--color-info)",
  ambassador: "var(--color-success)",
  contessa: "var(--color-error)",
};

const CARD_BLURB: Record<Card, string> = {
  duke: "Tax (+3) · Blocks Foreign Aid",
  assassin: "Assassinate (pay 3)",
  captain: "Steal 2 · Blocks Steal",
  ambassador: "Exchange · Blocks Steal",
  contessa: "Blocks Assassinate",
};

const ACTION_LABEL: Record<ActionType, string> = {
  income: "Income",
  foreignAid: "Foreign Aid",
  tax: "Tax",
  steal: "Steal",
  assassinate: "Assassinate",
  exchange: "Exchange",
  coup: "Coup",
};

const ACTION_COST: Partial<Record<ActionType, number>> = {
  assassinate: 3,
  coup: 7,
};

// ------------------------- Board -------------------------

function CoupBoard({
  view,
  me,
  isMyTurn,
  players,
  sendMove,
}: BoardProps<CoupView, CoupMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, PlayerLike> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const isOver = view.phase === "gameOver";
  const myHand = view.myHand;
  const myCoins = view.coins[me] ?? 0;
  const myAliveCards = myHand?.filter((c) => !c.revealed).length ?? 0;
  const amAlive = myAliveCards > 0;

  const pa = view.pendingAction;
  const pb = view.pendingBlock;

  const mustCoup = amAlive && myCoins >= 10;

  // Decide which center panel to show.
  const showActionPanel = view.phase === "action" && view.current === me && amAlive;
  const showRespondPanel =
    (view.phase === "respond" || view.phase === "blockRespond") &&
    view.respondersRemaining.includes(me) &&
    amAlive;
  const showRevealPanel =
    view.phase === "reveal" &&
    view.forcedReveal?.player === me &&
    amAlive &&
    myAliveCards > 1;
  const showExchangePanel =
    view.phase === "exchange" && pa?.actor === me && view.exchangeDraw;

  if (isOver) {
    return (
      <div className="flex flex-col items-center gap-5 w-full max-w-3xl mx-auto">
        <PlayerRow view={view} me={me} playersById={playersById} excludeMe={false} />
        <GameOverPanel view={view} playersById={playersById} />
        <LogPanel view={view} playersById={playersById} />
      </div>
    );
  }

  let actionSlot: React.ReactNode;
  if (showActionPanel) {
    actionSlot = (
      <ActionPanel
        view={view}
        me={me}
        playersById={playersById}
        mustCoup={mustCoup}
        myCoins={myCoins}
        onSubmit={(actionType, target) =>
          sendMove({ kind: "action", actionType, target: target ?? undefined })
        }
      />
    );
  } else if (showRespondPanel && pa) {
    actionSlot = (
      <RespondPanel
        view={view}
        me={me}
        playersById={playersById}
        onRespond={(response, blockAs) =>
          sendMove({ kind: "respond", response, blockAs })
        }
      />
    );
  } else if (showRevealPanel && myHand) {
    actionSlot = (
      <RevealPanel
        hand={myHand}
        reason={view.forcedReveal?.reason ?? "lostChallenge"}
        onReveal={(cardIndex) =>
          sendMove({ kind: "revealInfluence", cardIndex })
        }
      />
    );
  } else if (showExchangePanel && myHand && view.exchangeDraw) {
    actionSlot = (
      <ExchangePanel
        hand={myHand}
        draw={view.exchangeDraw}
        onSubmit={(keep) =>
          sendMove({ kind: "exchangeSelect", keep })
        }
      />
    );
  } else {
    actionSlot = <WaitingPanel view={view} me={me} playersById={playersById} />;
  }

  return (
    <HandActionLayout
      opponents={
        <PlayerRow view={view} me={me} playersById={playersById} excludeMe />
      }
      hand={
        <YourHandPanel view={view} me={me} playersById={playersById} />
      }
      actions={actionSlot}
      history={<LogPanel view={view} playersById={playersById} />}
    />
  );
}

// ------------------------- Player row -------------------------

function PlayerRow({
  view,
  me,
  playersById,
  excludeMe = false,
}: {
  view: CoupView;
  me: string;
  playersById: Record<string, PlayerLike>;
  excludeMe?: boolean;
}) {
  const ids = excludeMe
    ? view.playerOrder.filter((id) => id !== me)
    : view.playerOrder;
  return (
    <div className="flex flex-wrap gap-2 lg:justify-start justify-center w-full">
      {ids.map((id) => {
        const isMe = id === me;
        const coins = view.coins[id] ?? 0;
        const isCurrent = view.current === id && view.phase === "action";
        const isResponder = view.respondersRemaining.includes(id);
        const isReveal = view.forcedReveal?.player === id;
        const isActor = view.pendingAction?.actor === id;
        const isBlocker = view.pendingBlock?.blocker === id;

        let hand: HandCard[] | null;
        let opp: OpponentHandView | null;
        if (isMe) {
          hand = view.myHand;
          opp = null;
        } else {
          hand = null;
          opp = view.opponents[id] ?? null;
        }
        const aliveCount = isMe
          ? (hand?.filter((c) => !c.revealed).length ?? 0)
          : (opp?.hiddenCount ?? 0);
        const isOut = aliveCount === 0;

        const border =
          isReveal
            ? "var(--color-error)"
            : isActor
              ? "var(--color-primary)"
              : isBlocker
                ? "var(--color-warning)"
                : isCurrent || isResponder
                  ? "var(--color-primary)"
                  : "var(--color-base-300)";

        return (
          <div
            key={id}
            className="rounded-xl px-3 py-2 flex flex-col gap-1.5 min-w-[130px]"
            style={{
              background: isOut
                ? "color-mix(in oklch, var(--color-base-300) 60%, transparent)"
                : "var(--color-base-100)",
              border: `2px solid ${border}`,
              opacity: isOut ? 0.5 : 1,
            }}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-semibold text-sm truncate">
                {isMe ? `${playersById[id]?.name ?? id} (you)` : playersById[id]?.name ?? id}
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.18em] font-semibold rounded-full px-1.5 py-0.5 tabular-nums"
                style={{
                  background: "color-mix(in oklch, var(--color-warning) 22%, transparent)",
                  color: "var(--color-warning-content)",
                }}
              >
                ◎ {coins}
              </span>
            </div>

            <div className="flex gap-1">
              {isMe
                ? (hand ?? []).map((c, i) => (
                    <CardBadge
                      key={i}
                      card={c.card}
                      faceDown={false}
                      revealed={c.revealed}
                    />
                  ))
                : (() => {
                    if (!opp) return null;
                    const out: React.ReactNode[] = [];
                    for (const c of opp.revealed) {
                      out.push(
                        <CardBadge
                          key={`r-${out.length}`}
                          card={c}
                          faceDown={false}
                          revealed={true}
                        />,
                      );
                    }
                    for (let i = 0; i < opp.hiddenCount; i++) {
                      out.push(
                        <CardBadge
                          key={`h-${out.length}`}
                          card={null}
                          faceDown={true}
                          revealed={false}
                        />,
                      );
                    }
                    return out;
                  })()}
            </div>

            {(isReveal || isActor || isBlocker || isCurrent || isResponder || isOut) && (
              <div
                className="text-[10px] uppercase tracking-[0.18em] font-semibold"
                style={{
                  color: isOut
                    ? "var(--color-base-content)"
                    : isReveal
                      ? "var(--color-error)"
                      : isActor
                        ? "var(--color-primary)"
                        : isBlocker
                          ? "var(--color-warning-content)"
                          : "var(--color-primary)",
                }}
              >
                {isOut
                  ? "Out"
                  : isReveal
                    ? "Losing an influence"
                    : isActor
                      ? "Acting"
                      : isBlocker
                        ? "Blocking"
                        : isCurrent
                          ? "Turn"
                          : "Deciding"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------- Your hand panel -------------------------

function YourHandPanel({
  view,
  me,
  playersById,
}: {
  view: CoupView;
  me: string;
  playersById: Record<string, PlayerLike>;
}) {
  const myHand = view.myHand ?? [];
  const myCoins = view.coins[me] ?? 0;
  const aliveCards = myHand.filter((c) => !c.revealed).length;
  const isOut = aliveCards === 0;
  const isCurrent = view.current === me && view.phase === "action";
  const isResponder =
    (view.phase === "respond" || view.phase === "blockRespond") &&
    view.respondersRemaining.includes(me);
  const isReveal = view.forcedReveal?.player === me;
  const isActor = view.pendingAction?.actor === me;
  const isBlocker = view.pendingBlock?.blocker === me;

  const status = isOut
    ? "Out of the game"
    : isReveal
      ? "Losing an influence"
      : isActor
        ? "Acting"
        : isBlocker
          ? "Blocking"
          : isCurrent
            ? "Your turn"
            : isResponder
              ? "Deciding"
              : "Waiting";

  const accent = isOut
    ? "var(--color-base-content)"
    : isReveal
      ? "var(--color-error)"
      : isActor || isCurrent
        ? "var(--color-primary)"
        : isBlocker
          ? "var(--color-warning)"
          : isResponder
            ? "var(--color-primary)"
            : "var(--color-base-content)";

  const meName = playersById[me]?.name ?? me;

  return (
    <div
      className="surface-ivory p-5 flex flex-col gap-4 h-full min-h-[280px]"
      style={{
        borderColor:
          isCurrent || isActor || isResponder || isReveal
            ? accent
            : undefined,
        boxShadow:
          isCurrent || isActor || isResponder || isReveal
            ? `0 0 0 1px color-mix(in oklch, ${accent} 35%, transparent), var(--shadow-soft)`
            : undefined,
        opacity: isOut ? 0.6 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Your influences
          </span>
          <span
            className="font-display tracking-tight truncate"
            style={{ fontSize: "var(--text-display-sm)", lineHeight: 1.05 }}
          >
            {meName}{" "}
            <span className="text-base-content/55 font-sans text-base">
              (you)
            </span>
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="text-xs uppercase tracking-[0.18em] font-semibold rounded-full px-2.5 py-1 tabular-nums"
            style={{
              background:
                "color-mix(in oklch, var(--color-warning) 22%, transparent)",
              color: "var(--color-warning-content)",
            }}
          >
            ◎ {myCoins}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.22em] font-semibold"
            style={{ color: accent }}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4 flex-wrap">
        {myHand.length === 0 ? (
          <span className="text-base-content/55 italic">
            No influences yet.
          </span>
        ) : (
          myHand.map((c, i) => (
            <CardShell
              key={i}
              ghost={c.revealed}
              ariaLabel={`${CARD_LABEL[c.card]}${c.revealed ? " (revealed)" : ""}`}
              style={{ width: 148, height: 208, borderRadius: 12 }}
            >
              <CoupFace card={c.card} revealed={c.revealed} />
            </CardShell>
          ))
        )}
      </div>
    </div>
  );
}

// ------------------------- Waiting panel -------------------------

function WaitingPanel({
  view,
  me,
  playersById,
}: {
  view: CoupView;
  me: string;
  playersById: Record<string, PlayerLike>;
}) {
  let headline = "Waiting on other players";
  let detail = "";
  if (view.phase === "action") {
    const n = playersById[view.current]?.name ?? view.current;
    if (view.current === me) {
      headline = "Your turn";
      detail = "Choose an action below.";
    } else {
      headline = `${n} is choosing`;
      detail = "Waiting for an action.";
    }
  } else if (view.phase === "respond" || view.phase === "blockRespond") {
    const names = view.respondersRemaining
      .map((id) => playersById[id]?.name ?? id)
      .join(", ");
    headline = "Awaiting responses";
    detail = `Waiting on ${names}.`;
  } else if (view.phase === "reveal") {
    const p = view.forcedReveal?.player;
    const n = p ? (playersById[p]?.name ?? p) : "someone";
    headline = `${n} is choosing an influence`;
    detail = "Reveal in progress.";
  } else if (view.phase === "exchange") {
    const p = view.pendingAction?.actor;
    const n = p ? (playersById[p]?.name ?? p) : "someone";
    headline = `${n} is exchanging`;
    detail = "Picking cards from the court.";
  }
  return (
    <div className="surface-ivory p-5 flex flex-col gap-2 h-full min-h-[280px] justify-center items-start">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-base-content/55">
        ◆ Standing by ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)", lineHeight: 1.1 }}
      >
        {headline}
      </div>
      {detail && (
        <div className="text-sm text-base-content/65">{detail}</div>
      )}
    </div>
  );
}

function CardBadge({
  card,
  faceDown,
  revealed,
}: {
  card: Card | null;
  faceDown: boolean;
  revealed: boolean;
}) {
  if (faceDown) {
    return (
      <CardShell size="xs" faceDown ariaLabel="hidden influence" />
    );
  }
  if (!card) return null;
  return (
    <CardShell
      size="xs"
      ghost={revealed}
      ariaLabel={`${CARD_LABEL[card]}${revealed ? " (revealed)" : ""}`}
    >
      <CoupFace card={card} revealed={revealed} />
    </CardShell>
  );
}

/**
 * Coup role face — one bespoke pictogram per role, drawn in the role's color.
 * - Duke: stack of three coins
 * - Assassin: hooded figure with dagger
 * - Captain: anchor
 * - Ambassador: scroll
 * - Contessa: rose with stem
 */
function CoupFace({ card, revealed }: { card: Card; revealed: boolean }) {
  const color = CARD_COLOR[card];
  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={{
        display: "block",
        color,
        textDecoration: revealed ? "line-through" : "none",
      }}
    >
      <rect
        x="0"
        y="0"
        width="100"
        height="140"
        fill="currentColor"
        opacity={revealed ? 0.05 : 0.1}
      />
      <rect
        x="6"
        y="6"
        width="88"
        height="128"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
      />
      <g transform="translate(50, 60)">
        <CoupGlyph card={card} />
      </g>
      <text
        x="50"
        y="118"
        textAnchor="middle"
        fontSize="11"
        fontWeight={700}
        fontFamily="var(--font-display, serif)"
        fill="currentColor"
        letterSpacing="0.04em"
      >
        {CARD_LABEL[card]}
      </text>
      {revealed && (
        <line
          x1="14"
          y1="70"
          x2="86"
          y2="70"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />
      )}
    </svg>
  );
}

function CoupGlyph({ card }: { card: Card }) {
  const sw = 1.6;
  switch (card) {
    case "duke":
      // Stack of three coins, with edge ticks.
      return (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <ellipse cx="0" cy="14" rx="20" ry="5" fill="currentColor" opacity="0.18" />
          <ellipse cx="0" cy="14" rx="20" ry="5" />
          <line x1="-20" y1="14" x2="-20" y2="6" />
          <line x1="20" y1="14" x2="20" y2="6" />
          <ellipse cx="0" cy="6" rx="20" ry="5" fill="currentColor" opacity="0.18" />
          <ellipse cx="0" cy="6" rx="20" ry="5" />
          <line x1="-20" y1="6" x2="-20" y2="-2" />
          <line x1="20" y1="6" x2="20" y2="-2" />
          <ellipse cx="0" cy="-2" rx="20" ry="5" fill="currentColor" opacity="0.18" />
          <ellipse cx="0" cy="-2" rx="20" ry="5" />
          {/* engraving on top coin */}
          <text
            x="0"
            y="0"
            textAnchor="middle"
            fontSize="7"
            fontWeight={700}
            fontFamily="var(--font-display, serif)"
            fill="currentColor"
            opacity="0.9"
          >
            ◎
          </text>
        </g>
      );
    case "assassin":
      // Hooded silhouette with a dagger.
      return (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {/* hood + face */}
          <path
            fill="currentColor"
            opacity="0.18"
            d="M -14 -16 C -14 -22, 14 -22, 14 -16 L 16 6 C 16 14, -16 14, -16 6 Z"
          />
          <path d="M -14 -16 C -14 -22, 14 -22, 14 -16 L 16 6 C 16 14, -16 14, -16 6 Z" />
          <path d="M -10 -2 L -4 -2 M 4 -2 L 10 -2" />
          {/* dagger crossing the body */}
          <line x1="6" y1="20" x2="20" y2="6" strokeWidth={sw + 0.4} />
          <line x1="2" y1="22" x2="6" y2="20" />
          <line x1="20" y1="6" x2="22" y2="2" />
          <line x1="16" y1="2" x2="20" y2="6" />
          <line x1="20" y1="6" x2="24" y2="10" />
        </g>
      );
    case "captain":
      // Anchor.
      return (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <circle cx="0" cy="-16" r="4" />
          <line x1="0" y1="-12" x2="0" y2="16" strokeWidth={sw + 0.4} />
          <line x1="-8" y1="-6" x2="8" y2="-6" />
          <path d="M -16 8 C -16 18, 16 18, 16 8" />
          <line x1="-16" y1="8" x2="-20" y2="4" />
          <line x1="16" y1="8" x2="20" y2="4" />
          <line x1="0" y1="16" x2="-4" y2="12" />
          <line x1="0" y1="16" x2="4" y2="12" />
        </g>
      );
    case "ambassador":
      // Scroll with seal.
      return (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <rect
            x="-18"
            y="-14"
            width="36"
            height="22"
            rx="4"
            fill="currentColor"
            opacity="0.16"
          />
          <rect x="-18" y="-14" width="36" height="22" rx="4" />
          <line x1="-12" y1="-6" x2="12" y2="-6" />
          <line x1="-12" y1="0" x2="6" y2="0" />
          {/* curl ends */}
          <ellipse cx="-18" cy="-3" rx="3" ry="11" fill="currentColor" opacity="0.16" />
          <ellipse cx="-18" cy="-3" rx="3" ry="11" />
          <ellipse cx="18" cy="-3" rx="3" ry="11" fill="currentColor" opacity="0.16" />
          <ellipse cx="18" cy="-3" rx="3" ry="11" />
          {/* wax seal */}
          <circle cx="0" cy="14" r="5" fill="currentColor" opacity="0.4" />
          <circle cx="0" cy="14" r="5" />
        </g>
      );
    case "contessa":
      // Rose with stem and leaf.
      return (
        <g stroke="currentColor" strokeWidth={sw} strokeLinejoin="round">
          <circle cx="0" cy="-8" r="10" fill="currentColor" opacity="0.18" />
          <circle cx="0" cy="-8" r="10" fill="none" />
          <path d="M -5 -8 C -2 -12, 2 -12, 5 -8 C 2 -4, -2 -4, -5 -8 Z" fill="currentColor" />
          <path d="M -3 -8 C -1 -10, 1 -10, 3 -8" fill="none" stroke="white" strokeOpacity="0.4" />
          {/* stem */}
          <line x1="0" y1="2" x2="0" y2="20" strokeWidth={sw + 0.4} />
          {/* leaf */}
          <path d="M 0 12 Q 12 8, 14 18 Q 4 18, 0 14" fill="currentColor" opacity="0.4" />
        </g>
      );
  }
}

// ------------------------- Action panel -------------------------

function ActionPanel({
  view,
  me,
  playersById,
  mustCoup,
  myCoins,
  onSubmit,
}: {
  view: CoupView;
  me: string;
  playersById: Record<string, PlayerLike>;
  mustCoup: boolean;
  myCoins: number;
  onSubmit: (actionType: ActionType, target: string | null) => Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);

  const liveTargets = view.playerOrder.filter((id) => {
    if (id === me) return false;
    const opp = view.opponents[id];
    return !!opp && opp.hiddenCount > 0;
  });

  const canAfford = (a: ActionType): boolean => {
    const cost = ACTION_COST[a] ?? 0;
    return myCoins >= cost;
  };

  const actions: ActionType[] = [
    "income",
    "foreignAid",
    "tax",
    "steal",
    "assassinate",
    "exchange",
    "coup",
  ];

  const chooseAction = async (a: ActionType) => {
    if (!canAfford(a)) return;
    if (actionNeedsTarget(a)) {
      setPendingAction(a);
      return;
    }
    await onSubmit(a, null);
  };

  const confirmTarget = async (target: string) => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    await onSubmit(action, target);
  };

  return (
    <div className="surface-ivory w-full p-5 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        {mustCoup ? "You have 10+ coins — you must coup" : "Your turn — choose an action"}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {actions.map((a) => {
          const disabled =
            (mustCoup && a !== "coup") ||
            !canAfford(a) ||
            (actionNeedsTarget(a) && liveTargets.length === 0);
          const claim = claimFor(a);
          const cost = ACTION_COST[a];
          return (
            <button
              key={a}
              type="button"
              disabled={disabled}
              onClick={() => chooseAction(a)}
              className={[
                "rounded-xl px-3 py-2.5 text-left transition-all border",
                "flex flex-col gap-0.5",
                disabled
                  ? "bg-base-200/60 border-base-300 opacity-50 cursor-not-allowed"
                  : "bg-base-100 border-base-300 hover:border-primary/70 cursor-pointer",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{ACTION_LABEL[a]}</span>
                {cost != null && (
                  <span
                    className="text-[10px] uppercase tracking-[0.12em] font-semibold px-1.5 rounded-full"
                    style={{
                      background: "color-mix(in oklch, var(--color-warning) 25%, transparent)",
                      color: "var(--color-warning-content)",
                    }}
                  >
                    −{cost}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-base-content/65">
                {a === "income" && "Take 1 coin. Safe."}
                {a === "foreignAid" && "Take 2 coins. Blockable by Duke."}
                {a === "tax" && "Claim Duke; take 3 coins."}
                {a === "steal" && "Claim Captain; take 2 from a player."}
                {a === "assassinate" && "Claim Assassin; kill an influence."}
                {a === "exchange" && "Claim Ambassador; swap cards."}
                {a === "coup" && "Pay 7 to kill an influence. No challenge."}
              </div>
              {claim && (
                <div
                  className="text-[9px] uppercase tracking-[0.22em] font-semibold mt-0.5"
                  style={{ color: CARD_COLOR[claim] }}
                >
                  Claims {CARD_LABEL[claim]}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {pendingAction && (
        <div className="pt-3 mt-1 border-t border-base-300 flex flex-col gap-2">
          <div className="text-xs text-base-content/70">
            Pick a target for{" "}
            <span className="font-semibold">{ACTION_LABEL[pendingAction]}</span>:
          </div>
          <div className="flex flex-wrap gap-2">
            {liveTargets.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => confirmTarget(id)}
                className="btn btn-sm btn-primary rounded-full font-semibold"
              >
                {playersById[id]?.name ?? id}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="btn btn-sm btn-ghost rounded-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------- Respond panel -------------------------

function RespondPanel({
  view,
  me,
  playersById,
  onRespond,
}: {
  view: CoupView;
  me: string;
  playersById: Record<string, PlayerLike>;
  onRespond: (
    response: "allow" | "block" | "challenge",
    blockAs?: Card,
  ) => Promise<void>;
}) {
  const pa = view.pendingAction;
  const pb = view.pendingBlock;
  const isBlockRespond = view.phase === "blockRespond";

  if (!pa) return null;

  const actorName = playersById[pa.actor]?.name ?? pa.actor;
  const targetName = pa.target
    ? (playersById[pa.target]?.name ?? pa.target)
    : null;
  const blockerName = pb ? (playersById[pb.blocker]?.name ?? pb.blocker) : null;

  // Block options: only the target may block (for targeted actions), and any
  // player may block foreign aid. For steal/assassinate, only the target.
  const canBlock =
    !isBlockRespond &&
    actionIsBlockable(pa.actionType) &&
    (pa.target == null || pa.target === me);

  const blockCardOptions = canBlock ? blockersFor(pa.actionType) : [];

  // Challenge is legal when something is claimed.
  const canChallenge = isBlockRespond
    ? pb != null
    : actionIsChallengeable(pa.actionType);

  return (
    <div
      className="w-full rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: "color-mix(in oklch, var(--color-warning) 18%, var(--color-base-100))",
        border: "1px solid color-mix(in oklch, var(--color-warning) 45%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-warning-content">
        ◆ Respond ◆
      </div>

      <div className="text-sm text-base-content/85">
        {isBlockRespond ? (
          <>
            <span className="font-semibold">{blockerName}</span> blocks{" "}
            <span className="font-semibold">{actorName}</span>'s{" "}
            <span className="font-semibold">{ACTION_LABEL[pa.actionType]}</span>{" "}
            by claiming{" "}
            <span
              className="font-semibold"
              style={{ color: pb ? CARD_COLOR[pb.blockAs] : undefined }}
            >
              {pb ? CARD_LABEL[pb.blockAs] : "—"}
            </span>
            .
          </>
        ) : (
          <>
            <span className="font-semibold">{actorName}</span>{" "}
            {pa.actionType === "foreignAid"
              ? "attempts Foreign Aid"
              : pa.claim
                ? (
                  <>
                    claims{" "}
                    <span
                      className="font-semibold"
                      style={{ color: CARD_COLOR[pa.claim] }}
                    >
                      {CARD_LABEL[pa.claim]}
                    </span>{" "}
                    for {ACTION_LABEL[pa.actionType]}
                  </>
                )
                : ACTION_LABEL[pa.actionType]}
            {targetName && (
              <>
                {" "}
                on <span className="font-semibold">{targetName}</span>
              </>
            )}
            .
          </>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-base-content/55 tabular-nums">
          Waiting on{" "}
          {view.respondersRemaining
            .map((id) => playersById[id]?.name ?? id)
            .join(", ")}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => onRespond("allow")}
            className="btn btn-sm btn-ghost rounded-full font-semibold"
          >
            Allow
          </button>
          {canChallenge && (
            <button
              type="button"
              onClick={() => onRespond("challenge")}
              className="btn btn-sm btn-error rounded-full font-semibold"
            >
              Challenge
            </button>
          )}
          {blockCardOptions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onRespond("block", c)}
              className="btn btn-sm rounded-full font-semibold"
              style={{
                background: CARD_COLOR[c],
                color: "var(--color-base-100)",
              }}
            >
              Block as {CARD_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------- Reveal panel -------------------------

function RevealPanel({
  hand,
  reason,
  onReveal,
}: {
  hand: HandCard[];
  reason: "lostChallenge" | "assassinated" | "couped";
  onReveal: (cardIndex: 0 | 1) => Promise<void>;
}) {
  const reasonLabel: Record<typeof reason, string> = {
    lostChallenge: "You lost a challenge — choose which influence to flip:",
    assassinated: "You've been assassinated — choose which influence to flip:",
    couped: "You've been couped — choose which influence to flip:",
  };
  return (
    <div
      className="w-full rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: "color-mix(in oklch, var(--color-error) 12%, var(--color-base-100))",
        border: "1px solid color-mix(in oklch, var(--color-error) 55%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-error">
        ◆ Reveal an influence ◆
      </div>
      <div className="text-sm text-base-content/85">{reasonLabel[reason]}</div>
      <div className="flex gap-2">
        {hand.map((c, i) => {
          if (c.revealed) return null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onReveal(i as 0 | 1)}
              className="rounded-xl px-4 py-3 text-left border cursor-pointer hover:border-error/70 transition-colors"
              style={{
                background: `color-mix(in oklch, ${CARD_COLOR[c.card]} 18%, var(--color-base-100))`,
                borderColor: CARD_COLOR[c.card],
              }}
            >
              <div
                className="font-semibold"
                style={{ color: CARD_COLOR[c.card] }}
              >
                {CARD_LABEL[c.card]}
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
                Flip
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------- Exchange panel -------------------------

function ExchangePanel({
  hand,
  draw,
  onSubmit,
}: {
  hand: HandCard[];
  draw: Card[];
  onSubmit: (keep: Card[]) => Promise<void>;
}) {
  // Available pool: hand's alive cards + drawn cards.
  const alive = hand.filter((c) => !c.revealed).map((c) => c.card);
  const pool = [...alive, ...draw];
  const slotsToKeep = alive.length;

  // Track selection as indices into pool (since two cards could share a type).
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (idx: number) => {
    setSelected((cur) => {
      if (cur.includes(idx)) return cur.filter((i) => i !== idx);
      if (cur.length >= slotsToKeep) return cur;
      return [...cur, idx];
    });
  };

  const ready = selected.length === slotsToKeep;

  const handleConfirm = async () => {
    if (!ready) return;
    const keep = selected.map((i) => pool[i]!);
    setSelected([]);
    await onSubmit(keep);
  };

  return (
    <div className="surface-ivory w-full p-5 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary">
        ◆ Exchange — pick {slotsToKeep} to keep ◆
      </div>
      <div className="text-xs text-base-content/65">
        You have {alive.length} face-down card{alive.length === 1 ? "" : "s"}{" "}
        and drew {draw.length} from the deck. Keep {slotsToKeep}; return the rest.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {pool.map((c, i) => {
          const isSelected = selected.includes(i);
          const isFromHand = i < alive.length;
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className="rounded-xl px-3 py-2.5 border cursor-pointer text-left transition-colors"
              style={{
                background: isSelected
                  ? `color-mix(in oklch, ${CARD_COLOR[c]} 30%, var(--color-base-100))`
                  : "var(--color-base-100)",
                borderColor: isSelected ? CARD_COLOR[c] : "var(--color-base-300)",
                borderWidth: 2,
              }}
            >
              <div
                className="font-semibold text-sm"
                style={{ color: CARD_COLOR[c] }}
              >
                {CARD_LABEL[c]}
              </div>
              <div className="text-[10px] text-base-content/55">
                {CARD_BLURB[c]}
              </div>
              <div className="text-[9px] uppercase tracking-[0.22em] font-semibold mt-0.5 text-base-content/50">
                {isFromHand ? "Hand" : "Drawn"}
                {isSelected && " · Keeping"}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-base-content/55 tabular-nums">
          {selected.length}/{slotsToKeep} selected
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!ready}
          className="btn btn-primary rounded-full px-6 font-semibold"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

// ------------------------- Log -------------------------

function LogPanel({
  view,
  playersById,
}: {
  view: CoupView;
  playersById: Record<string, PlayerLike>;
}) {
  const resolveNames = (text: string): string => {
    let out = text;
    for (const id of view.playerOrder) {
      const name = playersById[id]?.name;
      if (!name || name === id) continue;
      out = out.split(id).join(name);
    }
    return out;
  };
  const recent = view.log.slice(-8);
  if (recent.length === 0) return null;
  return (
    <div className="w-full rounded-2xl p-3 bg-base-100 border border-base-300 text-xs flex flex-col gap-1 max-h-40 overflow-y-auto">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 mb-0.5">
        History
      </div>
      {recent.map((e) => (
        <div key={e.id} className="text-base-content/75 leading-snug">
          {resolveNames(e.text)}
        </div>
      ))}
    </div>
  );
}

// ------------------------- Game over -------------------------

function GameOverPanel({
  view,
  playersById,
}: {
  view: CoupView;
  playersById: Record<string, PlayerLike>;
}) {
  const winner = view.winner;
  const name = winner ? (playersById[winner]?.name ?? winner) : null;
  return (
    <div className="surface-ivory w-full px-6 py-5 flex flex-col gap-3 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary">
        ◆ Result ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{
          fontSize: "var(--text-display-sm)",
          color: "var(--color-primary)",
        }}
      >
        {name ? `${name} is the last influence standing.` : "No survivors."}
      </div>
      {view.finalHands && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left mt-1">
          {view.playerOrder.map((id) => {
            const hand = view.finalHands?.[id] ?? [];
            const playerName = playersById[id]?.name ?? id;
            const isWinner = id === winner;
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 border border-base-300 bg-base-100"
                style={{
                  borderColor: isWinner ? "var(--color-primary)" : undefined,
                }}
              >
                <span className="font-semibold truncate">{playerName}</span>
                <div className="flex gap-1">
                  {hand.map((c, i) => (
                    <CardBadge
                      key={i}
                      card={c.card}
                      faceDown={false}
                      revealed={c.revealed}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------- Summary -------------------------

function CoupSummary({ view }: SummaryProps<CoupView>) {
  if (view.phase !== "gameOver" || !view.winner) return null;
  return (
    <div className="surface-ivory max-w-xl mx-auto px-6 py-5 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary mb-1">
        ◆ Coup ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{
          fontSize: "var(--text-display-sm)",
          color: "var(--color-primary)",
        }}
      >
        The crown holds.
      </div>
    </div>
  );
}

export const coupClientModule: ClientGameModule<
  CoupView,
  CoupMove,
  Record<string, never>
> = {
  type: COUP_TYPE,
  Board: CoupBoard,
  Summary: CoupSummary,
};
