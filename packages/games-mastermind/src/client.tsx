import { useEffect, useMemo, useState } from "react";
import type { BoardProps, ClientGameModule, SummaryProps } from "@bgo/sdk-client";
import {
  CODE_LENGTH,
  COLORS,
  MASTERMIND_TYPE,
  MAX_GUESSES,
  type Color,
  type GuessRecord,
  type MastermindMove,
  type MastermindView,
} from "./shared";

/**
 * Explicit OKLCH palette — six hues from opposite sides of the color wheel
 * so they stay distinct in both parlor-day and parlor-night themes. Semantic
 * vars (error/warning/accent/…) collide in Parlor where multiple slots land
 * in the red/orange/amber range.
 */
const COLOR_HEX: Record<Color, { fill: string; ink: string }> = {
  R: { fill: "oklch(62% 0.22 28)",  ink: "oklch(98% 0.02 28)"  },
  O: { fill: "oklch(72% 0.16 58)",  ink: "oklch(20% 0.06 58)"  },
  Y: { fill: "oklch(82% 0.17 96)",  ink: "oklch(20% 0.08 96)"  },
  G: { fill: "oklch(60% 0.15 150)", ink: "oklch(98% 0.02 150)" },
  B: { fill: "oklch(58% 0.14 245)", ink: "oklch(98% 0.02 245)" },
  V: { fill: "oklch(50% 0.22 300)", ink: "oklch(98% 0.02 300)" },
};

const COLOR_NAME: Record<Color, string> = {
  R: "Red",
  O: "Orange",
  Y: "Yellow",
  G: "Green",
  B: "Blue",
  V: "Violet",
};

function Peg({
  color,
  size = "md",
  empty = false,
  onClick,
  selected = false,
  highlighted = false,
  ariaLabel,
}: {
  color?: Color;
  size?: "sm" | "md" | "lg";
  empty?: boolean;
  onClick?: () => void;
  selected?: boolean;
  highlighted?: boolean;
  ariaLabel?: string;
}) {
  const dim =
    size === "lg" ? "h-8 w-8" : size === "sm" ? "h-3.5 w-3.5" : "h-6 w-6";
  const hasColor = !!color && !empty;
  const bg = hasColor
    ? COLOR_HEX[color!].fill
    : "color-mix(in oklch, var(--color-base-content) 12%, transparent)";
  const letterSize = size === "sm" ? 7 : size === "lg" ? 12 : 9;
  const className = [
    "relative rounded-full inline-flex items-center justify-center",
    dim,
    onClick ? "cursor-pointer transition-transform hover:scale-110" : "",
    selected ? "ring-2 ring-offset-2 ring-offset-base-100 ring-base-content" : "",
    highlighted && !selected ? "ring-2 ring-base-content/30 scale-[1.04]" : "",
  ].join(" ");
  const style: React.CSSProperties = {
    background: bg,
    boxShadow: !hasColor
      ? "inset 0 1px 1px oklch(0% 0 0 / 0.18)"
      : "inset 0 2px 3px oklch(100% 0 0 / 0.35), inset 0 -2px 3px oklch(0% 0 0 / 0.3), 0 1px 2px oklch(0% 0 0 / 0.25)",
  };
  const body = (
    <>
      {hasColor && size !== "sm" && (
        <span
          className="font-mono font-bold select-none pointer-events-none"
          style={{
            color: COLOR_HEX[color!].ink,
            fontSize: letterSize,
            lineHeight: 1,
          }}
          aria-hidden
        >
          {color}
        </span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        style={style}
        aria-label={ariaLabel}
      >
        {body}
      </button>
    );
  }
  return (
    <span
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {body}
    </span>
  );
}

function FeedbackPegs({ black, white }: { black: number; white: number }) {
  const pegs: ("B" | "W" | null)[] = [];
  for (let i = 0; i < black; i++) pegs.push("B");
  for (let i = 0; i < white; i++) pegs.push("W");
  while (pegs.length < CODE_LENGTH) pegs.push(null);

  const miss = CODE_LENGTH - black - white;
  return (
    <div
      role="group"
      aria-label={`${black} exact match${black === 1 ? "" : "es"}, ${white} color-only, ${miss} miss${miss === 1 ? "" : "es"}`}
      className="grid grid-cols-2 gap-[3px]"
    >
      {pegs.map((p, i) => (
        <span
          key={i}
          className="h-3 w-3 rounded-full inline-block"
          style={{
            background:
              p === "B"
                ? "var(--color-base-content)"
                : p === "W"
                  ? "var(--color-base-100)"
                  : "color-mix(in oklch, var(--color-base-content) 8%, transparent)",
            boxShadow:
              p === null
                ? "inset 0 1px 1px oklch(0% 0 0 / 0.25)"
                : p === "W"
                  ? "inset 0 0 0 1px color-mix(in oklch, var(--color-base-content) 40%, transparent), inset 0 1px 1px oklch(100% 0 0 / 0.6)"
                  : "inset 0 1px 1px oklch(100% 0 0 / 0.2), inset 0 -1px 1px oklch(0% 0 0 / 0.3)",
          }}
        />
      ))}
    </div>
  );
}

function SettingPanel({
  draft,
  setDraft,
  selecting,
  setSelecting,
  onLock,
  locked,
}: {
  draft: (Color | null)[];
  setDraft: (d: (Color | null)[]) => void;
  selecting: number;
  setSelecting: (i: number) => void;
  onLock: () => void;
  locked: boolean;
}) {
  const full = draft.every((c) => c !== null);
  const currentColor = draft[selecting] ?? null;
  return (
    <div className="surface-ivory p-6 flex flex-col gap-4 items-center">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-base-content/55">
        ◆ Set your secret code ◆
      </div>
      <div className="text-sm text-base-content/65 max-w-md text-center">
        Tap a slot, pick a color. Your opponent will try to crack this in
        ten guesses.
      </div>

      <div className="flex items-center gap-3">
        {draft.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => !locked && setSelecting(i)}
            disabled={locked}
            className={[
              "relative h-12 w-12 rounded-full flex items-center justify-center",
              "transition-all",
              selecting === i && !locked
                ? "ring-2 ring-primary ring-offset-2 ring-offset-base-100"
                : "",
              locked ? "cursor-default" : "cursor-pointer hover:scale-105",
            ].join(" ")}
            style={{
              background: c
                ? COLOR_HEX[c].fill
                : "color-mix(in oklch, var(--color-base-content) 10%, transparent)",
              boxShadow: c
                ? "inset 0 3px 5px oklch(100% 0 0 / 0.4), inset 0 -3px 5px oklch(0% 0 0 / 0.3), 0 2px 4px oklch(0% 0 0 / 0.25)"
                : "inset 0 1px 1px oklch(0% 0 0 / 0.18)",
            }}
            aria-label={`slot ${i + 1}${c ? ` (${COLOR_NAME[c]})` : ""}`}
          >
            {c && (
              <span
                className="font-mono font-bold select-none pointer-events-none"
                style={{
                  color: COLOR_HEX[c].ink,
                  fontSize: 16,
                  lineHeight: 1,
                }}
                aria-hidden
              >
                {c}
              </span>
            )}
          </button>
        ))}
      </div>

      {!locked && (
        <div className="flex items-center gap-2 pt-1">
          {COLORS.map((col) => (
            <Peg
              key={col}
              color={col}
              size="lg"
              ariaLabel={COLOR_NAME[col]}
              highlighted={currentColor === col}
              onClick={() => {
                const next = draft.slice();
                next[selecting] = col;
                setDraft(next);
                const nextEmpty = next.findIndex((x, i) => x === null && i !== selecting);
                if (nextEmpty >= 0) setSelecting(nextEmpty);
                else if (selecting < CODE_LENGTH - 1) setSelecting(selecting + 1);
              }}
            />
          ))}
        </div>
      )}

      {!locked ? (
        <button
          type="button"
          className="btn btn-primary rounded-full px-6 font-semibold"
          disabled={!full}
          onClick={onLock}
        >
          Lock code
        </button>
      ) : (
        <div className="text-sm text-base-content/60 italic parlor-fade">
          Waiting for opponent to lock their code…
        </div>
      )}
      <div className="text-[10px] text-base-content/40 uppercase tracking-[0.2em]">
        1–6 to pick · ← → to move · Enter to lock
      </div>
    </div>
  );
}

function GuessRow({
  row,
  feedback,
}: {
  row: (Color | null)[];
  feedback?: { black: number; white: number };
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded-lg">
      <div className="flex items-center gap-1.5">
        {row.map((c, i) => (
          <Peg key={i} color={c ?? undefined} size="md" empty={c === null} />
        ))}
      </div>
      <div className="ml-2">
        {feedback ? (
          <FeedbackPegs black={feedback.black} white={feedback.white} />
        ) : (
          <div className="grid grid-cols-2 gap-[3px] opacity-30">
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-full inline-block"
                style={{
                  background:
                    "color-mix(in oklch, var(--color-base-content) 8%, transparent)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MyBoard({
  guesses,
  draft,
  setDraft,
  selecting,
  setSelecting,
  canSubmit,
  onSubmit,
  cracked,
  exhausted,
}: {
  guesses: GuessRecord[];
  draft: (Color | null)[];
  setDraft: (d: (Color | null)[]) => void;
  selecting: number;
  setSelecting: (i: number) => void;
  canSubmit: boolean;
  onSubmit: () => void;
  cracked: boolean;
  exhausted: boolean;
}) {
  const locked = cracked || exhausted;
  const currentColor = draft[selecting] ?? null;

  return (
    <div className="surface-ivory p-5 flex flex-col gap-2">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 mb-1 font-mono tabular-nums">
        Your attempts ({guesses.length}/{MAX_GUESSES})
      </div>

      <div className="flex flex-col gap-[3px]">
        {Array.from({ length: MAX_GUESSES }).map((_, i) => {
          const g = guesses[i];
          const isNext = !locked && i === guesses.length;
          if (g) {
            return (
              <GuessRow
                key={i}
                row={g.code}
                feedback={g.feedback}
              />
            );
          }
          if (isNext) {
            return (
              <div
                key={i}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 py-1.5 px-2 rounded-lg"
                style={{
                  background:
                    "color-mix(in oklch, var(--color-primary) 8%, transparent)",
                  outline:
                    "1px dashed color-mix(in oklch, var(--color-primary) 45%, transparent)",
                }}
              >
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  {draft.map((c, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelecting(idx)}
                      className={[
                        "relative h-6 w-6 rounded-full flex items-center justify-center",
                        "transition-transform",
                        selecting === idx
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-base-100"
                          : "",
                      ].join(" ")}
                      style={{
                        background: c
                          ? COLOR_HEX[c].fill
                          : "color-mix(in oklch, var(--color-base-content) 10%, transparent)",
                        boxShadow: c
                          ? "inset 0 2px 3px oklch(100% 0 0 / 0.35), inset 0 -2px 3px oklch(0% 0 0 / 0.3), 0 1px 2px oklch(0% 0 0 / 0.25)"
                          : "inset 0 1px 1px oklch(0% 0 0 / 0.18)",
                      }}
                      aria-label={`guess slot ${idx + 1}${c ? ` (${COLOR_NAME[c]})` : ""}`}
                    >
                      {c && (
                        <span
                          className="font-mono font-bold select-none pointer-events-none"
                          style={{
                            color: COLOR_HEX[c].ink,
                            fontSize: 9,
                            lineHeight: 1,
                          }}
                          aria-hidden
                        >
                          {c}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="sm:ml-auto btn btn-primary btn-sm rounded-full px-4 font-semibold w-full sm:w-auto"
                  disabled={!canSubmit}
                  onClick={onSubmit}
                >
                  Guess
                </button>
              </div>
            );
          }
          return (
            <div
              key={i}
              className="flex items-center gap-3 py-1.5 px-2 rounded-lg opacity-40"
            >
              <div className="flex items-center gap-1.5">
                {Array.from({ length: CODE_LENGTH }).map((_, idx) => (
                  <Peg key={idx} size="md" empty />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!locked && (
        <div className="flex items-center gap-2 pt-2 justify-center">
          {COLORS.map((col) => (
            <Peg
              key={col}
              color={col}
              size="md"
              ariaLabel={COLOR_NAME[col]}
              highlighted={currentColor === col}
              onClick={() => {
                const next = draft.slice();
                next[selecting] = col;
                setDraft(next);
                const nextEmpty = next.findIndex((x, i) => x === null && i !== selecting);
                if (nextEmpty >= 0) setSelecting(nextEmpty);
                else if (selecting < CODE_LENGTH - 1) setSelecting(selecting + 1);
              }}
            />
          ))}
        </div>
      )}

      {cracked && (
        <div className="text-sm font-semibold text-success text-center pt-2 parlor-win">
          You cracked it!
        </div>
      )}
      {exhausted && !cracked && (
        <div className="text-sm text-base-content/60 text-center pt-2 italic">
          Out of guesses.
        </div>
      )}
    </div>
  );
}

function OpponentBoard({
  guesses,
  cracked,
  codeSet,
  secret,
  name,
}: {
  guesses: GuessRecord[];
  cracked: boolean;
  codeSet: boolean;
  secret: Color[] | null;
  name: string;
}) {
  return (
    <div className="surface-ivory p-5 flex flex-col gap-2">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 mb-1 flex items-center justify-between font-mono tabular-nums">
        <span>{name} — attempts ({guesses.length}/{MAX_GUESSES})</span>
        {!codeSet && (
          <span className="text-[10px] text-base-content/40 italic normal-case tracking-normal">
            setting code…
          </span>
        )}
      </div>

      {secret && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background:
              "color-mix(in oklch, var(--color-base-content) 8%, transparent)",
          }}
        >
          <span className="text-[10px] uppercase tracking-[0.2em] text-base-content/55 font-semibold">
            Their code
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {secret.map((c, i) => (
              <Peg key={i} color={c} size="md" />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-[3px]">
        {Array.from({ length: MAX_GUESSES }).map((_, i) => {
          const g = guesses[i];
          if (g) {
            return (
              <GuessRow
                key={i}
                row={g.code}
                feedback={g.feedback}
              />
            );
          }
          return (
            <div
              key={i}
              className="flex items-center gap-3 py-1.5 px-2 rounded-lg opacity-30"
            >
              <div className="flex items-center gap-1.5">
                {Array.from({ length: CODE_LENGTH }).map((_, idx) => (
                  <Peg key={idx} size="md" empty />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {cracked && (
        <div className="text-sm font-semibold text-error text-center pt-2">
          They cracked your code.
        </div>
      )}
    </div>
  );
}

function ProgressBarMini({ filled, max }: { filled: number; max: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${filled} of ${max} guesses used`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="h-2 w-1.5 rounded-[1px]"
          style={{
            background:
              i < filled
                ? "var(--color-primary)"
                : "color-mix(in oklch, var(--color-base-content) 12%, transparent)",
            boxShadow:
              i < filled ? "inset 0 -1px 0 oklch(0% 0 0 / 0.2)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Deduction helper — tallies how many times each color has been tried, and
 * at which of the four positions, based purely on the viewer's own past
 * guesses. Pure information scent; no server data required.
 */
function ClueTracker({ guesses }: { guesses: GuessRecord[] }) {
  const stats = useMemo(() => {
    const perColor: Record<Color, { total: number; positions: boolean[] }> = {
      R: { total: 0, positions: Array(CODE_LENGTH).fill(false) },
      O: { total: 0, positions: Array(CODE_LENGTH).fill(false) },
      Y: { total: 0, positions: Array(CODE_LENGTH).fill(false) },
      G: { total: 0, positions: Array(CODE_LENGTH).fill(false) },
      B: { total: 0, positions: Array(CODE_LENGTH).fill(false) },
      V: { total: 0, positions: Array(CODE_LENGTH).fill(false) },
    };
    for (const g of guesses) {
      for (let i = 0; i < g.code.length; i++) {
        const c = g.code[i]!;
        perColor[c].total += 1;
        perColor[c].positions[i] = true;
      }
    }
    return perColor;
  }, [guesses]);

  return (
    <div className="surface-ivory p-4 flex flex-col gap-2">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Clue tracker
      </div>
      <div className="text-[10px] text-base-content/45 normal-case tracking-normal italic">
        Where you've placed each color
      </div>
      <div className="flex flex-col gap-1.5 pt-1">
        {COLORS.map((c) => {
          const s = stats[c];
          return (
            <div key={c} className="flex items-center gap-2">
              <Peg color={c} size="sm" ariaLabel={COLOR_NAME[c]} />
              <span className="text-[11px] font-mono tabular-nums font-semibold w-14 text-base-content/80">
                {s.total}×
              </span>
              <div className="flex items-center gap-0.5" aria-hidden>
                {s.positions.map((tried, i) => (
                  <span
                    key={i}
                    className="h-2.5 w-2.5 rounded-full inline-block"
                    style={{
                      background: tried
                        ? COLOR_HEX[c].fill
                        : "transparent",
                      border: tried
                        ? "none"
                        : `1px solid color-mix(in oklch, ${COLOR_HEX[c].fill} 50%, transparent)`,
                      boxShadow: tried
                        ? "inset 0 -1px 0 oklch(0% 0 0 / 0.2)"
                        : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MastermindBoard({
  view,
  me,
  players,
  sendMove,
}: BoardProps<MastermindView, MastermindMove>) {
  const [settingDraft, setSettingDraft] = useState<(Color | null)[]>(() =>
    Array.from({ length: CODE_LENGTH }).fill(null) as (Color | null)[],
  );
  const [settingSelecting, setSettingSelecting] = useState(0);

  const [guessDraft, setGuessDraft] = useState<(Color | null)[]>(() =>
    Array.from({ length: CODE_LENGTH }).fill(null) as (Color | null)[],
  );
  const [guessSelecting, setGuessSelecting] = useState(0);

  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const opponentId = view.players.find((p) => p !== me) ?? null;
  const opponentName =
    opponentId && playersById[opponentId]
      ? playersById[opponentId]!.name
      : "Opponent";
  const opp = opponentId ? view.opponent[opponentId] : undefined;

  const isOver = view.phase === "gameOver";
  const iHaveSet = view.mySecret !== null;
  const oppHasSet = opp?.codeSet === true;

  const lockCode = async () => {
    if (settingDraft.some((c) => c === null)) return;
    await sendMove({ kind: "setCode", code: settingDraft as Color[] });
  };

  const submitGuess = async () => {
    if (guessDraft.some((c) => c === null)) return;
    await sendMove({ kind: "guess", code: guessDraft as Color[] });
    setGuessDraft(Array.from({ length: CODE_LENGTH }).fill(null) as (Color | null)[]);
    setGuessSelecting(0);
  };

  const iExhausted = view.myGuesses.length >= MAX_GUESSES;
  const canSubmitGuess =
    !isOver &&
    view.phase === "guessing" &&
    !view.iCracked &&
    !iExhausted &&
    guessDraft.every((c) => c !== null);

  // Keyboard shortcuts: 1-6 pick color, arrows move slot, Enter submits,
  // Backspace clears. Only active when the board has focus context
  // (document-level listener; bail if target is an input).
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (isOver) return;

      const isSetting = view.phase === "setting" && !iHaveSet;
      const isGuessing = view.phase === "guessing" && !view.iCracked && !iExhausted;
      if (!isSetting && !isGuessing) return;

      const draft = isSetting ? settingDraft : guessDraft;
      const setDraft = isSetting ? setSettingDraft : setGuessDraft;
      const selecting = isSetting ? settingSelecting : guessSelecting;
      const setSelecting = isSetting ? setSettingSelecting : setGuessSelecting;

      if (ev.key >= "1" && ev.key <= "6") {
        const idx = Number(ev.key) - 1;
        const col = COLORS[idx]!;
        const next = draft.slice();
        next[selecting] = col;
        setDraft(next);
        const nextEmpty = next.findIndex((x, i) => x === null && i !== selecting);
        if (nextEmpty >= 0) setSelecting(nextEmpty);
        else if (selecting < CODE_LENGTH - 1) setSelecting(selecting + 1);
        ev.preventDefault();
        return;
      }
      if (ev.key === "ArrowLeft") {
        setSelecting(Math.max(0, selecting - 1));
        ev.preventDefault();
        return;
      }
      if (ev.key === "ArrowRight") {
        setSelecting(Math.min(CODE_LENGTH - 1, selecting + 1));
        ev.preventDefault();
        return;
      }
      if (ev.key === "Backspace") {
        const next = draft.slice();
        next[selecting] = null;
        setDraft(next);
        ev.preventDefault();
        return;
      }
      if (ev.key === "Enter") {
        if (isSetting && draft.every((c) => c !== null)) {
          lockCode();
          ev.preventDefault();
        } else if (isGuessing && canSubmitGuess) {
          submitGuess();
          ev.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    view.phase,
    iHaveSet,
    view.iCracked,
    iExhausted,
    settingDraft,
    guessDraft,
    settingSelecting,
    guessSelecting,
    isOver,
    canSubmitGuess,
  ]);

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <PhaseBanner view={view} me={me} opponentName={opponentName} />

      {view.phase !== "setting" && (
        <TempoIndicator
          myCount={view.myGuesses.length}
          oppCount={opp?.guesses.length ?? 0}
          opponentName={opponentName}
        />
      )}

      {view.phase === "setting" && !isOver && (
        <SettingPanel
          draft={settingDraft}
          setDraft={setSettingDraft}
          selecting={settingSelecting}
          setSelecting={setSettingSelecting}
          onLock={lockCode}
          locked={iHaveSet}
        />
      )}

      {view.phase !== "setting" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
          <div className="flex flex-col gap-3">
            <MyBoard
              guesses={view.myGuesses}
              draft={guessDraft}
              setDraft={setGuessDraft}
              selecting={guessSelecting}
              setSelecting={setGuessSelecting}
              canSubmit={canSubmitGuess}
              onSubmit={submitGuess}
              cracked={view.iCracked}
              exhausted={iExhausted}
            />
            {!isOver && view.myGuesses.length > 0 && (
              <ClueTracker guesses={view.myGuesses} />
            )}
          </div>
          {opp && opponentId && (
            <OpponentBoard
              guesses={opp.guesses}
              cracked={opp.cracked}
              codeSet={opp.codeSet}
              secret={opp.secret}
              name={opponentName}
            />
          )}
        </div>
      )}

      {view.phase === "setting" && !iHaveSet && (
        <div className="text-xs text-base-content/50 italic">
          {oppHasSet ? "Opponent is ready." : "Both players are choosing codes."}
        </div>
      )}
    </div>
  );
}

function TempoIndicator({
  myCount,
  oppCount,
  opponentName,
}: {
  myCount: number;
  oppCount: number;
  opponentName: string;
}) {
  const iLeadBy = oppCount - myCount;
  const oppLeadBy = myCount - oppCount;
  return (
    <div
      className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-base-content/60 font-mono tabular-nums flex-wrap justify-center"
    >
      <span className={iLeadBy >= 2 ? "text-warning" : undefined}>
        You <span className="font-bold text-base-content">{myCount}</span>/{MAX_GUESSES}
      </span>
      <ProgressBarMini filled={myCount} max={MAX_GUESSES} />
      <span className="text-base-content/30">vs</span>
      <ProgressBarMini filled={oppCount} max={MAX_GUESSES} />
      <span className={oppLeadBy >= 2 ? "text-warning" : undefined}>
        {opponentName}{" "}
        <span className="font-bold text-base-content">{oppCount}</span>/{MAX_GUESSES}
      </span>
    </div>
  );
}

function PhaseBanner({
  view,
  me,
  opponentName,
}: {
  view: MastermindView;
  me: string;
  opponentName: string;
}) {
  let text = "";
  let tone: "neutral" | "primary" | "success" | "error" = "primary";

  if (view.phase === "setting") {
    text = "Phase 1 — Set your secret code";
  } else if (view.phase === "guessing") {
    text = "Phase 2 — Crack the code";
  } else {
    if (view.isDraw) {
      tone = "neutral";
      if (view.iCracked && view.theyCracked) {
        text = "Draw — both cracked on the same guess";
      } else if (!view.iCracked && !view.theyCracked) {
        text = "Draw — neither code was cracked";
      } else {
        text = "Draw";
      }
    } else if (view.winner === me) {
      tone = "success";
      text = "You win!";
    } else if (view.winner) {
      tone = "error";
      text = `${opponentName} wins`;
    }
  }

  // Restrained banner — soft tinted background + colored text, not the
  // shouty solid-fill.
  const { bg, border, fg } =
    tone === "success"
      ? {
          bg: "color-mix(in oklch, var(--color-success) 18%, var(--color-base-100))",
          border: "1px solid color-mix(in oklch, var(--color-success) 45%, transparent)",
          fg: "var(--color-success)",
        }
      : tone === "error"
        ? {
            bg: "color-mix(in oklch, var(--color-error) 18%, var(--color-base-100))",
            border: "1px solid color-mix(in oklch, var(--color-error) 45%, transparent)",
            fg: "var(--color-error)",
          }
        : {
            bg: "var(--color-base-200)",
            border: "1px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)",
            fg: "var(--color-base-content)",
          };

  return (
    <div
      className="px-5 py-2 rounded-full font-display tracking-tight text-base md:text-lg"
      style={{
        background: bg,
        border,
        color: fg,
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.15), inset 0 -1px 0 oklch(0% 0 0 / 0.12)",
      }}
    >
      {text}
    </div>
  );
}

function MastermindSummary({ view }: SummaryProps<MastermindView>) {
  if (view.phase !== "gameOver") return null;

  // Unified render across both seats. We don't receive `players` in summary
  // props, but view.mySecret lets us identify the viewer when present.
  const secrets: Record<string, Color[] | null> = {};
  for (const pid of view.players) {
    secrets[pid] = view.opponent[pid]?.secret ?? null;
  }
  if (view.mySecret) {
    for (const pid of view.players) {
      if (!secrets[pid] && view.opponent[pid] === undefined) {
        secrets[pid] = view.mySecret;
        break;
      }
    }
  }

  return (
    <div className="surface-ivory max-w-xl mx-auto px-6 py-5 text-center flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary">
        ◆ Codes revealed ◆
      </div>
      <div className="flex flex-col gap-2 items-center">
        {view.players.map((pid) => {
          const code = secrets[pid];
          const isViewer = view.mySecret !== null && secrets[pid] === view.mySecret;
          return (
            <div key={pid} className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-[0.2em] text-base-content/55 w-24 text-right font-mono">
                {isViewer ? "You" : `Player ${pid.slice(0, 4)}`}
              </span>
              <div className="flex items-center gap-1.5">
                {code
                  ? code.map((c, i) => <Peg key={i} color={c} size="md" />)
                  : Array.from({ length: CODE_LENGTH }).map((_, i) => (
                      <Peg key={i} size="md" empty />
                    ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const mastermindClientModule: ClientGameModule<
  MastermindView,
  MastermindMove,
  Record<string, never>
> = {
  type: MASTERMIND_TYPE,
  Board: MastermindBoard,
  Summary: MastermindSummary,
};
