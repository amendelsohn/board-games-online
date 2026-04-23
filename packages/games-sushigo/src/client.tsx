import { useMemo, useState } from "react";
import {
  Card as CardShell,
  type BoardProps,
  type CardSize,
  type ClientGameModule,
} from "@bgo/sdk-client";
import {
  SUSHIGO_TYPE,
  isNigiri,
  makiCount,
  nigiriBaseValue,
  type Card,
  type CardKind,
  type SushiConfig,
  type SushiMove,
  type SushiView,
} from "./shared";

// ------------------------- Card visuals -------------------------

const KIND_LABEL: Record<CardKind, string> = {
  tempura: "Tempura",
  sashimi: "Sashimi",
  dumpling: "Dumpling",
  maki1: "Maki 1",
  maki2: "Maki 2",
  maki3: "Maki 3",
  "nigiri-egg": "Egg Nigiri",
  "nigiri-salmon": "Salmon Nigiri",
  "nigiri-squid": "Squid Nigiri",
  wasabi: "Wasabi",
  chopsticks: "Chopsticks",
  pudding: "Pudding",
};

const KIND_TINT: Record<CardKind, { fill: string; ink: string }> = {
  tempura: {
    fill: "color-mix(in oklch, var(--color-warning) 70%, white)",
    ink: "oklch(28% 0.05 70)",
  },
  sashimi: {
    fill: "color-mix(in oklch, var(--color-error) 65%, white)",
    ink: "oklch(28% 0.06 25)",
  },
  dumpling: {
    fill: "color-mix(in oklch, var(--color-warning) 50%, var(--color-base-100))",
    ink: "oklch(28% 0.04 80)",
  },
  maki1: {
    fill: "color-mix(in oklch, var(--color-success) 60%, white)",
    ink: "oklch(22% 0.05 145)",
  },
  maki2: {
    fill: "color-mix(in oklch, var(--color-success) 70%, white)",
    ink: "oklch(22% 0.05 145)",
  },
  maki3: {
    fill: "color-mix(in oklch, var(--color-success) 80%, black)",
    ink: "oklch(96% 0.02 145)",
  },
  "nigiri-egg": {
    fill: "color-mix(in oklch, var(--color-warning) 80%, white)",
    ink: "oklch(28% 0.05 80)",
  },
  "nigiri-salmon": {
    fill: "color-mix(in oklch, var(--color-error) 50%, white)",
    ink: "oklch(28% 0.06 25)",
  },
  "nigiri-squid": {
    fill: "color-mix(in oklch, var(--color-info) 55%, white)",
    ink: "oklch(28% 0.05 240)",
  },
  wasabi: {
    fill: "color-mix(in oklch, var(--color-success) 75%, black)",
    ink: "oklch(96% 0.02 145)",
  },
  chopsticks: {
    fill: "color-mix(in oklch, var(--color-neutral) 30%, var(--color-base-100))",
    ink: "var(--color-base-content)",
  },
  pudding: {
    fill: "color-mix(in oklch, var(--color-secondary) 65%, white)",
    ink: "oklch(28% 0.06 320)",
  },
};

function CardGlyph({ kind }: { kind: CardKind }) {
  // Tiny pictogram per card. SVGs kept compact; meaning > literal art.
  const stroke = "color-mix(in oklch, var(--color-base-content) 65%, transparent)";
  if (kind === "tempura") {
    return (
      <svg viewBox="0 0 24 24" width="34" height="34">
        <path
          d="M5 18 Q12 8 19 18 Z"
          fill="oklch(80% 0.14 75)"
          stroke={stroke}
          strokeWidth="1"
        />
        <line x1="6" y1="14" x2="9" y2="11" stroke={stroke} />
        <line x1="11" y1="13" x2="14" y2="10" stroke={stroke} />
        <line x1="15" y1="14" x2="17" y2="12" stroke={stroke} />
      </svg>
    );
  }
  if (kind === "sashimi") {
    return (
      <svg viewBox="0 0 24 24" width="34" height="34">
        <ellipse
          cx="12"
          cy="13"
          rx="8"
          ry="4"
          fill="oklch(70% 0.14 25)"
          stroke={stroke}
          strokeWidth="1"
        />
        <line x1="6" y1="13" x2="18" y2="13" stroke="oklch(95% 0.02 25)" strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === "dumpling") {
    return (
      <svg viewBox="0 0 24 24" width="34" height="34">
        <path
          d="M5 16 Q5 8 12 8 Q19 8 19 16 Q12 18 5 16 Z"
          fill="oklch(85% 0.05 80)"
          stroke={stroke}
          strokeWidth="1"
        />
        <path d="M8 12 Q12 14 16 12" stroke={stroke} strokeWidth="0.8" fill="none" />
        <path d="M9 14 Q12 15 15 14" stroke={stroke} strokeWidth="0.8" fill="none" />
      </svg>
    );
  }
  if (kind === "maki1" || kind === "maki2" || kind === "maki3") {
    const n = makiCount(kind);
    return (
      <svg viewBox="0 0 24 24" width="34" height="34">
        {Array.from({ length: n }).map((_, i) => (
          <g key={i} transform={`translate(${i * 5},0)`}>
            <circle cx="6" cy="12" r="4" fill="oklch(94% 0.02 80)" stroke={stroke} />
            <circle cx="6" cy="12" r="2.4" fill="oklch(40% 0.1 145)" />
            <circle cx="6" cy="12" r="1.1" fill="oklch(94% 0.02 80)" />
          </g>
        ))}
      </svg>
    );
  }
  if (isNigiri(kind)) {
    const fishColor =
      kind === "nigiri-egg"
        ? "oklch(88% 0.13 90)"
        : kind === "nigiri-salmon"
          ? "oklch(72% 0.14 30)"
          : "oklch(60% 0.06 250)";
    return (
      <svg viewBox="0 0 24 24" width="34" height="34">
        <ellipse
          cx="12"
          cy="14"
          rx="8"
          ry="3"
          fill="oklch(96% 0.01 80)"
          stroke={stroke}
        />
        <ellipse
          cx="12"
          cy="11"
          rx="8"
          ry="2.6"
          fill={fishColor}
          stroke={stroke}
          strokeWidth="0.6"
        />
        <line x1="6" y1="11" x2="18" y2="11" stroke="oklch(95% 0.04 80)" strokeWidth="0.6" />
      </svg>
    );
  }
  if (kind === "wasabi") {
    return (
      <svg viewBox="0 0 24 24" width="34" height="34">
        <ellipse
          cx="12"
          cy="14"
          rx="8"
          ry="3"
          fill="oklch(96% 0.01 80)"
          stroke={stroke}
        />
        <path
          d="M8 11 Q12 7 16 11 Q15 14 12 13 Q9 14 8 11 Z"
          fill="oklch(50% 0.13 145)"
          stroke={stroke}
          strokeWidth="0.6"
        />
      </svg>
    );
  }
  if (kind === "chopsticks") {
    return (
      <svg viewBox="0 0 24 24" width="34" height="34">
        <line x1="5" y1="20" x2="20" y2="5" stroke="oklch(50% 0.05 60)" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="7" y1="20" x2="22" y2="5" stroke="oklch(50% 0.05 60)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "pudding") {
    return (
      <svg viewBox="0 0 24 24" width="34" height="34">
        <path
          d="M6 16 L8 8 L16 8 L18 16 Z"
          fill="oklch(80% 0.1 60)"
          stroke={stroke}
        />
        <ellipse cx="12" cy="8" rx="4" ry="1.2" fill="oklch(60% 0.16 30)" />
      </svg>
    );
  }
  return null;
}

/**
 * Card face: tinted background, glyph centered, label at top + rotated at
 * bottom, optional bonus chip. Layout fills the parent (CardShell sets size).
 */
function SushiGoFace({ card, bonus }: { card: Card; bonus?: string }) {
  const t = KIND_TINT[card.kind];
  return (
    <div
      className="absolute inset-0 flex flex-col items-stretch text-left p-1.5 gap-1"
      style={{ background: t.fill, color: t.ink }}
    >
      <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-wider opacity-85 leading-none">
        <span className="truncate">{KIND_LABEL[card.kind]}</span>
        {bonus && (
          <span
            className="rounded px-1 py-[1px] font-display whitespace-nowrap shrink-0"
            style={{
              background: "color-mix(in oklch, white 35%, transparent)",
              color: t.ink,
              fontSize: "8px",
            }}
          >
            {bonus}
          </span>
        )}
      </div>
      <div className="grow flex items-center justify-center min-h-0">
        <CardGlyph kind={card.kind} />
      </div>
      <div
        className="text-[7px] font-bold uppercase tracking-[0.18em] opacity-70 self-end leading-none"
        style={{ transform: "rotate(180deg)" }}
      >
        {KIND_LABEL[card.kind]}
      </div>
    </div>
  );
}

function CardFace({
  card,
  size = "lg",
  selectable,
  selected,
  secondarySelected,
  onClick,
  bonus,
}: {
  card: Card;
  size?: CardSize;
  selectable?: boolean;
  selected?: boolean;
  secondarySelected?: boolean;
  onClick?: () => void;
  bonus?: string;
}) {
  return (
    <CardShell
      size={size}
      onClick={selectable ? onClick : undefined}
      selected={selected}
      highlight={secondarySelected ? "warning" : "primary"}
      disabled={selectable === false}
      ariaLabel={KIND_LABEL[card.kind]}
    >
      <SushiGoFace card={card} bonus={bonus} />
      {secondarySelected && !selected && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-[7px]"
          style={{ boxShadow: "inset 0 0 0 2px var(--color-warning)" }}
        />
      )}
    </CardShell>
  );
}

function bonusText(c: Card, view: SushiView): string | undefined {
  if (isNigiri(c.kind)) {
    const base = nigiriBaseValue(c.kind);
    return view.iHaveWasabiPending ? `+${base * 3} (Wasabi)` : `+${base}`;
  }
  if (c.kind === "tempura") return "5 / pair";
  if (c.kind === "sashimi") return "10 / trio";
  if (c.kind === "dumpling") return "1·3·6·10·15";
  if (c.kind === "maki1") return "1 ribbon";
  if (c.kind === "maki2") return "2 ribbons";
  if (c.kind === "maki3") return "3 ribbons";
  if (c.kind === "wasabi") return "x3 next nigiri";
  if (c.kind === "chopsticks") return "swap next turn";
  if (c.kind === "pudding") return "endgame: ±6";
  return undefined;
}

// ------------------------- Board -------------------------

function SushiBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<SushiView, SushiMove>) {
  const playersById = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);

  const isOver = view.phase === "gameOver";
  const myHand = view.myHand ?? [];
  const iPicked = view.iHavePicked;

  const [primary, setPrimary] = useState<string | null>(null);
  const [secondary, setSecondary] = useState<string | null>(null);

  // Reset selection when hand changes (new round / new pass).
  useMemo(() => {
    setPrimary(null);
    setSecondary(null);
  }, [myHand.map((c) => c.id).join("|")]);

  const useChopsticks = view.iCanUseChopsticks && !iPicked;

  const submit = () => {
    if (iPicked || !primary) return;
    if (useChopsticks && secondary) {
      sendMove({
        kind: "pick",
        cardId: primary,
        secondCardId: secondary,
      });
    } else {
      sendMove({ kind: "pick", cardId: primary });
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-6xl">
      <Header view={view} playersById={playersById} />

      {/* Tableaus */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
        {view.players.map((id) => (
          <Tableau
            key={id}
            id={id}
            view={view}
            playersById={playersById}
            isMe={id === me}
          />
        ))}
      </div>

      {/* Hand */}
      {!isOver && (
        <div className="w-full rounded-2xl p-4 flex flex-col gap-3 items-center"
          style={{
            background:
              "color-mix(in oklch, var(--color-base-300) 70%, transparent)",
            boxShadow:
              "inset 0 1px 0 oklch(100% 0 0 / 0.15), inset 0 -1px 0 oklch(0% 0 0 / 0.15)",
          }}
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/60">
            <span className="inline-block h-2 w-2 rounded-full bg-primary/70" />
            Your hand — round {view.round}, {myHand.length} card{myHand.length === 1 ? "" : "s"}
            {iPicked && (
              <span className="ml-2 text-success">✓ locked in</span>
            )}
          </div>
          {myHand.length === 0 ? (
            <div className="text-sm italic text-base-content/55 py-3">
              empty — waiting on next deal
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap justify-center">
              {myHand.map((c) => {
                const isPrim = primary === c.id;
                const isSec = secondary === c.id;
                return (
                  <CardFace
                    key={c.id}
                    card={c}
                    selectable={!iPicked && isMyTurn}
                    selected={isPrim}
                    secondarySelected={isSec}
                    bonus={bonusText(c, view)}
                    onClick={() => {
                      if (iPicked) return;
                      if (!isMyTurn) return;
                      if (isPrim) {
                        setPrimary(null);
                        return;
                      }
                      if (isSec) {
                        setSecondary(null);
                        return;
                      }
                      if (primary === null) {
                        setPrimary(c.id);
                      } else if (useChopsticks && secondary === null) {
                        setSecondary(c.id);
                      } else {
                        // Replace primary
                        setPrimary(c.id);
                        setSecondary(null);
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
          {!iPicked && (
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {useChopsticks && (
                <span className="text-[10px] uppercase tracking-[0.22em] text-warning font-semibold">
                  Chopsticks ready — pick a 2nd card to use
                </span>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!primary || !isMyTurn}
                className="btn btn-primary rounded-full px-5 font-semibold"
              >
                {useChopsticks && secondary
                  ? "Lock in 2 cards"
                  : "Lock in pick"}
              </button>
            </div>
          )}
          {iPicked && (
            <div className="text-xs text-base-content/55 italic">
              Waiting on others to pick…
            </div>
          )}
        </div>
      )}

      {/* End of round / game */}
      {view.lastRoundResult &&
        (view.phase === "gameOver" || view.phase === "scoring") && (
          <RoundResultPanel
            view={view}
            playersById={playersById}
          />
        )}
    </div>
  );
}

function Header({
  view,
  playersById,
}: {
  view: SushiView;
  playersById: Record<string, { id: string; name: string }>;
}) {
  void playersById;
  return (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-base-content/60 font-semibold">
      <span>Round {Math.min(view.round, 3)}/3</span>
      <span>·</span>
      <span>
        Phase: {view.phase === "pick" ? "pick & pass" : view.phase}
      </span>
    </div>
  );
}

function Tableau({
  id,
  view,
  playersById,
  isMe,
}: {
  id: string;
  view: SushiView;
  playersById: Record<string, { id: string; name: string }>;
  isMe: boolean;
}) {
  const p = playersById[id] ?? { id, name: id };
  const seat = view.seats[id];
  const played = seat?.played ?? [];
  const score = seat?.score ?? 0;
  const puddings = seat?.puddings ?? 0;
  const handSize = seat?.handSize ?? 0;
  const hasPicked = seat?.hasPicked ?? false;

  return (
    <div
      className={[
        "rounded-xl p-3 border flex flex-col gap-2",
        isMe ? "border-primary/40 bg-primary/5" : "border-base-300/70 bg-base-100",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold truncate max-w-[160px]">
          {p.name}
        </span>
        {isMe && (
          <span className="text-[9px] uppercase tracking-[0.18em] text-base-content/50">
            you
          </span>
        )}
        {hasPicked && view.phase === "pick" && (
          <span className="text-[9px] uppercase tracking-[0.18em] text-success">
            ✓ picked
          </span>
        )}
        <span className="ml-auto text-xs tabular text-base-content/65">
          {handSize} in hand · 🍮 {puddings}
        </span>
        <span className="font-display text-base-content/85" style={{ fontSize: "var(--text-display-sm)" }}>
          {score}
        </span>
      </div>
      {played.length === 0 ? (
        <div className="text-xs italic text-base-content/40 py-2 text-center">
          no cards played yet
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {played.map((c, i) => (
            <CardFace
              key={c.id + i}
              card={c}
              size="md"
              bonus={undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundResultPanel({
  view,
  playersById,
}: {
  view: SushiView;
  playersById: Record<string, { id: string; name: string }>;
}) {
  const r = view.lastRoundResult!;
  const isOver = view.phase === "gameOver";
  const winners = view.winners ?? [];
  return (
    <div
      className="max-w-4xl w-full rounded-2xl p-5 flex flex-col gap-3 parlor-fade"
      style={{
        background: isOver
          ? "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))"
          : "color-mix(in oklch, var(--color-info) 12%, var(--color-base-100))",
        border: isOver
          ? "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)"
          : "1px solid color-mix(in oklch, var(--color-info) 40%, transparent)",
      }}
    >
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
          {isOver ? "◆ Final scores ◆" : `◆ Round ${r.round} scores ◆`}
        </div>
        {isOver && (
          <div
            className="font-display tracking-tight"
            style={{ fontSize: "var(--text-display-sm)" }}
          >
            {winners
              .map((id) => playersById[id]?.name ?? id)
              .join(" & ")}{" "}
            wins
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead className="text-base-content/55 uppercase tracking-[0.16em] text-[9px]">
            <tr>
              <th className="text-left py-1">Player</th>
              <th className="text-right">Tempura</th>
              <th className="text-right">Sashimi</th>
              <th className="text-right">Dumpling</th>
              <th className="text-right">Maki</th>
              <th className="text-right">Nigiri</th>
              <th className="text-right">Round</th>
              {isOver && <th className="text-right">🍮</th>}
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {view.players.map((id) => {
              const b = r.breakdown[id];
              const total = view.finalScores
                ? view.finalScores[id] ?? 0
                : view.seats[id]?.score ?? 0;
              const pud = isOver ? r.puddingTotal?.[id] ?? 0 : null;
              return (
                <tr key={id} className="border-t border-base-300/40">
                  <td className="py-1 font-semibold">
                    {playersById[id]?.name ?? id}
                  </td>
                  <td className="text-right tabular">{b?.tempura ?? 0}</td>
                  <td className="text-right tabular">{b?.sashimi ?? 0}</td>
                  <td className="text-right tabular">{b?.dumpling ?? 0}</td>
                  <td className="text-right tabular">{b?.maki ?? 0}</td>
                  <td className="text-right tabular">{b?.nigiri ?? 0}</td>
                  <td className="text-right tabular">{b?.total ?? 0}</td>
                  {isOver && (
                    <td className="text-right tabular">{pud}</td>
                  )}
                  <td
                    className={[
                      "text-right tabular font-display",
                      winners.includes(id) ? "text-success" : "",
                    ].join(" ")}
                    style={{ fontSize: "var(--text-display-xs)" }}
                  >
                    {total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const sushiGoClientModule: ClientGameModule<
  SushiView,
  SushiMove,
  SushiConfig
> = {
  type: SUSHIGO_TYPE,
  Board: SushiBoard,
};
