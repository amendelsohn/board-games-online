import { useMemo, useState } from "react";
import type {
  BoardProps,
  ClientGameModule,
  SummaryProps,
} from "@bgo/sdk-client";
import {
  CARDS,
  GUARD_GUESS_RANKS,
  LOVE_LETTER_TYPE,
  type GuardGuessRank,
  type LogEntry,
  type LoveLetterConfig,
  type LoveLetterMove,
  type LoveLetterView,
  type Rank,
} from "./shared";

type PlayerMap = Record<string, { id: string; name: string }>;

function rankColor(rank: Rank): string {
  // Give each card a slightly different accent so rich-info decks look varied.
  switch (rank) {
    case 1:
      return "var(--color-info)";
    case 2:
      return "var(--color-success)";
    case 3:
      return "var(--color-warning)";
    case 4:
      return "var(--color-accent)";
    case 5:
      return "var(--color-secondary)";
    case 6:
      return "var(--color-primary)";
    case 7:
      return "var(--color-neutral)";
    case 8:
      return "var(--color-error)";
  }
}

// ------------------------- Small UI primitives -------------------------

function CardFace({
  rank,
  size = "md",
  dim,
}: {
  rank: Rank;
  size?: "sm" | "md" | "lg";
  dim?: boolean;
}) {
  const def = CARDS[rank];
  const dims =
    size === "lg"
      ? "w-32 h-44 md:w-36 md:h-48 text-3xl"
      : size === "sm"
        ? "w-14 h-20 text-lg"
        : "w-24 h-32 text-2xl";
  return (
    <div
      className={[
        "relative rounded-xl flex flex-col items-center justify-between p-2.5",
        dims,
        dim ? "opacity-60" : "",
      ].join(" ")}
      style={{
        background: `linear-gradient(160deg, color-mix(in oklch, ${rankColor(
          rank,
        )} 18%, var(--color-base-100)) 0%, var(--color-base-100) 100%)`,
        border: `1.5px solid color-mix(in oklch, ${rankColor(rank)} 45%, transparent)`,
        boxShadow: dim
          ? "none"
          : "inset 0 1px 0 oklch(100% 0 0 / 0.2), 0 4px 12px oklch(0% 0 0 / 0.12)",
      }}
    >
      <div
        className="text-[9px] uppercase tracking-[0.22em] font-semibold self-start"
        style={{ color: rankColor(rank) }}
      >
        {def.rank}
      </div>
      <div
        className="font-display tracking-tight text-center leading-none"
        style={{
          color: rankColor(rank),
          fontSize: size === "lg" ? "1.75rem" : size === "sm" ? "0.875rem" : "1.25rem",
        }}
      >
        {def.name}
      </div>
      <div
        className="text-[9px] uppercase tracking-[0.22em] font-semibold self-end"
        style={{ color: rankColor(rank) }}
      >
        {def.rank}
      </div>
    </div>
  );
}

function CardBack({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const dims =
    size === "lg"
      ? "w-32 h-44 md:w-36 md:h-48"
      : size === "sm"
        ? "w-14 h-20"
        : "w-24 h-32";
  return (
    <div
      className={[
        "rounded-xl",
        dims,
      ].join(" ")}
      style={{
        background:
          "repeating-linear-gradient(135deg, color-mix(in oklch, var(--color-primary) 32%, var(--color-base-300)) 0 6px, color-mix(in oklch, var(--color-secondary) 26%, var(--color-base-300)) 6px 12px)",
        border: "1.5px solid color-mix(in oklch, var(--color-primary) 40%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.15), 0 2px 6px oklch(0% 0 0 / 0.2)",
      }}
    />
  );
}

// ------------------------- Board -------------------------

function LoveLetterBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<LoveLetterView, LoveLetterMove>) {
  const playersById: PlayerMap = useMemo(() => {
    const m: PlayerMap = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const myState = view.perPlayer[me];
  const myHand: Rank[] = myState?.hand ?? [];
  const isOver = view.phase === "gameOver";

  // Pending action UI: once you've clicked a card to play, we collect
  // target / guard-guess before dispatching the move.
  const [pending, setPending] = useState<
    | {
        cardIndex: 0 | 1;
        rank: Rank;
        target?: string;
        guess?: GuardGuessRank;
      }
    | null
  >(null);

  // Countess forced-play: computed so the UI can communicate.
  const mustPlayCountess =
    !isOver &&
    isMyTurn &&
    myHand.length === 2 &&
    myHand.includes(7) &&
    (myHand.includes(5) || myHand.includes(6));

  const otherPlayers = view.players.filter((id) => id !== me);

  const needsTarget = (r: Rank) =>
    r === 1 || r === 2 || r === 3 || r === 5 || r === 6;
  const needsGuess = (r: Rank) => r === 1;

  const hasValidOtherTarget = (r: Rank): boolean => {
    if (!needsTarget(r)) return true;
    const candidates = view.players.filter((id) => {
      if (id === me) return r === 5; // Prince allows self
      const v = view.perPlayer[id]!;
      if (v.eliminated) return false;
      if (v.immune) return false;
      return true;
    });
    return candidates.length > 0;
  };

  const canSubmitPending = (): boolean => {
    if (!pending) return false;
    if (needsTarget(pending.rank)) {
      // Guard/Priest/Baron/King may fizzle if no targets exist; allow submit
      // with undefined target in that case.
      if (!hasValidOtherTarget(pending.rank) && pending.rank !== 5) return true;
      if (!pending.target) return false;
    }
    if (needsGuess(pending.rank)) {
      // Guard may fizzle without a target; only require guess if there IS a target
      if (pending.target && !pending.guess) return false;
    }
    return true;
  };

  const startPlay = (cardIndex: 0 | 1) => {
    if (!isMyTurn || isOver) return;
    const rank = myHand[cardIndex];
    if (rank === undefined) return;

    // Enforce Countess rule client-side.
    if (mustPlayCountess && rank !== 7) return;

    // Fast-path cards with no configuration: Handmaid, Countess, Princess,
    // and effects that fizzle because everyone else is immune/eliminated.
    const needsCfg =
      (needsTarget(rank) && hasValidOtherTarget(rank)) ||
      (needsGuess(rank) && hasValidOtherTarget(rank));

    if (!needsCfg) {
      void sendMove({ kind: "play", cardIndex });
      setPending(null);
      return;
    }
    setPending({ cardIndex, rank });
  };

  const submitPending = async () => {
    if (!pending || !canSubmitPending()) return;
    const move: LoveLetterMove = {
      kind: "play",
      cardIndex: pending.cardIndex,
      ...(pending.target ? { target: pending.target } : {}),
      ...(pending.guess ? { guardGuess: pending.guess } : {}),
    };
    await sendMove(move);
    setPending(null);
  };

  const cancelPending = () => setPending(null);

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      <TopRibbon view={view} playersById={playersById} me={me} />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4">
        <div className="flex flex-col gap-4">
          <OpponentsRow
            view={view}
            me={me}
            playersById={playersById}
            targetable={
              pending && needsTarget(pending.rank)
                ? view.players.filter((id) => {
                    if (id === me) return pending.rank === 5;
                    const v = view.perPlayer[id]!;
                    if (v.eliminated) return false;
                    if (v.immune) return false;
                    return true;
                  })
                : null
            }
            onPickTarget={(id) =>
              setPending((p) => (p ? { ...p, target: id } : p))
            }
            selectedTarget={pending?.target ?? null}
          />

          {view.revealed.length > 0 && (
            <RevealedStrip revealed={view.revealed} />
          )}

          <YourHand
            hand={myHand}
            isMyTurn={isMyTurn}
            isOver={isOver}
            mustPlayCountess={mustPlayCountess}
            onPlay={startPlay}
            pending={pending}
          />

          {pending && (
            <PendingPanel
              pending={pending}
              setGuess={(g) => setPending((p) => (p ? { ...p, guess: g } : p))}
              hasValidOtherTarget={hasValidOtherTarget(pending.rank)}
              canSubmit={canSubmitPending()}
              submit={submitPending}
              cancel={cancelPending}
            />
          )}
        </div>

        <LogPanel
          log={view.log}
          playersById={playersById}
          me={me}
        />
      </div>
    </div>
  );
}

// ------------------------- Sub-components -------------------------

function TopRibbon({
  view,
  playersById,
  me,
}: {
  view: LoveLetterView;
  playersById: PlayerMap;
  me: string;
}) {
  const currentName =
    playersById[view.current]?.name ?? view.current;
  const isMine = view.current === me;
  if (view.phase === "gameOver") {
    return (
      <div
        className="rounded-2xl px-5 py-3 text-center"
        style={{
          background: "color-mix(in oklch, var(--color-primary) 18%, var(--color-base-100))",
          border: "1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)",
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary">
          ◆ Hand complete ◆
        </div>
        <div
          className="font-display tracking-tight text-primary mt-0.5"
          style={{ fontSize: "var(--text-display-sm)" }}
        >
          {view.isDraw
            ? "The hand was a draw."
            : `${playersById[view.winner ?? ""]?.name ?? "?"} wins the hand.`}
        </div>
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 55%, var(--color-base-100))",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Current turn
      </div>
      <div
        className={[
          "font-display tracking-tight",
          isMine ? "text-primary" : "text-base-content",
        ].join(" ")}
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        {isMine ? "Your move" : currentName}
      </div>
      <div className="ml-auto flex items-center gap-3 text-xs text-base-content/65 tabular">
        <div>
          Deck <span className="font-semibold">{view.deckCount}</span>
        </div>
      </div>
    </div>
  );
}

function OpponentsRow({
  view,
  me,
  playersById,
  targetable,
  onPickTarget,
  selectedTarget,
}: {
  view: LoveLetterView;
  me: string;
  playersById: PlayerMap;
  targetable: string[] | null;
  onPickTarget: (id: string) => void;
  selectedTarget: string | null;
}) {
  return (
    <div className="flex gap-3 flex-wrap">
      {view.players
        .filter((id) => id !== me)
        .map((id) => {
          const pv = view.perPlayer[id]!;
          const name = playersById[id]?.name ?? id;
          const canPick = targetable?.includes(id) ?? false;
          const isPicked = selectedTarget === id;
          const isCurrent = view.current === id && view.phase !== "gameOver";
          return (
            <button
              type="button"
              key={id}
              disabled={!canPick}
              onClick={() => onPickTarget(id)}
              className={[
                "flex flex-col items-center gap-2 rounded-xl px-3 py-3 min-w-[120px]",
                "transition-all",
                canPick
                  ? "cursor-pointer hover:ring-2 hover:ring-primary"
                  : "cursor-default",
                isPicked ? "ring-2 ring-primary" : "",
                pv.eliminated ? "opacity-50 grayscale" : "",
              ].join(" ")}
              style={{
                background:
                  "color-mix(in oklch, var(--color-base-300) 40%, var(--color-base-100))",
                border: isCurrent
                  ? "1.5px solid var(--color-primary)"
                  : "1.5px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)",
              }}
            >
              {pv.hand && pv.hand.length > 0 ? (
                <CardFace rank={pv.hand[0]!} size="sm" dim={pv.eliminated} />
              ) : pv.handCount > 0 ? (
                <CardBack size="sm" />
              ) : (
                <div
                  className="w-14 h-20 rounded-xl flex items-center justify-center text-xs uppercase tracking-[0.18em] text-base-content/45 font-semibold"
                  style={{
                    border:
                      "1.5px dashed color-mix(in oklch, var(--color-base-content) 22%, transparent)",
                  }}
                >
                  out
                </div>
              )}
              <div className="text-sm font-semibold truncate max-w-[110px]">
                {name}
              </div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold">
                {pv.eliminated && (
                  <span className="text-error">eliminated</span>
                )}
                {!pv.eliminated && pv.immune && (
                  <span className="text-accent">immune</span>
                )}
                {!pv.eliminated && !pv.immune && (
                  <span className="text-base-content/50">
                    {pv.handCount} card{pv.handCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
    </div>
  );
}

function RevealedStrip({ revealed }: { revealed: Rank[] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Revealed (out)
      </div>
      <div className="flex gap-1.5">
        {revealed.map((r, i) => (
          <div
            key={i}
            className="px-2 py-1 rounded-md text-xs font-semibold"
            style={{
              background: `color-mix(in oklch, ${rankColor(r)} 25%, var(--color-base-100))`,
              border: `1px solid color-mix(in oklch, ${rankColor(r)} 55%, transparent)`,
              color: rankColor(r),
            }}
          >
            {r} · {CARDS[r].name}
          </div>
        ))}
      </div>
    </div>
  );
}

function YourHand({
  hand,
  isMyTurn,
  isOver,
  mustPlayCountess,
  onPlay,
  pending,
}: {
  hand: Rank[];
  isMyTurn: boolean;
  isOver: boolean;
  mustPlayCountess: boolean;
  onPlay: (i: 0 | 1) => void;
  pending: { cardIndex: 0 | 1 } | null;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 25%, var(--color-base-100))",
      }}
    >
      <div className="flex items-baseline gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
          Your hand
        </div>
        {mustPlayCountess && (
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-warning">
            Countess must be played
          </div>
        )}
        {!isMyTurn && !isOver && (
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/45">
            Waiting for your turn
          </div>
        )}
      </div>
      <div className="flex gap-3 flex-wrap">
        {hand.length === 0 && (
          <div className="text-sm text-base-content/55 italic">
            You are out of the hand.
          </div>
        )}
        {hand.map((r, i) => {
          const cardIndex = i as 0 | 1;
          const canPlay =
            isMyTurn &&
            !isOver &&
            !pending &&
            (!mustPlayCountess || r === 7);
          const isPending = pending?.cardIndex === cardIndex;
          return (
            <button
              type="button"
              key={i}
              disabled={!canPlay}
              onClick={() => onPlay(cardIndex)}
              className={[
                "transition-transform rounded-xl",
                canPlay ? "hover:-translate-y-1 cursor-pointer" : "",
                isPending ? "ring-2 ring-primary -translate-y-1" : "",
                !canPlay && !isPending ? "opacity-60" : "",
              ].join(" ")}
            >
              <CardFace rank={r} size="lg" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PendingPanel({
  pending,
  setGuess,
  hasValidOtherTarget,
  canSubmit,
  submit,
  cancel,
}: {
  pending: {
    cardIndex: 0 | 1;
    rank: Rank;
    target?: string;
    guess?: GuardGuessRank;
  };
  setGuess: (g: GuardGuessRank) => void;
  hasValidOtherTarget: boolean;
  canSubmit: boolean;
  submit: () => void;
  cancel: () => void;
}) {
  const def = CARDS[pending.rank];
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-primary) 12%, var(--color-base-100))",
        border: "1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-primary">
        ◆ Playing {def.name} ({def.rank})
      </div>
      <div className="text-sm text-base-content/75">{def.effect}</div>

      {!hasValidOtherTarget && pending.rank !== 5 && (
        <div className="text-sm text-base-content/65 italic">
          Every other player is out or immune. This card has no effect.
        </div>
      )}

      {hasValidOtherTarget &&
        (pending.rank === 1 ||
          pending.rank === 2 ||
          pending.rank === 3 ||
          pending.rank === 6) && (
          <div className="text-xs text-base-content/65">
            Pick a target above.
          </div>
        )}

      {pending.rank === 5 && (
        <div className="text-xs text-base-content/65">
          Pick any player above — including yourself.
        </div>
      )}

      {pending.rank === 1 && pending.target && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Guess their card
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GUARD_GUESS_RANKS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setGuess(r)}
                className={[
                  "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                  pending.guess === r
                    ? "text-primary-content"
                    : "text-base-content hover:bg-base-200",
                ].join(" ")}
                style={
                  pending.guess === r
                    ? {
                        background: rankColor(r),
                        boxShadow: "inset 0 -1px 0 oklch(0% 0 0 / 0.2)",
                      }
                    : {
                        border: `1px solid color-mix(in oklch, ${rankColor(r)} 35%, transparent)`,
                      }
                }
              >
                {r} · {CARDS[r].name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary rounded-full px-5 font-semibold"
          disabled={!canSubmit}
          onClick={submit}
        >
          Play {def.name}
        </button>
        <button
          type="button"
          className="btn btn-ghost rounded-full px-4"
          onClick={cancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function LogPanel({
  log,
  playersById,
  me,
}: {
  log: LogEntry[];
  playersById: PlayerMap;
  me: string;
}) {
  const nameOf = (id: string) => playersById[id]?.name ?? id;
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2 min-h-[240px] max-h-[520px] overflow-y-auto"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-200) 65%, var(--color-base-100))",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 sticky top-0 bg-inherit pb-1">
        History
      </div>
      {log.length === 0 && (
        <div className="text-xs text-base-content/50 italic">
          Play hasn't started yet.
        </div>
      )}
      <ul className="flex flex-col gap-1.5 text-xs leading-relaxed">
        {log.map((entry, i) => (
          <li key={i} className="text-base-content/80">
            {renderLogEntry(entry, nameOf, me)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderLogEntry(
  e: LogEntry,
  nameOf: (id: string) => string,
  me: string,
): React.ReactNode {
  if (e.kind === "play") {
    const card = CARDS[e.card];
    const target = e.target ? ` → ${nameOf(e.target)}` : "";
    const guessPart =
      e.card === 1 && e.guess
        ? ` guessed ${CARDS[e.guess].name} (${e.guessCorrect ? "hit" : "miss"})`
        : "";
    const fizzle = e.fizzled ? " — no legal target, fizzled" : "";
    return (
      <span>
        <strong className="text-base-content">{nameOf(e.actor)}</strong> played{" "}
        <span style={{ color: rankColor(e.card) }} className="font-semibold">
          {card.name}
        </span>
        {target}
        {guessPart}
        {fizzle}
      </span>
    );
  }
  if (e.kind === "priestReveal") {
    if (e.revealedCard !== null) {
      if (e.looker === me) {
        return (
          <span className="italic">
            You saw <strong>{nameOf(e.target)}</strong>'s hand:{" "}
            <span style={{ color: rankColor(e.revealedCard) }}>
              {CARDS[e.revealedCard].name}
            </span>
          </span>
        );
      }
      if (e.target === me) {
        return (
          <span className="italic">
            <strong>{nameOf(e.looker)}</strong> saw your{" "}
            <span style={{ color: rankColor(e.revealedCard) }}>
              {CARDS[e.revealedCard].name}
            </span>
          </span>
        );
      }
    }
    return (
      <span className="italic text-base-content/55">
        <strong>{nameOf(e.looker)}</strong> secretly looked at{" "}
        <strong>{nameOf(e.target)}</strong>'s hand
      </span>
    );
  }
  if (e.kind === "baronReveal") {
    if (e.actorCard !== null && e.targetCard !== null) {
      // Participant view.
      const parts =
        e.loser === null
          ? " — tied, no elimination"
          : ` — ${nameOf(e.loser)} is out`;
      return (
        <span className="italic">
          <strong>{nameOf(e.actor)}</strong> (
          <span style={{ color: rankColor(e.actorCard) }}>
            {CARDS[e.actorCard].name}
          </span>
          ) vs <strong>{nameOf(e.target)}</strong> (
          <span style={{ color: rankColor(e.targetCard) }}>
            {CARDS[e.targetCard].name}
          </span>
          ){parts}
        </span>
      );
    }
    const outcome =
      e.loser === null
        ? "tied"
        : `${nameOf(e.loser)} was knocked out`;
    return (
      <span className="italic text-base-content/55">
        <strong>{nameOf(e.actor)}</strong> vs <strong>{nameOf(e.target)}</strong>{" "}
        Baron duel — {outcome}
      </span>
    );
  }
  if (e.kind === "eliminated") {
    return (
      <span>
        <strong>{nameOf(e.player)}</strong> is eliminated (held{" "}
        <span style={{ color: rankColor(e.card) }}>{CARDS[e.card].name}</span>)
      </span>
    );
  }
  if (e.kind === "swap") {
    return (
      <span>
        <strong>{nameOf(e.actor)}</strong> swapped hands with{" "}
        <strong>{nameOf(e.target)}</strong>
      </span>
    );
  }
  if (e.kind === "princeDiscard") {
    const from = e.drewFromBurned ? " (from the face-down card)" : "";
    return (
      <span>
        <strong>{nameOf(e.target)}</strong> discarded{" "}
        <span style={{ color: rankColor(e.discarded) }}>
          {CARDS[e.discarded].name}
        </span>{" "}
        and drew fresh{from}
      </span>
    );
  }
  if (e.kind === "handmaidImmune") {
    return (
      <span className="text-accent">
        <strong>{nameOf(e.actor)}</strong> is immune until their next turn
      </span>
    );
  }
  if (e.kind === "finalReveal") {
    const entries = Object.entries(e.hands);
    return (
      <span>
        Deck exhausted — remaining hands revealed:{" "}
        {entries
          .map(([id, r]) => `${nameOf(id)} ${CARDS[r as Rank].name}`)
          .join(", ")}
      </span>
    );
  }
  return null;
}

function LoveLetterSummary({ view }: SummaryProps<LoveLetterView>) {
  if (view.phase !== "gameOver") return null;
  return (
    <div className="surface-ivory max-w-xl mx-auto px-6 py-5 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary mb-1">
        ◆ Result ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        {view.isDraw
          ? "Draw"
          : view.winner
            ? "The last heart stands."
            : "Draw"}
      </div>
      {view.burned !== null && (
        <div className="text-sm text-base-content/65 mt-2">
          Burned card was{" "}
          <span className="font-semibold" style={{ color: rankColor(view.burned) }}>
            {CARDS[view.burned].name}
          </span>
        </div>
      )}
    </div>
  );
}

export const loveLetterClientModule: ClientGameModule<
  LoveLetterView,
  LoveLetterMove,
  LoveLetterConfig
> = {
  type: LOVE_LETTER_TYPE,
  Board: LoveLetterBoard,
  Summary: LoveLetterSummary,
};
