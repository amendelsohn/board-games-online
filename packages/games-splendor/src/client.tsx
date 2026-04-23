import { useMemo, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  GEMS,
  POINTS_TO_WIN,
  RESERVE_LIMIT,
  SPLENDOR_TYPE,
  TOKEN_LIMIT,
  nobleEligible,
  payForCard,
  tokenTotal,
  type Card,
  type Gem,
  type GemWithGold,
  type Noble,
  type SplendorConfig,
  type SplendorMove,
  type SplendorView,
  type Tier,
} from "./shared";

const GEM_COLOR: Record<GemWithGold, string> = {
  white:
    "linear-gradient(140deg, oklch(98% 0.01 90), oklch(88% 0.01 90))",
  blue: "linear-gradient(140deg, oklch(70% 0.13 250), oklch(45% 0.18 260))",
  green:
    "linear-gradient(140deg, oklch(72% 0.17 145), oklch(48% 0.18 150))",
  red: "linear-gradient(140deg, oklch(72% 0.19 25), oklch(48% 0.23 25))",
  black:
    "linear-gradient(140deg, oklch(35% 0.01 260), oklch(15% 0.02 260))",
  gold: "linear-gradient(140deg, oklch(88% 0.15 80), oklch(60% 0.18 65))",
};

const GEM_LABEL: Record<GemWithGold, string> = {
  white: "Diamond",
  blue: "Sapphire",
  green: "Emerald",
  red: "Ruby",
  black: "Onyx",
  gold: "Gold",
};

function GemToken({
  gem,
  size = 28,
  dim = false,
  selected = false,
}: {
  gem: GemWithGold;
  size?: number;
  dim?: boolean;
  selected?: boolean;
}) {
  return (
    <div
      aria-label={GEM_LABEL[gem]}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: GEM_COLOR[gem],
        boxShadow: selected
          ? `0 0 0 3px var(--color-primary), inset 0 1px 0 oklch(100% 0 0 / 0.4), inset 0 -2px 4px oklch(0% 0 0 / 0.35)`
          : "inset 0 1px 0 oklch(100% 0 0 / 0.4), inset 0 -2px 4px oklch(0% 0 0 / 0.35), 0 2px 4px oklch(0% 0 0 / 0.25)",
        opacity: dim ? 0.35 : 1,
        flexShrink: 0,
        transition: "box-shadow 180ms ease",
      }}
    />
  );
}

function TokenBadge({
  gem,
  count,
  size = 24,
  label,
}: {
  gem: GemWithGold;
  count: number;
  size?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <GemToken gem={gem} size={size} dim={count === 0} />
      <span
        className={[
          "font-display tabular font-bold tabular-nums min-w-[1ch]",
          count === 0 ? "text-base-content/40" : "text-base-content",
        ].join(" ")}
      >
        {count}
      </span>
      {label && (
        <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/45">
          {label}
        </span>
      )}
    </div>
  );
}

function CostPip({
  gem,
  cost,
  paid,
}: {
  gem: Gem;
  cost: number;
  paid: number;
}) {
  if (cost <= 0) return null;
  return (
    <div
      className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-100) 85%, transparent)",
        boxShadow: "inset 0 0 0 1px oklch(0% 0 0 / 0.1)",
      }}
    >
      <GemToken gem={gem} size={10} />
      <span
        className="font-display font-bold tabular"
        style={{ opacity: paid >= cost ? 1 : 0.7 }}
      >
        {cost}
      </span>
    </div>
  );
}

function DevCard({
  card,
  dim = false,
  onClick,
  disabled = false,
  highlight = false,
  label,
  bonuses,
}: {
  card: Card;
  dim?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
  label?: string;
  bonuses?: Record<Gem, number>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "relative flex flex-col items-stretch gap-0.5 p-1.5 rounded-md text-left",
        "transition-all",
        disabled ? "cursor-default" : "cursor-pointer hover:-translate-y-0.5",
      ].join(" ")}
      style={{
        width: 88,
        minHeight: 118,
        background: `linear-gradient(180deg, color-mix(in oklch, var(--color-base-100) 95%, ${colorMix(card.bonus)} ) 0%, color-mix(in oklch, var(--color-base-100) 70%, ${colorMix(card.bonus)}) 100%)`,
        border: highlight
          ? "2px solid var(--color-primary)"
          : `1px solid color-mix(in oklch, ${colorMix(card.bonus)} 40%, transparent)`,
        boxShadow: highlight
          ? "0 6px 18px color-mix(in oklch, var(--color-primary) 30%, transparent)"
          : "0 2px 4px oklch(0% 0 0 / 0.15)",
        opacity: dim ? 0.5 : 1,
      }}
    >
      <div className="flex items-center justify-between">
        <GemToken gem={card.bonus} size={18} />
        <div
          className="font-display tabular font-bold"
          style={{ fontSize: 18, lineHeight: 1 }}
        >
          {card.points > 0 ? card.points : ""}
        </div>
      </div>
      <div className="flex-1" />
      <div className="flex flex-wrap gap-0.5 justify-start">
        {GEMS.map((g) => {
          const paid = bonuses ? bonuses[g] ?? 0 : 0;
          return (
            <CostPip
              key={g}
              gem={g}
              cost={card.cost[g] ?? 0}
              paid={paid}
            />
          );
        })}
      </div>
      {label && (
        <div className="absolute top-0 left-0 -translate-y-full text-[9px] uppercase tracking-[0.2em] text-base-content/50">
          {label}
        </div>
      )}
    </button>
  );
}

function colorMix(bonus: Gem): string {
  switch (bonus) {
    case "white":
      return "oklch(85% 0.03 85)";
    case "blue":
      return "oklch(55% 0.17 255)";
    case "green":
      return "oklch(60% 0.17 150)";
    case "red":
      return "oklch(60% 0.22 25)";
    case "black":
      return "oklch(30% 0.02 260)";
  }
}

function NobleTile({
  noble,
  bonuses,
}: {
  noble: Noble;
  bonuses?: Record<Gem, number>;
}) {
  const eligible = bonuses ? nobleEligible(bonuses, noble) : false;
  return (
    <div
      className={[
        "rounded-md p-2 flex flex-col gap-1",
        "transition-all",
        eligible ? "ring-2 ring-success" : "",
      ].join(" ")}
      style={{
        width: 78,
        background:
          "linear-gradient(180deg, oklch(95% 0.03 75), oklch(72% 0.12 75))",
        border: "1px solid oklch(60% 0.12 75)",
        boxShadow: "0 2px 4px oklch(0% 0 0 / 0.15)",
      }}
    >
      <div
        className="font-display tabular font-bold text-center"
        style={{ fontSize: 16, lineHeight: 1 }}
      >
        {noble.points}
      </div>
      <div className="flex items-center gap-0.5 flex-wrap justify-center">
        {GEMS.map((g) =>
          (noble.req[g] ?? 0) > 0 ? (
            <div key={g} className="flex items-center gap-0.5">
              <GemToken gem={g} size={10} />
              <span className="font-display font-bold tabular text-[10px]">
                {noble.req[g]}
              </span>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

// ------------------------- Main board -------------------------

function SplendorBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<SplendorView, SplendorMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const isOver = view.phase === "gameOver";
  const mySeat = view.seats[me];
  const myTokens = mySeat?.tokens;
  const myBonuses = mySeat?.bonuses;

  // Selection for take-3 / take-2
  const [selected, setSelected] = useState<Gem[]>([]);
  const clearSelection = () => setSelected([]);

  // Toggle a gem. If selecting 3, must be 3 different. Take-2 = two of same.
  const onGemClick = (g: Gem) => {
    setSelected((prev) => {
      if (prev.includes(g)) {
        if (prev.length >= 2 && prev.every((x) => x === g)) {
          return [];
        }
        return prev.filter((x) => x !== g);
      }
      if (prev.length === 0) return [g];
      // If prev has 1 and we click same, signal take-2 attempt.
      if (prev.length === 1 && prev[0] === g) {
        return [g, g];
      }
      if (prev.length >= 3) return prev;
      if (new Set([...prev, g]).size !== prev.length + 1 && prev[0] !== prev[1]) {
        // We already have same-gem (take-2) started; can't mix.
        return prev;
      }
      if (prev.length === 2 && prev[0] === prev[1]) return prev;
      return [...prev, g];
    });
  };

  const totalSelected = selected.length;
  const isTakeTwoPending =
    selected.length === 2 && selected[0] === selected[1];
  const canTakeThree =
    totalSelected === 3 &&
    new Set(selected).size === 3 &&
    selected.every((g) => (view.tokens[g] ?? 0) > 0);
  const canTakeTwo =
    isTakeTwoPending && (view.tokens[selected[0]!] ?? 0) >= 4;

  const tokenCountAfterTake =
    (myTokens ? tokenTotal(myTokens) : 0) + selected.length;
  const overflow = Math.max(0, tokenCountAfterTake - TOKEN_LIMIT);

  const [returnSel, setReturnSel] = useState<Record<GemWithGold, number>>({
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
    gold: 0,
  });
  const returnTotal = Object.values(returnSel).reduce((a, b) => a + b, 0);

  const adjustReturn = (g: GemWithGold, delta: number) => {
    setReturnSel((prev) => {
      const next = { ...prev };
      next[g] = Math.max(0, (next[g] ?? 0) + delta);
      return next;
    });
  };

  const resetReturn = () =>
    setReturnSel({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });

  const submitTakeThree = async () => {
    if (!canTakeThree) return;
    if (returnTotal !== overflow) return;
    await sendMove({
      kind: "takeThree",
      gems: [...selected] as [Gem, Gem, Gem],
      returnTokens: overflow > 0 ? returnSel : undefined,
    });
    clearSelection();
    resetReturn();
  };
  const submitTakeTwo = async () => {
    if (!canTakeTwo) return;
    if (returnTotal !== overflow) return;
    await sendMove({
      kind: "takeTwo",
      gem: selected[0]!,
      returnTokens: overflow > 0 ? returnSel : undefined,
    });
    clearSelection();
    resetReturn();
  };

  const reserveDisplay = async (tier: Tier, slot: number) => {
    if (!isMyTurn || isOver) return;
    if ((mySeat?.reservedCount ?? 0) >= RESERVE_LIMIT) return;
    await sendMove({
      kind: "reserve",
      tier,
      slot,
    });
  };
  const reserveDeck = async (tier: Tier) => {
    if (!isMyTurn || isOver) return;
    if ((mySeat?.reservedCount ?? 0) >= RESERVE_LIMIT) return;
    if (view.deckCounts[tier] <= 0) return;
    await sendMove({ kind: "reserve", tier });
  };

  const buyDisplay = async (tier: Tier, slot: number) => {
    if (!isMyTurn || isOver) return;
    await sendMove({
      kind: "buy",
      source: "display",
      tier,
      slot,
    });
  };
  const buyReserve = async (cardId: string) => {
    if (!isMyTurn || isOver) return;
    await sendMove({
      kind: "buy",
      source: "reserve",
      cardId,
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-6xl">
      <StatusBar
        view={view}
        me={me}
        isMyTurn={isMyTurn}
        playersById={playersById}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 w-full">
        {/* Main play area */}
        <div className="flex flex-col gap-3">
          <NobleRow nobles={view.nobles} bonuses={myBonuses} />

          <TierRow
            tier={3}
            slots={view.display[3]}
            deckCount={view.deckCounts[3]}
            canAct={isMyTurn && !isOver}
            canAfford={(c) => canAfford(c, mySeat)}
            canReserve={(mySeat?.reservedCount ?? 0) < RESERVE_LIMIT}
            bonuses={myBonuses}
            onBuy={(slot) => buyDisplay(3, slot)}
            onReserveSlot={(slot) => reserveDisplay(3, slot)}
            onReserveDeck={() => reserveDeck(3)}
          />
          <TierRow
            tier={2}
            slots={view.display[2]}
            deckCount={view.deckCounts[2]}
            canAct={isMyTurn && !isOver}
            canAfford={(c) => canAfford(c, mySeat)}
            canReserve={(mySeat?.reservedCount ?? 0) < RESERVE_LIMIT}
            bonuses={myBonuses}
            onBuy={(slot) => buyDisplay(2, slot)}
            onReserveSlot={(slot) => reserveDisplay(2, slot)}
            onReserveDeck={() => reserveDeck(2)}
          />
          <TierRow
            tier={1}
            slots={view.display[1]}
            deckCount={view.deckCounts[1]}
            canAct={isMyTurn && !isOver}
            canAfford={(c) => canAfford(c, mySeat)}
            canReserve={(mySeat?.reservedCount ?? 0) < RESERVE_LIMIT}
            bonuses={myBonuses}
            onBuy={(slot) => buyDisplay(1, slot)}
            onReserveSlot={(slot) => reserveDisplay(1, slot)}
            onReserveDeck={() => reserveDeck(1)}
          />

          <TokenBank
            tokens={view.tokens}
            selected={selected}
            onGemClick={(g) => isMyTurn && !isOver && onGemClick(g)}
          />

          {isMyTurn && !isOver && selected.length > 0 && (
            <TokenActionRow
              canTakeThree={canTakeThree}
              canTakeTwo={canTakeTwo}
              overflow={overflow}
              returnTotal={returnTotal}
              returnSel={returnSel}
              onReturnAdjust={adjustReturn}
              onClear={() => {
                clearSelection();
                resetReturn();
              }}
              onTakeThree={submitTakeThree}
              onTakeTwo={submitTakeTwo}
              myTokens={myTokens}
            />
          )}
        </div>

        {/* Side panel: seats */}
        <aside className="flex flex-col gap-3">
          <LastActionLine
            action={view.lastAction}
            playersById={playersById}
          />
          {view.players.map((id) => (
            <SeatCard
              key={id}
              view={view}
              seatId={id}
              playersById={playersById}
              me={me}
              onBuyReserve={buyReserve}
              canAct={isMyTurn && !isOver && id === me}
            />
          ))}
        </aside>
      </div>

      {isOver && (
        <GameOver view={view} playersById={playersById} me={me} />
      )}
    </div>
  );
}

function canAfford(
  card: Card,
  seat: SplendorView["seats"][string] | undefined,
): boolean {
  if (!seat) return false;
  return payForCard(card, seat.tokens, seat.bonuses).ok;
}

// ------------------------- Rows & side panels -------------------------

function NobleRow({
  nobles,
  bonuses,
}: {
  nobles: Noble[];
  bonuses?: Record<Gem, number>;
}) {
  if (nobles.length === 0) {
    return (
      <div className="text-xs text-base-content/40 italic text-center">
        All nobles have been claimed.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Nobles
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {nobles.map((n) => (
          <NobleTile key={n.id} noble={n} bonuses={bonuses} />
        ))}
      </div>
    </div>
  );
}

function TierRow({
  tier,
  slots,
  deckCount,
  canAct,
  canAfford,
  canReserve,
  bonuses,
  onBuy,
  onReserveSlot,
  onReserveDeck,
}: {
  tier: Tier;
  slots: (Card | null)[];
  deckCount: number;
  canAct: boolean;
  canAfford: (c: Card) => boolean;
  canReserve: boolean;
  bonuses?: Record<Gem, number>;
  onBuy: (slot: number) => void;
  onReserveSlot: (slot: number) => void;
  onReserveDeck: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-col items-center gap-1 min-w-[60px]">
        <DeckBack
          tier={tier}
          count={deckCount}
          canReserve={canAct && canReserve && deckCount > 0}
          onReserveDeck={onReserveDeck}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {slots.map((c, slot) =>
          c ? (
            <div key={slot} className="flex flex-col items-center gap-1">
              <DevCard
                card={c}
                highlight={canAct && canAfford(c)}
                onClick={() => canAct && canAfford(c) && onBuy(slot)}
                disabled={!canAct}
                bonuses={bonuses}
              />
              {canAct && canReserve && (
                <button
                  type="button"
                  onClick={() => onReserveSlot(slot)}
                  className="text-[9px] uppercase tracking-[0.18em] text-base-content/55 hover:text-base-content"
                >
                  Reserve
                </button>
              )}
            </div>
          ) : (
            <div
              key={slot}
              className="rounded-md border border-dashed border-base-content/20"
              style={{ width: 88, height: 118 }}
            />
          ),
        )}
      </div>
    </div>
  );
}

function DeckBack({
  tier,
  count,
  canReserve,
  onReserveDeck,
}: {
  tier: Tier;
  count: number;
  canReserve: boolean;
  onReserveDeck: () => void;
}) {
  const tierColor =
    tier === 1
      ? "var(--color-info)"
      : tier === 2
        ? "var(--color-warning)"
        : "var(--color-error)";
  return (
    <button
      type="button"
      disabled={!canReserve}
      onClick={onReserveDeck}
      className={[
        "rounded-md flex flex-col items-center justify-center gap-1",
        "transition-transform",
        canReserve ? "hover:-translate-y-0.5 cursor-pointer" : "cursor-default",
      ].join(" ")}
      style={{
        width: 48,
        height: 118,
        background: `linear-gradient(160deg, ${tierColor}, color-mix(in oklch, ${tierColor} 40%, black))`,
        border: `1px solid color-mix(in oklch, ${tierColor} 60%, black)`,
        color: "oklch(100% 0 0)",
      }}
      aria-label={`Tier ${tier} deck`}
    >
      <span
        className="font-display tabular font-bold"
        style={{ fontSize: 20, lineHeight: 1 }}
      >
        {tier === 1 ? "I" : tier === 2 ? "II" : "III"}
      </span>
      <span className="font-display font-bold tabular text-[11px] opacity-90">
        {count}
      </span>
    </button>
  );
}

function TokenBank({
  tokens,
  selected,
  onGemClick,
}: {
  tokens: Record<GemWithGold, number>;
  selected: Gem[];
  onGemClick: (g: Gem) => void;
}) {
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3 flex-wrap justify-center"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 70%, transparent)",
        boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.1)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Supply
      </div>
      {GEMS.map((g) => {
        const sel = selected.filter((x) => x === g).length;
        return (
          <button
            key={g}
            type="button"
            onClick={() => onGemClick(g)}
            className="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-base-100/50"
            disabled={tokens[g] === 0}
            aria-label={`${GEM_LABEL[g]} token`}
          >
            <GemToken gem={g} size={30} selected={sel > 0} dim={tokens[g] === 0} />
            <span className="font-display tabular font-bold">
              {tokens[g]}
              {sel > 0 && (
                <span className="text-primary ml-0.5">
                  (+{sel})
                </span>
              )}
            </span>
          </button>
        );
      })}
      <div className="flex items-center gap-1 px-1.5 py-1 rounded-md">
        <GemToken gem="gold" size={30} dim={tokens.gold === 0} />
        <span className="font-display tabular font-bold">{tokens.gold}</span>
      </div>
    </div>
  );
}

function TokenActionRow({
  canTakeThree,
  canTakeTwo,
  overflow,
  returnTotal,
  returnSel,
  onReturnAdjust,
  onClear,
  onTakeThree,
  onTakeTwo,
  myTokens,
}: {
  canTakeThree: boolean;
  canTakeTwo: boolean;
  overflow: number;
  returnTotal: number;
  returnSel: Record<GemWithGold, number>;
  onReturnAdjust: (g: GemWithGold, delta: number) => void;
  onClear: () => void;
  onTakeThree: () => void;
  onTakeTwo: () => void;
  myTokens?: Record<GemWithGold, number>;
}) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-primary) 10%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)",
      }}
    >
      {overflow > 0 && myTokens && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-base-content/70">
            Over limit by{" "}
            <span className="font-semibold text-warning">{overflow}</span> —
            return {overflow - returnTotal} more
          </span>
          {(Object.keys(GEM_COLOR) as GemWithGold[]).map((g) => {
            const have = myTokens[g] ?? 0;
            const ret = returnSel[g] ?? 0;
            if (have === 0 && ret === 0) return null;
            return (
              <div key={g} className="flex items-center gap-1">
                <GemToken gem={g} size={16} />
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  disabled={ret <= 0}
                  onClick={() => onReturnAdjust(g, -1)}
                >
                  −
                </button>
                <span className="font-display tabular font-bold text-xs w-4 text-center">
                  {ret}
                </span>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  disabled={ret >= have}
                  onClick={() => onReturnAdjust(g, +1)}
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {canTakeTwo && (
          <button
            type="button"
            onClick={onTakeTwo}
            disabled={overflow !== returnTotal}
            className="btn btn-primary rounded-full px-4 font-semibold"
          >
            Take 2
          </button>
        )}
        {canTakeThree && (
          <button
            type="button"
            onClick={onTakeThree}
            disabled={overflow !== returnTotal}
            className="btn btn-primary rounded-full px-4 font-semibold"
          >
            Take 3
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          className="btn btn-ghost rounded-full px-4 font-semibold"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function SeatCard({
  view,
  seatId,
  playersById,
  me,
  onBuyReserve,
  canAct,
}: {
  view: SplendorView;
  seatId: string;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
  onBuyReserve: (cardId: string) => void;
  canAct: boolean;
}) {
  const seat = view.seats[seatId]!;
  const p = playersById[seatId] ?? { id: seatId, name: seatId };
  const isMe = seatId === me;
  const active = view.current === seatId && view.phase !== "gameOver";
  const triggered = view.finalRoundTrigger === seatId;
  return (
    <div
      className={[
        "rounded-xl p-3 flex flex-col gap-2",
        "border transition-colors",
        active
          ? "border-primary/55 bg-primary/10"
          : "border-base-300/70 bg-base-100",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={[
            "text-sm font-semibold truncate max-w-[140px]",
            active ? "text-primary" : "",
          ].join(" ")}
        >
          {p.name}
        </span>
        {isMe && (
          <span className="text-[9px] uppercase tracking-[0.18em] text-base-content/50">
            you
          </span>
        )}
        {triggered && (
          <span className="text-[9px] uppercase tracking-[0.18em] text-warning">
            final round
          </span>
        )}
        <span className="ml-auto font-display tabular font-bold text-lg">
          {seat.points}
          <span className="text-xs text-base-content/45">/{POINTS_TO_WIN}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {GEMS.map((g) => (
          <TokenBadge
            key={g}
            gem={g}
            count={(seat.tokens[g] ?? 0) + (seat.bonuses[g] ?? 0)}
          />
        ))}
        <TokenBadge gem="gold" count={seat.tokens.gold ?? 0} />
      </div>

      <div className="text-[10px] uppercase tracking-[0.18em] text-base-content/50">
        {seat.cardCount} cards · {seat.reservedCount} reserved ·{" "}
        {seat.nobles.length} nobles
      </div>

      {isMe && seat.reserved && seat.reserved.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 mb-1">
            Your reserved
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {seat.reserved.map((c) => (
              <DevCard
                key={c.id}
                card={c}
                bonuses={seat.bonuses}
                highlight={canAct && canAfford(c, seat)}
                disabled={!canAct || !canAfford(c, seat)}
                onClick={() => onBuyReserve(c.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LastActionLine({
  action,
  playersById,
}: {
  action: SplendorView["lastAction"];
  playersById: Record<string, { id: string; name: string }>;
}) {
  if (!action) return null;
  const name = playersById[action.by]?.name ?? action.by;
  let text = "";
  if (action.kind === "takeTokens") {
    const bits = Object.entries(action.tokens)
      .map(([g, n]) => `${n}×${g}`)
      .join(", ");
    text = `${name} took ${bits}`;
  } else if (action.kind === "reserve") {
    text = `${name} reserved ${action.fromDeck ? `top of T${action.tier}` : `a T${action.tier} card`}${action.goldGained ? " (+gold)" : ""}`;
  } else {
    text = `${name} bought ${action.bonus}${action.points ? ` (+${action.points})` : ""}${action.fromReserve ? " from reserve" : ""}${action.nobleClaimed ? " · claimed a noble" : ""}`;
  }
  return (
    <div className="text-xs text-base-content/60 italic px-1">{text}</div>
  );
}

function StatusBar({
  view,
  me,
  isMyTurn,
  playersById,
}: {
  view: SplendorView;
  me: string;
  isMyTurn: boolean;
  playersById: Record<string, { id: string; name: string }>;
}) {
  if (view.phase === "gameOver") {
    return (
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        ◆ Final ◆
      </div>
    );
  }
  const currentName = playersById[view.current]?.name ?? view.current;
  return (
    <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold flex items-center justify-center gap-2 flex-wrap">
      {isMyTurn ? (
        <span className="text-primary font-bold">Your turn</span>
      ) : (
        <span>
          Waiting on{" "}
          <span className="text-base-content font-bold">{currentName}</span>
        </span>
      )}
      {view.finalRoundTrigger && view.finalRoundTrigger !== me && (
        <>
          <span className="text-base-content/35">·</span>
          <span className="text-warning">
            final round — {playersById[view.finalRoundTrigger]?.name ?? view.finalRoundTrigger}
            {" "}is at {POINTS_TO_WIN}+
          </span>
        </>
      )}
      {view.finalRoundTrigger === me && (
        <>
          <span className="text-base-content/35">·</span>
          <span className="text-success">you triggered the final round</span>
        </>
      )}
    </div>
  );
}

function GameOver({
  view,
  playersById,
  me,
}: {
  view: SplendorView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  const winners = view.winners ?? [];
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{
        background:
          "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
        ◆ Final scores ◆
      </div>
      {view.players
        .map((id) => ({
          id,
          name: playersById[id]?.name ?? id,
          points: view.seats[id]!.points,
          cards: view.seats[id]!.cardCount,
        }))
        .sort((a, b) =>
          b.points !== a.points ? b.points - a.points : a.cards - b.cards,
        )
        .map((r, i) => (
          <div
            key={r.id}
            className={[
              "flex items-center gap-3 rounded-lg px-3 py-2",
              winners.includes(r.id)
                ? "bg-success/15 ring-1 ring-success/40"
                : "bg-base-100/60",
            ].join(" ")}
          >
            <div className="text-xs uppercase tracking-[0.2em] text-base-content/45 w-6 text-right">
              {i + 1}
            </div>
            <div className="font-semibold text-sm">
              {r.name}
              {r.id === me && (
                <span className="ml-1 text-[9px] uppercase tracking-[0.18em] text-base-content/50">
                  you
                </span>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span>
                <span className="font-semibold tabular">{r.points}</span>{" "}
                <span className="text-base-content/55">pts</span>
              </span>
              <span>
                <span className="font-semibold tabular">{r.cards}</span>{" "}
                <span className="text-base-content/55">cards</span>
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}

export const splendorClientModule: ClientGameModule<
  SplendorView,
  SplendorMove,
  SplendorConfig
> = {
  type: SPLENDOR_TYPE,
  Board: SplendorBoard,
};
