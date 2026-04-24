import { useEffect, useMemo, useState } from "react";
import {
  Card as CardShell,
  type BoardProps,
  type CardSize,
  type ClientGameModule,
} from "@bgo/sdk-client";
import {
  FORSALE_TYPE,
  type ForSaleConfig,
  type ForSaleMove,
  type ForSaleView,
} from "./shared";

// ------------------------- Property art -------------------------

/**
 * Five tiers map to a building "stature" + theme color so a quick glance
 * tells you which band a card belongs to (shack → mansion → skyline).
 */
function tierFor(value: number): { color: string; tier: 1 | 2 | 3 | 4 | 5 } {
  if (value <= 6) return { color: "var(--color-info)", tier: 1 }; // tent / shack
  if (value <= 12) return { color: "var(--color-success)", tier: 2 }; // bungalow
  if (value <= 18) return { color: "var(--color-warning)", tier: 3 }; // house
  if (value <= 24) return { color: "var(--color-accent)", tier: 4 }; // mansion
  return { color: "var(--color-error)", tier: 5 }; // skyscraper / castle
}

/** Per-tier silhouette inside the property face. */
function PropertySilhouette({ tier, color }: { tier: 1 | 2 | 3 | 4 | 5; color: string }) {
  const fill = `color-mix(in oklch, ${color} 75%, black)`;
  const accent = `color-mix(in oklch, ${color} 40%, white)`;
  switch (tier) {
    case 1:
      // Tent
      return (
        <g>
          <path d="M50 56 L26 96 L74 96 Z" fill={fill} />
          <path d="M50 56 L50 96" stroke={accent} strokeWidth="1" />
        </g>
      );
    case 2:
      // Cabin: square + pitched roof
      return (
        <g>
          <rect x="30" y="76" width="40" height="22" fill={fill} />
          <path d="M26 76 L50 56 L74 76 Z" fill={`color-mix(in oklch, ${color} 85%, black)`} />
          <rect x="44" y="84" width="12" height="14" fill={accent} />
        </g>
      );
    case 3:
      // House with chimney
      return (
        <g>
          <rect x="26" y="74" width="48" height="24" fill={fill} />
          <path d="M22 74 L50 52 L78 74 Z" fill={`color-mix(in oklch, ${color} 88%, black)`} />
          <rect x="62" y="58" width="6" height="12" fill={fill} />
          <rect x="34" y="80" width="10" height="10" fill={accent} />
          <rect x="56" y="84" width="10" height="14" fill={accent} />
        </g>
      );
    case 4:
      // Mansion: wider footprint + columns
      return (
        <g>
          <rect x="22" y="70" width="56" height="28" fill={fill} />
          <path d="M18 70 L50 50 L82 70 Z" fill={`color-mix(in oklch, ${color} 88%, black)`} />
          <rect x="28" y="78" width="6" height="20" fill={accent} />
          <rect x="42" y="78" width="6" height="20" fill={accent} />
          <rect x="56" y="78" width="6" height="20" fill={accent} />
          <rect x="66" y="78" width="6" height="20" fill={accent} />
        </g>
      );
    case 5:
      // Skyline / tower
      return (
        <g>
          <rect x="20" y="80" width="14" height="18" fill={fill} />
          <rect x="36" y="62" width="14" height="36" fill={`color-mix(in oklch, ${color} 88%, black)`} />
          <rect x="52" y="48" width="14" height="50" fill={fill} />
          <rect x="68" y="72" width="12" height="26" fill={`color-mix(in oklch, ${color} 88%, black)`} />
          {[68, 78, 88].map((y) => (
            <rect key={y} x="55" y={y - 14} width="2.5" height="4" fill={accent} />
          ))}
          {[58, 70, 82, 94].map((y) => (
            <rect key={y} x="42" y={y - 14} width="2" height="3" fill={accent} />
          ))}
        </g>
      );
  }
}

function PropertyFace({ value }: { value: number }) {
  const { color, tier } = tierFor(value);
  const id = `prop-grad-${value}`;
  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={`color-mix(in oklch, ${color} 18%, var(--color-base-100))`} />
          <stop offset="100%" stopColor={`color-mix(in oklch, ${color} 55%, var(--color-base-100))`} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="140" fill={`url(#${id})`} />
      <rect
        x="5"
        y="5"
        width="90"
        height="130"
        rx="5"
        fill="none"
        stroke={color}
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      {/* Ground line under silhouette */}
      <line
        x1="14"
        y1="98"
        x2="86"
        y2="98"
        stroke={`color-mix(in oklch, ${color} 70%, black)`}
        strokeWidth="1"
        strokeOpacity="0.55"
      />
      <PropertySilhouette tier={tier} color={color} />
      {/* Corner indices */}
      <text
        x="9"
        y="22"
        fill="var(--color-base-content)"
        fontFamily="var(--font-display, serif)"
        fontWeight="800"
        fontSize="14"
      >
        {value}
      </text>
      <text
        x="91"
        y="132"
        fill="var(--color-base-content)"
        fontFamily="var(--font-display, serif)"
        fontWeight="800"
        fontSize="14"
        textAnchor="end"
        transform="rotate(180 91 132)"
      >
        {value}
      </text>
      {/* Big number */}
      <text
        x="50"
        y="124"
        fill="var(--color-base-content)"
        fontFamily="var(--font-display, serif)"
        fontWeight="900"
        fontSize="20"
        textAnchor="middle"
      >
        {value}
      </text>
    </svg>
  );
}

function PropertyCard({
  value,
  size = "md",
  dim = false,
  highlight = false,
  onClick,
}: {
  value: number;
  size?: CardSize;
  dim?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <CardShell
      size={size}
      ghost={dim}
      selected={highlight}
      highlight="primary"
      onClick={onClick}
      ariaLabel={`property ${value}`}
    >
      <PropertyFace value={value} />
    </CardShell>
  );
}

// ------------------------- Cheque art -------------------------

/** Bank-cheque face: olive paper, signature line, pay-to row, dollar amount. */
function ChequeFace({ value }: { value: number }) {
  const id = `chq-grad-${value}`;
  return (
    <svg
      viewBox="0 0 140 100"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--color-success) 38%, var(--color-base-100))" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="140" height="100" fill={`url(#${id})`} />
      <rect
        x="5"
        y="5"
        width="130"
        height="90"
        rx="4"
        fill="none"
        stroke="color-mix(in oklch, var(--color-success) 60%, transparent)"
        strokeWidth="1"
      />
      {/* "PAY TO" header strip */}
      <text
        x="10"
        y="18"
        fill="color-mix(in oklch, var(--color-success-content) 75%, transparent)"
        fontFamily="var(--font-display, serif)"
        fontWeight="700"
        fontSize="8"
        letterSpacing="1.2"
      >
        PAY TO BEARER
      </text>
      {/* Amount box */}
      <rect
        x="84"
        y="10"
        width="48"
        height="22"
        rx="3"
        fill="color-mix(in oklch, var(--color-success) 18%, var(--color-base-100))"
        stroke="color-mix(in oklch, var(--color-success) 50%, transparent)"
        strokeWidth="1"
      />
      <text
        x="108"
        y="27"
        fill="var(--color-base-content)"
        fontFamily="var(--font-display, serif)"
        fontWeight="900"
        fontSize="13"
        textAnchor="middle"
      >
        ${value}k
      </text>
      {/* Big amount */}
      <text
        x="70"
        y="60"
        fill="var(--color-base-content)"
        fontFamily="var(--font-display, serif)"
        fontWeight="900"
        fontSize="30"
        textAnchor="middle"
      >
        ${value}
      </text>
      <text
        x="70"
        y="72"
        fill="color-mix(in oklch, var(--color-base-content) 55%, transparent)"
        fontFamily="var(--font-display, serif)"
        fontWeight="600"
        fontSize="7"
        letterSpacing="2"
        textAnchor="middle"
      >
        THOUSAND
      </text>
      {/* Signature line */}
      <line
        x1="14"
        y1="86"
        x2="78"
        y2="86"
        stroke="color-mix(in oklch, var(--color-base-content) 35%, transparent)"
        strokeWidth="0.8"
      />
      <text
        x="14"
        y="93"
        fill="color-mix(in oklch, var(--color-base-content) 50%, transparent)"
        fontFamily="var(--font-display, serif)"
        fontStyle="italic"
        fontSize="6"
      >
        Authorized signatory
      </text>
      {/* Watermark seal */}
      <circle
        cx="118"
        cy="78"
        r="10"
        fill="none"
        stroke="color-mix(in oklch, var(--color-success) 55%, transparent)"
        strokeWidth="1"
      />
      <text
        x="118"
        y="82"
        fill="color-mix(in oklch, var(--color-success) 70%, transparent)"
        fontFamily="var(--font-display, serif)"
        fontWeight="800"
        fontSize="8"
        textAnchor="middle"
      >
        $
      </text>
    </svg>
  );
}

function ChequeCard({
  value,
  size = "md",
  dim = false,
}: {
  value: number;
  size?: CardSize;
  dim?: boolean;
}) {
  // Cheques are landscape — render the face inside an explicit landscape style
  // override so a horizontal aspect (1.4:1) is preserved across sizes.
  const landscape: Record<CardSize, { w: number; h: number; r: number }> = {
    xs: { w: 56, h: 38, r: 4 },
    sm: { w: 72, h: 50, r: 5 },
    md: { w: 96, h: 66, r: 6 },
    lg: { w: 128, h: 88, r: 8 },
    xl: { w: 160, h: 110, r: 10 },
  };
  const dims = landscape[size];
  return (
    <CardShell
      size={size}
      ghost={dim}
      ariaLabel={`cheque $${value}k`}
      style={{ width: dims.w, height: dims.h, borderRadius: dims.r }}
    >
      <ChequeFace value={value} />
    </CardShell>
  );
}

function Coin({ amount }: { amount: number }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block h-3 w-3 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, color-mix(in oklch, var(--color-warning) 80%, white) 0%, color-mix(in oklch, var(--color-warning) 75%, black) 100%)",
          boxShadow: "inset 0 -1px 0 oklch(0% 0 0 / 0.3)",
        }}
      />
      <span className="font-display tabular-nums font-bold text-base-content">
        {amount}
      </span>
    </div>
  );
}

// ------------------------- Main board -------------------------

function ForSaleBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<ForSaleView, ForSaleMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const isOver = view.phase === "gameOver";
  const inProperty = view.phase === "property";
  const inCheque = view.phase === "cheque";

  const [bidInput, setBidInput] = useState<number>(0);
  const minBid = view.currentBid + 1;
  useEffect(() => {
    // When the current bid jumps up, reset the input to minBid.
    setBidInput((prev) => (prev < minBid ? minBid : prev));
  }, [minBid]);

  const myCoins = view.coins[me] ?? 0;
  const iAmPassed = view.passedThisRound.includes(me);

  const nameOf = (id: string) => playersById[id]?.name ?? id;
  const currentName = nameOf(view.current);

  const sendBid = async () => {
    if (!inProperty || !isMyTurn) return;
    const amt = Math.max(minBid, Math.min(myCoins, bidInput));
    if (amt > myCoins) return;
    await sendMove({ kind: "bid", amount: amt });
  };
  const sendPass = async () => {
    if (!inProperty || !isMyTurn) return;
    await sendMove({ kind: "pass" });
  };
  const submitProperty = async (card: number) => {
    if (!inCheque) return;
    if (view.mySelection != null) return;
    await sendMove({ kind: "playProperty", card });
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-5xl">
      <PhaseHeader view={view} />

      <Scoreboard
        view={view}
        playersById={playersById}
        me={me}
      />

      {inProperty && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Properties up for bid
            <span className="ml-2 text-base-content/35">
              · {view.propertyDeckSize} left in deck
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {view.faceUpProperties.map((c) => (
              <PropertyCard key={c} value={c} size="lg" />
            ))}
          </div>

          <CurrentBidLine
            view={view}
            currentName={currentName}
            isMyTurn={isMyTurn}
            playersById={playersById}
            me={me}
          />

          {isMyTurn && !iAmPassed && (
            <PropertyActions
              myCoins={myCoins}
              minBid={minBid}
              bidInput={Math.max(minBid, bidInput)}
              setBidInput={setBidInput}
              onBid={sendBid}
              onPass={sendPass}
              canBid={myCoins >= minBid}
            />
          )}

          {view.lastResolve?.kind === "property" && (
            <PropertyResolveRow
              resolve={view.lastResolve}
              playersById={playersById}
            />
          )}
        </div>
      )}

      {inCheque && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Cheques up for grabs
            <span className="ml-2 text-base-content/35">
              · {view.chequeDeckSize} left in deck
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {view.faceUpCheques.map((c, i) => (
              <ChequeCard key={`${c}-${i}`} value={c} size="lg" />
            ))}
          </div>

          <ChequePlaySummary
            view={view}
            playersById={playersById}
            me={me}
          />

          {view.mySelection === null && view.myProperties.length > 0 && (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="text-xs text-base-content/60">
                Play one property — highest claims the best cheque
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {view.myProperties.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => submitProperty(c)}
                    className="transform transition-transform hover:scale-[1.05] hover:-translate-y-0.5"
                    aria-label={`Play property ${c}`}
                  >
                    <PropertyCard value={c} size="lg" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {view.mySelection !== null && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs text-base-content/60">
                Locked in — waiting on others
              </div>
              <PropertyCard value={view.mySelection} size="md" highlight />
            </div>
          )}

          {view.lastResolve?.kind === "cheque" && (
            <ChequeResolveRow
              resolve={view.lastResolve}
              playersById={playersById}
            />
          )}
        </div>
      )}

      {isOver && (
        <Leaderboard
          view={view}
          playersById={playersById}
          me={me}
        />
      )}

      {/* Non-current-player's hand always visible to them */}
      {!isOver && view.myProperties.length > 0 && !inCheque && (
        <div className="flex flex-col items-center gap-1">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/50">
            Your hand
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {view.myProperties.map((c) => (
              <PropertyCard key={c} value={c} size="sm" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------- Subcomponents -------------------------

function PhaseHeader({ view }: { view: ForSaleView }) {
  if (view.phase === "gameOver") {
    return (
      <div className="text-xs uppercase tracking-[0.22em] font-semibold text-base-content/55">
        ◆ Final ◆
      </div>
    );
  }
  const label =
    view.phase === "property" ? "Phase 1 — Auction" : "Phase 2 — Cheques";
  return (
    <div className="text-xs uppercase tracking-[0.22em] font-semibold text-base-content/55">
      {label}
    </div>
  );
}

function Scoreboard({
  view,
  playersById,
  me,
}: {
  view: ForSaleView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-4xl">
      {view.players.map((id) => {
        const p = playersById[id] ?? { id, name: id };
        const active =
          view.phase === "property" && view.current === id && !view.winners;
        const isMe = id === me;
        const passed = view.passedThisRound.includes(id);
        const submitted = view.phase === "cheque" && view.submitted[id];
        return (
          <div
            key={id}
            className={[
              "rounded-xl px-3 py-2 flex flex-col items-center gap-1 min-w-[128px]",
              "border transition-colors relative",
              active
                ? "border-primary/55 bg-primary/10"
                : passed
                  ? "border-base-300/60 bg-base-200/40 text-base-content/50"
                  : "border-base-300/80 bg-base-100",
            ].join(" ")}
            // Persistent self cue: an additional 1px primary-tinted inset
            // ring layers *under* the turn-active border so the player's own
            // chip is never anonymous, even when they're not on turn.
            style={
              isMe
                ? {
                    boxShadow:
                      "inset 0 0 0 1px color-mix(in oklch, var(--color-primary) 30%, transparent)",
                  }
                : undefined
            }
          >
            <div className="flex items-center gap-1">
              {isMe && (
                <span
                  aria-hidden
                  className="text-[10px] leading-none"
                  style={{ color: "var(--color-primary)" }}
                >
                  ◆
                </span>
              )}
              <span
                className={[
                  "text-xs font-semibold truncate max-w-[100px]",
                  active ? "text-primary" : "",
                ].join(" ")}
              >
                {isMe ? "You" : p.name}
              </span>
              {passed && (
                <span className="text-[9px] uppercase tracking-[0.18em] text-base-content/50">
                  passed
                </span>
              )}
              {submitted && (
                <span className="text-[9px] uppercase tracking-[0.18em] text-success/80">
                  in
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <Coin amount={view.coins[id] ?? 0} />
              <span className="text-base-content/55">·</span>
              <span className="text-base-content/70">
                <span className="tabular-nums font-semibold">
                  {view.propertyCount[id] ?? 0}
                </span>
                <span className="text-base-content/45"> prop</span>
              </span>
              <span className="text-base-content/55">·</span>
              <span className="text-base-content/70">
                <span className="tabular-nums font-semibold">
                  {view.chequeCount[id] ?? 0}
                </span>
                <span className="text-base-content/45"> cheq</span>
              </span>
            </div>
            {view.phase === "property" && view.bids[id] ? (
              <div className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
                bid {view.bids[id]}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CurrentBidLine({
  view,
  currentName,
  isMyTurn,
  playersById,
  me,
}: {
  view: ForSaleView;
  currentName: string;
  isMyTurn: boolean;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  const bidderName = view.currentBidder
    ? playersById[view.currentBidder]?.name ?? view.currentBidder
    : null;
  return (
    <div className="text-xs text-base-content/70 text-center">
      {view.currentBid === 0 ? (
        <span>
          No bid yet
          {isMyTurn ? (
            <> · <span className="text-primary font-semibold">your call</span></>
          ) : (
            <>
              {" "}
              · waiting on{" "}
              <span className="text-base-content font-semibold">
                {currentName}
              </span>
            </>
          )}
        </span>
      ) : (
        <span>
          Top bid:{" "}
          <span className="font-semibold text-base-content">
            {view.currentBid}
          </span>{" "}
          by{" "}
          <span className="font-semibold text-base-content">
            {view.currentBidder === me ? "you" : bidderName}
          </span>
          {isMyTurn ? (
            <> · <span className="text-primary font-semibold">your call</span></>
          ) : (
            <>
              {" "}
              · waiting on{" "}
              <span className="text-base-content font-semibold">
                {currentName}
              </span>
            </>
          )}
        </span>
      )}
    </div>
  );
}

function PropertyActions({
  myCoins,
  minBid,
  bidInput,
  setBidInput,
  onBid,
  onPass,
  canBid,
}: {
  myCoins: number;
  minBid: number;
  bidInput: number;
  setBidInput: (n: number) => void;
  onBid: () => void;
  onPass: () => void;
  canBid: boolean;
}) {
  const v = Math.max(minBid, Math.min(myCoins, bidInput));
  return (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-circle btn-sm btn-ghost"
          onClick={() => setBidInput(v - 1)}
          disabled={!canBid || v <= minBid}
          aria-label="decrement"
        >
          −
        </button>
        <div
          className="font-display tracking-tight tabular-nums text-center"
          style={{ fontSize: "var(--text-display-sm)", minWidth: "2ch" }}
        >
          {canBid ? v : "—"}
        </div>
        <button
          type="button"
          className="btn btn-circle btn-sm btn-ghost"
          onClick={() => setBidInput(v + 1)}
          disabled={!canBid || v >= myCoins}
          aria-label="increment"
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="btn btn-primary rounded-full px-4 font-semibold"
        onClick={onBid}
        disabled={!canBid}
      >
        {canBid ? `Bid ${v}` : "Can't afford"}
      </button>
      <button
        type="button"
        className="btn btn-ghost rounded-full px-4 font-semibold"
        onClick={onPass}
      >
        Pass
      </button>
    </div>
  );
}

function PropertyResolveRow({
  resolve,
  playersById,
}: {
  resolve: { kind: "property"; takes: Array<{ player: string; card: number; paid: number }> };
  playersById: Record<string, { id: string; name: string }>;
}) {
  return (
    <div
      className="max-w-3xl w-full rounded-xl p-3 flex flex-col gap-2 parlor-fade"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 60%, var(--color-base-100))",
        border: "1px solid color-mix(in oklch, var(--color-base-300) 70%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Round recap
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {resolve.takes.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="font-semibold truncate max-w-[120px]">
              {playersById[t.player]?.name ?? t.player}
            </span>
            <span className="text-base-content/55">→</span>
            <PropertyCard value={t.card} size="sm" />
            <span className="text-base-content/55">
              paid{" "}
              <span className="font-semibold text-base-content">{t.paid}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChequePlaySummary({
  view,
  playersById,
  me,
}: {
  view: ForSaleView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {view.players.map((id) => {
        const submitted = view.submitted[id];
        const isMe = id === me;
        return (
          <div
            key={id}
            className={[
              "rounded-lg px-2 py-1 text-xs flex items-center gap-1",
              submitted
                ? "bg-success/15 text-success-content"
                : "bg-base-200",
            ].join(" ")}
          >
            <span className="truncate max-w-[100px] font-semibold">
              {playersById[id]?.name ?? id}
            </span>
            {isMe && (
              <span className="text-[9px] uppercase tracking-[0.18em] opacity-70">
                you
              </span>
            )}
            <span className="text-base-content/50">
              {submitted ? "✓ submitted" : "·"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ChequeResolveRow({
  resolve,
  playersById,
}: {
  resolve: {
    kind: "cheque";
    plays: Array<{ player: string; property: number; cheque: number }>;
  };
  playersById: Record<string, { id: string; name: string }>;
}) {
  return (
    <div
      className="max-w-3xl w-full rounded-xl p-3 flex flex-col gap-2 parlor-fade"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 60%, var(--color-base-100))",
        border: "1px solid color-mix(in oklch, var(--color-base-300) 70%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Round recap
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {resolve.plays.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="font-semibold truncate max-w-[120px]">
              {playersById[p.player]?.name ?? p.player}
            </span>
            <span className="text-base-content/55">plays</span>
            <PropertyCard value={p.property} size="sm" />
            <span className="text-base-content/55">takes</span>
            <ChequeCard value={p.cheque} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Leaderboard({
  view,
  playersById,
  me,
}: {
  view: ForSaleView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  if (!view.finalScores) return null;
  const rows = view.players
    .map((id) => ({
      id,
      name: playersById[id]?.name ?? id,
      score: view.finalScores![id] ?? 0,
      coins: view.coins[id] ?? 0,
      cheques: view.cheques[id] ?? [],
    }))
    .sort((a, b) => b.score - a.score);
  return (
    <div className="max-w-3xl w-full rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-success-content">
        ◆ Final scores ◆
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, idx) => {
          const win = (view.winners ?? []).includes(r.id);
          const isMe = r.id === me;
          return (
            <div
              key={r.id}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2",
                win
                  ? "bg-success/15 ring-1 ring-success/40"
                  : "bg-base-100/60",
              ].join(" ")}
            >
              <div className="text-xs uppercase tracking-[0.2em] text-base-content/45 w-6 text-right">
                {idx + 1}
              </div>
              <div className="font-semibold text-sm">
                {r.name}
                {isMe && (
                  <span className="ml-1 text-[9px] uppercase tracking-[0.18em] text-base-content/50">
                    you
                  </span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <Coin amount={r.coins} />
                <span className="text-base-content/35">+</span>
                <span className="font-semibold tabular-nums">
                  {r.cheques.reduce((a, b) => a + b, 0)}
                </span>
                <span className="text-base-content/35">=</span>
                <span
                  className="font-display tracking-tight font-bold tabular-nums"
                  style={{ fontSize: "1.1rem" }}
                >
                  {r.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const forSaleClientModule: ClientGameModule<
  ForSaleView,
  ForSaleMove,
  ForSaleConfig
> = {
  type: FORSALE_TYPE,
  Board: ForSaleBoard,
};
