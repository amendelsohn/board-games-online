import { useMemo, useState } from "react";
import {
  HandActionLayout,
  type BoardProps,
  type ClientGameModule,
} from "@bgo/sdk-client";
import {
  POINTS_TO_WIN,
  SKULL_TYPE,
  totalDiscsOnTable,
  type DiscKind,
  type SkullConfig,
  type SkullMove,
  type SkullRoundResult,
  type SkullView,
} from "./shared";

// ------------------------- Disc visuals -------------------------

function Disc({
  kind,
  facedown,
  size = 44,
  highlight = false,
  dim = false,
}: {
  kind?: DiscKind;
  facedown: boolean;
  size?: number;
  highlight?: boolean;
  dim?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    position: "relative",
    flexShrink: 0,
    opacity: dim ? 0.4 : 1,
    boxShadow: highlight
      ? "0 0 0 2px var(--color-success), 0 6px 18px color-mix(in oklch, var(--color-success) 30%, transparent)"
      : "inset 0 1px 0 oklch(100% 0 0 / 0.3), inset 0 -2px 4px oklch(0% 0 0 / 0.3), 0 2px 4px oklch(0% 0 0 / 0.25)",
    transition: "transform 240ms ease, box-shadow 240ms ease",
  };

  if (facedown) {
    return (
      <div
        aria-label="face-down disc"
        style={{
          ...baseStyle,
          background:
            "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--color-neutral) 70%, var(--color-base-300)) 0%, color-mix(in oklch, var(--color-neutral) 95%, black) 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "18%",
            borderRadius: "50%",
            border:
              "1px dashed color-mix(in oklch, var(--color-base-100) 30%, transparent)",
            opacity: 0.6,
          }}
        />
      </div>
    );
  }

  if (kind === "flower") {
    return (
      <div
        aria-label="flower"
        style={{
          ...baseStyle,
          background:
            "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--color-success) 75%, white) 0%, color-mix(in oklch, var(--color-success) 90%, black) 100%)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden>
          <g fill="oklch(100% 0 0 / 0.9)">
            {Array.from({ length: 6 }).map((_, i) => {
              const a = (i * Math.PI) / 3;
              const cx = 12 + Math.cos(a) * 5;
              const cy = 12 + Math.sin(a) * 5;
              return <circle key={i} cx={cx} cy={cy} r={3} />;
            })}
            <circle
              cx={12}
              cy={12}
              r={2.4}
              fill="color-mix(in oklch, var(--color-warning) 80%, white)"
            />
          </g>
        </svg>
      </div>
    );
  }

  // skull
  return (
    <div
      aria-label="skull"
      style={{
        ...baseStyle,
        background:
          "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--color-error) 75%, white) 0%, color-mix(in oklch, var(--color-error) 70%, black) 100%)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg viewBox="0 0 24 24" width="62%" height="62%" aria-hidden>
        <g fill="oklch(100% 0 0 / 0.95)">
          {/* Cranium */}
          <path d="M6 10.5C6 6.4 8.7 4 12 4s6 2.4 6 6.5c0 2-.6 3.6-1.6 4.8v2.2c0 .8-.7 1.5-1.5 1.5H9.1a1.5 1.5 0 0 1-1.5-1.5v-2.2C6.6 14.1 6 12.5 6 10.5Z" />
        </g>
        {/* Eyes */}
        <circle cx="9.2" cy="11" r="1.6" fill="color-mix(in oklch, var(--color-error) 70%, black)" />
        <circle cx="14.8" cy="11" r="1.6" fill="color-mix(in oklch, var(--color-error) 70%, black)" />
        {/* Nose */}
        <path
          d="M12 13l-0.9 2h1.8Z"
          fill="color-mix(in oklch, var(--color-error) 70%, black)"
        />
        {/* Teeth */}
        <g stroke="color-mix(in oklch, var(--color-error) 70%, black)" strokeWidth="0.6">
          <line x1="10" y1="17.2" x2="10" y2="19" />
          <line x1="12" y1="17.2" x2="12" y2="19" />
          <line x1="14" y1="17.2" x2="14" y2="19" />
        </g>
      </svg>
    </div>
  );
}

// ------------------------- Stack display -------------------------

function Stack({
  stackLen,
  flippedFromTop,
  reveal,
  ownFacedown,
  highlight,
  dim,
}: {
  stackLen: number;
  /** How many from the top are face-up (during flipping). */
  flippedFromTop: number;
  /** Face-up reveals in "flipped order" (oldest first, newest last). */
  reveal: DiscKind[];
  /** For the viewer's own stack: the full private contents bottom-up. */
  ownFacedown?: DiscKind[];
  highlight?: boolean;
  dim?: boolean;
}) {
  if (stackLen === 0) {
    return (
      <div
        className="h-12 w-12 rounded-full border border-dashed border-base-content/25 flex items-center justify-center text-[10px] uppercase tracking-wider text-base-content/35"
        style={{ opacity: dim ? 0.5 : 1 }}
      >
        ·
      </div>
    );
  }
  // Build a bottom-up list of what to render at each position.
  // Positions 0..stackLen-1 where 0 = bottom, stackLen-1 = top.
  // The top `flippedFromTop` positions are face-up from `reveal` (reveal[0] was
  // the *first* flip = the top-most disc).
  const items: Array<{ facedown: boolean; kind?: DiscKind }> = [];
  for (let pos = 0; pos < stackLen; pos++) {
    const fromTop = stackLen - 1 - pos;
    if (fromTop < flippedFromTop) {
      // reveal[fromTop] would be wrong — reveal[0] is the first flip.
      // reveal[i] corresponds to the disc at top-1-i? No, let's think again:
      // First flip exposes the top disc (fromTop=0). reveal[0] = that top disc.
      // Second flip exposes fromTop=1 — reveal[1].
      // So reveal[fromTop] for this stack.
      const disc = reveal[fromTop];
      items.push({ facedown: false, kind: disc });
    } else if (ownFacedown) {
      items.push({ facedown: false, kind: ownFacedown[pos] });
    } else {
      items.push({ facedown: true });
    }
  }

  return (
    <div className="flex flex-col-reverse items-center">
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            marginTop: i === 0 ? 0 : -34,
            zIndex: i,
          }}
        >
          <Disc
            kind={it.kind}
            facedown={it.facedown}
            size={44}
            highlight={highlight && i === items.length - 1}
            dim={dim}
          />
        </div>
      ))}
    </div>
  );
}

// ------------------------- Main board -------------------------

function SkullBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<SkullView, SkullMove>) {
  const playersById = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);

  const isOver = view.phase === "gameOver";
  const iAmOut =
    (view.handCount[me] ?? 0) + (view.stackCount[me] ?? 0) === 0;

  const totalDiscs = useMemo(
    () =>
      totalDiscsOnTable({
        hand: Object.fromEntries(
          view.players.map((id) => {
            const h = view.handCount[id] ?? 0;
            // For math purposes only; total = hand + stack
            return [id, { flowers: h, skulls: 0 }];
          }),
        ),
        stacks: Object.fromEntries(
          view.players.map((id) => [
            id,
            new Array(view.stackCount[id] ?? 0).fill("flower"),
          ]),
        ) as Record<string, DiscKind[]>,
        players: view.players,
      }),
    [view.handCount, view.stackCount, view.players],
  );

  const myHand = view.myHand;
  const myStack = view.myStack;

  const nameOf = (id: string) => playersById[id]?.name ?? id;
  const currentName = nameOf(view.current);

  // Build per-player flip arrays for the currently-in-progress challenge.
  const perStackFlips = useMemo(() => {
    const out: Record<string, DiscKind[]> = {};
    for (const id of view.players) out[id] = [];
    for (const f of view.flipped ?? []) out[f.owner]!.push(f.disc);
    return out;
  }, [view.flipped, view.players]);

  const [bidInput, setBidInput] = useState<number>(1);

  const minBid = (view.currentBid?.count ?? 0) + 1;
  const effectiveMinBid = view.currentBid ? minBid : 1;
  const currentBidCount = Math.max(effectiveMinBid, bidInput);

  const placeFlower = async () => {
    if (!isMyTurn || view.phase !== "placing" || !myHand) return;
    if (myHand.flowers <= 0) return;
    await sendMove({ kind: "place", disc: "flower" });
  };
  const placeSkull = async () => {
    if (!isMyTurn || view.phase !== "placing" || !myHand) return;
    if (myHand.skulls <= 0) return;
    await sendMove({ kind: "place", disc: "skull" });
  };
  const openBid = async () => {
    if (!isMyTurn || view.phase !== "placing") return;
    const c = Math.max(1, Math.min(totalDiscs, currentBidCount));
    await sendMove({ kind: "bid", count: c });
  };
  const raiseBid = async () => {
    if (!isMyTurn || view.phase !== "bidding") return;
    const c = Math.max(effectiveMinBid, Math.min(totalDiscs, currentBidCount));
    await sendMove({ kind: "bid", count: c });
  };
  const passBid = async () => {
    if (!isMyTurn || view.phase !== "bidding") return;
    await sendMove({ kind: "pass" });
  };
  const flipStack = async (target: string) => {
    if (view.phase !== "flipping" || view.challenger !== me) return;
    await sendMove({ kind: "flip", target });
  };
  const startNextRound = async () => {
    if (view.phase !== "roundOver") return;
    if (view.nextStarter !== me) return;
    await sendMove({ kind: "startNextRound" });
  };

  const ownFlipsRemaining =
    view.phase === "flipping" && view.challenger === me
      ? (view.stackCount[me] ?? 0) - (view.flippedFromStack[me] ?? 0)
      : 0;

  const opponentCards = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
      {view.players
        .filter((id) => id !== me)
        .map((id) => {
            const p = playersById[id] ?? { id, name: id };
            const stackLen = view.stackCount[id] ?? 0;
            const handCount = view.handCount[id] ?? 0;
            const out = stackLen + handCount === 0;
            const canFlip =
              view.phase === "flipping" &&
              view.challenger === me &&
              ownFlipsRemaining === 0 &&
              stackLen > (view.flippedFromStack[id] ?? 0);
            const isTurnHere =
              view.current === id &&
              view.phase !== "gameOver" &&
              view.phase !== "roundOver";
            return (
              <div
                key={id}
                className={[
                  "rounded-xl p-3 border flex flex-col gap-2 items-center",
                  "transition-colors",
                  out
                    ? "border-base-300/40 bg-base-200/30 text-base-content/40"
                    : isTurnHere
                      ? "border-primary/55 bg-primary/10"
                      : "border-base-300/70 bg-base-100",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span
                    className={[
                      "text-sm font-semibold truncate max-w-[160px]",
                      isTurnHere ? "text-primary" : "",
                    ].join(" ")}
                  >
                    {p.name}
                  </span>
                  {view.passed.includes(id) && view.phase === "bidding" && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-base-content/45">
                      passed
                    </span>
                  )}
                  {out && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-error/70">
                      out
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <Stack
                      stackLen={stackLen}
                      flippedFromTop={view.flippedFromStack[id] ?? 0}
                      reveal={perStackFlips[id] ?? []}
                      highlight={canFlip}
                      dim={out}
                    />
                    <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/50">
                      {stackLen} stacked
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: handCount }).map((_, i) => (
                        <Disc key={i} facedown size={22} />
                      ))}
                      {handCount === 0 && (
                        <span className="text-[10px] text-base-content/35 italic">
                          empty
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/50">
                      {handCount} in hand
                    </span>
                  </div>
                </div>
                {canFlip && (
                  <button
                    type="button"
                    onClick={() => flipStack(id)}
                    className="btn btn-primary btn-sm rounded-full px-4 font-semibold"
                  >
                    Flip top
                  </button>
                )}
              </div>
            );
          })}
    </div>
  );

  const myPanel = !iAmOut && (
    <div
      className="w-full rounded-2xl p-4 flex flex-col gap-3 items-center"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 70%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.15), inset 0 -1px 0 oklch(0% 0 0 / 0.15)",
      }}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/60">
        <span className="inline-block h-2 w-2 rounded-full bg-primary/70" />
        You — only you see what's in your hand &amp; stack
      </div>

      <div className="flex items-center gap-6 flex-wrap justify-center">
        <div className="flex flex-col items-center gap-1">
          <Stack
            stackLen={view.stackCount[me] ?? 0}
            flippedFromTop={view.flippedFromStack[me] ?? 0}
            reveal={perStackFlips[me] ?? []}
            ownFacedown={myStack}
          />
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Your stack — {view.stackCount[me] ?? 0}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            {myHand &&
              Array.from({ length: myHand.flowers }).map((_, i) => (
                <Disc key={`f${i}`} facedown={false} kind="flower" size={32} />
              ))}
            {myHand &&
              Array.from({ length: myHand.skulls }).map((_, i) => (
                <Disc key={`s${i}`} facedown={false} kind="skull" size={32} />
              ))}
            {(!myHand || myHand.flowers + myHand.skulls === 0) && (
              <span className="text-xs italic text-base-content/50">
                empty hand
              </span>
            )}
          </div>
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Your hand
          </span>
        </div>
      </div>
    </div>
  );

  const actionsPanel = (
    <div className="flex flex-col items-center gap-3 w-full">
      {!iAmOut && view.phase === "placing" && isMyTurn && (
        <PlaceActions
          onFlower={placeFlower}
          onSkull={placeSkull}
          canFlower={(myHand?.flowers ?? 0) > 0}
          canSkull={(myHand?.skulls ?? 0) > 0}
          canBid={(view.stackCount[me] ?? 0) > 0}
          onOpenBid={openBid}
          bidValue={currentBidCount}
          setBidValue={(v) => setBidInput(Math.max(1, v))}
          maxBid={totalDiscs}
          minBid={1}
        />
      )}
      {!iAmOut && view.phase === "bidding" && isMyTurn && (
        <BidActions
          onRaise={raiseBid}
          onPass={passBid}
          bidValue={currentBidCount}
          setBidValue={(v) => setBidInput(Math.max(1, v))}
          minBid={effectiveMinBid}
          maxBid={totalDiscs}
        />
      )}
      {!iAmOut && view.phase === "flipping" && view.challenger === me && (
        <FlippingHint
          ownRemaining={ownFlipsRemaining}
          bid={view.currentBid?.count ?? 0}
          flipsMade={view.flipped?.length ?? 0}
          onFlipOwn={() => flipStack(me)}
        />
      )}
      {iAmOut && !isOver && (
        <div className="text-sm text-base-content/55 italic text-center">
          You're out. Spectate to the finish.
        </div>
      )}
      {!isMyTurn && !iAmOut && view.phase !== "roundOver" && view.phase !== "gameOver" && (
        <div className="text-xs text-base-content/55 text-center italic">
          Waiting on{" "}
          <span className="font-semibold text-base-content/80">{currentName}</span>…
        </div>
      )}
    </div>
  );

  return (
    <HandActionLayout
      opponents={
        <div className="flex flex-col items-center gap-3 w-full">
          <Scoreboard view={view} playersById={playersById} me={me} />
          <StatusBanner
            view={view}
            iAmOut={iAmOut}
            isMyTurn={isMyTurn}
            currentName={currentName}
            me={me}
            playersById={playersById}
          />
          {opponentCards}
        </div>
      }
      hand={myPanel || <div />}
      actions={actionsPanel}
      splitRatio={[55, 45]}
      history={
        (view.phase === "roundOver" || isOver) && view.lastResult ? (
          <RoundOverPanel
            result={view.lastResult}
            playersById={playersById}
            iAmStarter={view.nextStarter === me}
            isOver={isOver}
            winnerName={view.winner ? nameOf(view.winner) : null}
            onNext={startNextRound}
          />
        ) : undefined
      }
      containerMaxWidth={1300}
    />
  );
}

// ------------------------- Scoreboard -------------------------

function Scoreboard({
  view,
  playersById,
  me,
}: {
  view: SkullView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-3xl">
      {view.players.map((id) => {
        const p = playersById[id] ?? { id, name: id };
        const pts = view.points[id] ?? 0;
        const handCount = view.handCount[id] ?? 0;
        const stackLen = view.stackCount[id] ?? 0;
        const out = handCount + stackLen === 0;
        const active =
          view.current === id &&
          view.phase !== "gameOver" &&
          view.phase !== "roundOver";
        const isMe = id === me;
        return (
          <div
            key={id}
            className={[
              "rounded-xl px-3 py-2 flex flex-col items-center gap-1 min-w-[108px]",
              "border transition-colors",
              out
                ? "border-base-300/50 bg-base-200/40 text-base-content/40"
                : active
                  ? "border-primary/55 bg-primary/10"
                  : "border-base-300/80 bg-base-100",
            ].join(" ")}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={[
                  "text-xs font-semibold truncate max-w-[110px]",
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
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: POINTS_TO_WIN }).map((_, i) => {
                const on = i < pts;
                return (
                  <span
                    key={i}
                    className="rounded-sm"
                    style={{
                      width: 9,
                      height: 9,
                      background: on
                        ? "var(--color-success)"
                        : "color-mix(in oklch, var(--color-base-300) 90%, transparent)",
                    }}
                  />
                );
              })}
            </div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-base-content/50 tabular">
              {out ? "out" : `${pts}/${POINTS_TO_WIN} points`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------- Status line -------------------------

function StatusBanner({
  view,
  iAmOut,
  isMyTurn,
  currentName,
  me,
  playersById,
}: {
  view: SkullView;
  iAmOut: boolean;
  isMyTurn: boolean;
  currentName: string;
  me: string;
  playersById: Record<string, { id: string; name: string }>;
}) {
  if (view.phase === "gameOver" && view.winner) {
    const winnerName =
      playersById[view.winner]?.name ?? view.winner ?? "Someone";
    return (
      <div className="text-sm text-base-content/80">
        <span className="font-semibold text-success">{winnerName}</span> has
        called enough bluffs.
      </div>
    );
  }
  if (view.phase === "roundOver") {
    const starter = view.nextStarter;
    const name = starter ? playersById[starter]?.name ?? starter : "";
    return (
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        {view.nextStarter === me
          ? "You lead the next round"
          : `Waiting on ${name} to start the next round`}
      </div>
    );
  }
  if (view.phase === "flipping") {
    const challenger = view.challenger
      ? playersById[view.challenger]?.name ?? view.challenger
      : "";
    return (
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        <span className="text-warning">◆ Challenge ◆</span> {challenger} is
        flipping — {view.currentBid?.count ?? 0} to go clean
      </div>
    );
  }
  if (view.phase === "bidding") {
    return (
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        Bidding —{" "}
        {isMyTurn ? (
          <span className="text-primary font-bold">your call</span>
        ) : (
          <>
            waiting on{" "}
            <span className="text-base-content font-bold">{currentName}</span>
          </>
        )}
      </div>
    );
  }
  if (iAmOut) {
    return (
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        Spectating
      </div>
    );
  }
  return (
    <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
      {isMyTurn ? (
        <span className="text-primary font-bold">Place a disc or bid</span>
      ) : (
        <>
          Waiting on{" "}
          <span className="text-base-content font-bold">{currentName}</span>
        </>
      )}
    </div>
  );
}

// ------------------------- Place / bid action rows -------------------------

function PlaceActions({
  onFlower,
  onSkull,
  canFlower,
  canSkull,
  canBid,
  onOpenBid,
  bidValue,
  setBidValue,
  minBid,
  maxBid,
}: {
  onFlower: () => void;
  onSkull: () => void;
  canFlower: boolean;
  canSkull: boolean;
  canBid: boolean;
  onOpenBid: () => void;
  bidValue: number;
  setBidValue: (n: number) => void;
  minBid: number;
  maxBid: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          disabled={!canFlower}
          onClick={onFlower}
          className="btn btn-primary rounded-full px-4 font-semibold"
        >
          Place flower
        </button>
        <button
          type="button"
          disabled={!canSkull}
          onClick={onSkull}
          className="btn btn-error rounded-full px-4 font-semibold"
        >
          Place skull
        </button>
      </div>
      {canBid && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
            or open a bid
          </span>
          <BidStepper
            value={bidValue}
            setValue={setBidValue}
            minBid={minBid}
            maxBid={maxBid}
          />
          <button
            type="button"
            className="btn btn-warning rounded-full px-4 font-semibold"
            onClick={onOpenBid}
          >
            Bid {Math.max(minBid, Math.min(maxBid, bidValue))}
          </button>
        </div>
      )}
    </div>
  );
}

function BidActions({
  onRaise,
  onPass,
  bidValue,
  setBidValue,
  minBid,
  maxBid,
}: {
  onRaise: () => void;
  onPass: () => void;
  bidValue: number;
  setBidValue: (n: number) => void;
  minBid: number;
  maxBid: number;
}) {
  const disabled = minBid > maxBid;
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      <BidStepper
        value={bidValue}
        setValue={setBidValue}
        minBid={minBid}
        maxBid={maxBid}
      />
      <button
        type="button"
        onClick={onRaise}
        disabled={disabled}
        className="btn btn-warning rounded-full px-4 font-semibold"
      >
        Raise to {Math.max(minBid, Math.min(maxBid, bidValue))}
      </button>
      <button
        type="button"
        onClick={onPass}
        className="btn btn-ghost rounded-full px-4 font-semibold"
      >
        Pass
      </button>
    </div>
  );
}

function BidStepper({
  value,
  setValue,
  minBid,
  maxBid,
}: {
  value: number;
  setValue: (n: number) => void;
  minBid: number;
  maxBid: number;
}) {
  const v = Math.max(minBid, Math.min(maxBid, value));
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setValue(v - 1)}
        disabled={v <= minBid}
        className="btn btn-circle btn-sm btn-ghost"
        aria-label="decrement"
      >
        −
      </button>
      <span
        className="font-display tracking-tight tabular text-center"
        style={{ fontSize: "var(--text-display-sm)", minWidth: "2ch" }}
      >
        {v}
      </span>
      <button
        type="button"
        onClick={() => setValue(v + 1)}
        disabled={v >= maxBid}
        className="btn btn-circle btn-sm btn-ghost"
        aria-label="increment"
      >
        +
      </button>
    </div>
  );
}

function FlippingHint({
  ownRemaining,
  bid,
  flipsMade,
  onFlipOwn,
}: {
  ownRemaining: number;
  bid: number;
  flipsMade: number;
  onFlipOwn: () => void;
}) {
  if (ownRemaining > 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs text-base-content/65 italic">
          You must flip your own stack first — {ownRemaining} to go
        </div>
        <button
          type="button"
          onClick={onFlipOwn}
          className="btn btn-primary rounded-full px-5 font-semibold"
        >
          Flip your top
        </button>
      </div>
    );
  }
  const remaining = Math.max(0, bid - flipsMade);
  return (
    <div className="text-xs text-base-content/65 italic">
      Pick an opponent's stack to flip — {remaining} more to clear the bid
    </div>
  );
}

// ------------------------- Round over panel -------------------------

function RoundOverPanel({
  result,
  playersById,
  iAmStarter,
  isOver,
  winnerName,
  onNext,
}: {
  result: SkullRoundResult;
  playersById: Record<string, { id: string; name: string }>;
  iAmStarter: boolean;
  isOver: boolean;
  winnerName: string | null;
  onNext: () => void;
}) {
  const challengerName =
    playersById[result.challenger]?.name ?? result.challenger;
  const headline =
    result.outcome === "success"
      ? `${challengerName} flipped ${result.bid} clean — +1 point`
      : `${challengerName} hit a skull — lost a ${result.lostDisc ?? "disc"}`;

  return (
    <div
      className="max-w-3xl w-full rounded-2xl p-5 flex flex-col gap-4 parlor-fade"
      style={{
        background:
          result.outcome === "success"
            ? "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))"
            : "color-mix(in oklch, var(--color-error) 14%, var(--color-base-100))",
        border:
          result.outcome === "success"
            ? "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)"
            : "1px solid color-mix(in oklch, var(--color-error) 40%, transparent)",
      }}
    >
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
          {result.outcome === "success" ? "◆ Clean flip ◆" : "◆ Skull ◆"}
        </div>
        <div
          className="font-display tracking-tight"
          style={{ fontSize: "var(--text-display-sm)" }}
        >
          {headline}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {Object.entries(result.revealed).map(([id, discs]) => (
          <div
            key={id}
            className="flex items-center gap-3 flex-wrap rounded-lg bg-base-100/60 px-3 py-2"
          >
            <div className="min-w-[110px] text-sm font-semibold truncate">
              {playersById[id]?.name ?? id}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {discs.length === 0 ? (
                <span className="text-xs italic text-base-content/50">
                  (none)
                </span>
              ) : (
                discs.map((d, i) => (
                  <Disc key={i} kind={d} facedown={false} size={28} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {isOver ? (
        <div className="text-sm text-base-content/80">
          <span className="font-semibold text-success">
            {winnerName ?? "Someone"}
          </span>{" "}
          wins the table.
        </div>
      ) : iAmStarter ? (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary rounded-full px-5 font-semibold"
            onClick={onNext}
          >
            Start next round
          </button>
        </div>
      ) : (
        <div className="text-xs text-base-content/55 italic">
          Waiting on the next round starter…
        </div>
      )}
    </div>
  );
}

export const skullClientModule: ClientGameModule<
  SkullView,
  SkullMove,
  SkullConfig
> = {
  type: SKULL_TYPE,
  Board: SkullBoard,
};
