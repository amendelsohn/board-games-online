"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameCategoryWire, GameMetaWire } from "@bgo/contracts";
import { api } from "@/lib/apiClient";
import { ensurePlayer, getStoredName, storeName } from "@/lib/playerSession";
import { GameIcon } from "@/components/GameIcon";

export default function Home() {
  const router = useRouter();
  const [games, setGames] = useState<GameMetaWire[] | null>(null);
  const [name, setName] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listGames()
      .then((r) => setGames(r.games))
      .catch((err) => setError((err as Error).message));
    setName(getStoredName() ?? "");
  }, []);

  const saveName = async (n: string) => {
    storeName(n);
    try {
      await api.updateMe({ name: n });
    } catch {
      // no session yet — will be set on first createPlayer
    }
  };

  const startNewGame = async (gameType: string) => {
    setError(null);
    setPending(`create:${gameType}`);
    try {
      const playerName = name.trim() || getStoredName() || undefined;
      await ensurePlayer(playerName);
      if (playerName) await saveName(playerName);
      const { table } = await api.createTable({ gameType });
      router.push(`/lobby/${table.joinCode}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(null);
    }
  };

  const joinExisting = async () => {
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) {
      setError("Join code must be 4 letters (e.g. ABCD).");
      return;
    }
    setPending("join");
    try {
      const playerName = name.trim() || getStoredName() || undefined;
      await ensurePlayer(playerName);
      if (playerName) await saveName(playerName);
      const { table } = await api.joinTable(code);
      router.push(`/lobby/${table.joinCode}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 pt-10 md:pt-16 pb-20 flex flex-col gap-20 md:gap-24">
      {/* ============ Hero ============ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
        <div className="lg:col-span-7 flex flex-col gap-6 parlor-rise">
          <div className="rule-ornament" style={{ justifyContent: "flex-start" }}>
            <span>◆ Parlor No. 01</span>
            <span className="rule-ornament-line" />
          </div>
          <h1
            className="font-display leading-[0.98] tracking-tight"
            style={{ fontSize: "var(--text-display-lg)" }}
          >
            A quiet corner of the internet
            <span className="text-primary"> to play </span>
            with friends.
          </h1>
          <p className="text-base md:text-lg text-base-content/70 max-w-[54ch] leading-relaxed">
            Pick a game. Share a four-letter code. Everyone's in, in seconds.
            No signups, no clutter, no distractions — just an unhurried room for
            whatever you feel like playing tonight.
          </p>
        </div>

        {/* Identity + join card: inset panel with two subtle fields */}
        <div className="lg:col-span-5 flex flex-col gap-4 parlor-rise" style={{ animationDelay: "120ms" }}>
          <div className="surface-ivory p-5 md:p-6 flex flex-col gap-5">
            <Field label="Your name" htmlFor="name-input">
              <input
                id="name-input"
                type="text"
                placeholder="How should others see you?"
                className="w-full bg-transparent border-0 outline-none font-display text-xl placeholder:text-base-content/30 placeholder:font-sans placeholder:text-base"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && saveName(name.trim())}
                maxLength={40}
              />
            </Field>
            <div className="h-px bg-base-300/70" />
            <Field label="Have a code?" htmlFor="code-input">
              <div className="flex items-center gap-2">
                <input
                  id="code-input"
                  type="text"
                  placeholder="ABCD"
                  className={[
                    "w-full bg-transparent border-0 outline-none",
                    "font-mono uppercase tracking-[0.4em] text-2xl",
                    "placeholder:text-base-content/25",
                    "tabular",
                  ].join(" ")}
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void joinExisting();
                  }}
                  maxLength={4}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-full px-4 font-semibold tracking-wide"
                  onClick={joinExisting}
                  disabled={pending !== null}
                >
                  {pending === "join" ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    "Join →"
                  )}
                </button>
              </div>
            </Field>
          </div>
          <p className="text-xs text-base-content/50 text-center">
            Your name saves to this device — no account needed.
          </p>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="-mt-8 border border-error/40 bg-error/10 text-error px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      {/* ============ Catalog ============ */}
      <section className="flex flex-col gap-12 md:gap-16">
        {/* Kicker + lede = tight title block */}
        <div className="flex flex-col gap-4 md:gap-5">
          <div className="rule-ornament">
            <span className="rule-ornament-line" />
            <span>◆ Tonight's games ◆</span>
            <span className="rule-ornament-line" />
          </div>
          <div className="flex items-baseline justify-between gap-6 flex-wrap">
            <h2
              className="font-display tracking-tight leading-[1.02]"
              style={{ fontSize: "var(--text-display-sm)" }}
            >
              The tables are set.
            </h2>
            {games && games.length > 0 && (
              <span className="font-mono text-[11px] tabular uppercase tracking-[0.22em] text-base-content/45 whitespace-nowrap">
                {games.length} games · 4 categories
              </span>
            )}
          </div>
        </div>

        {games === null ? (
          <CatalogSkeleton />
        ) : games.length === 0 ? (
          <div className="surface-felt p-6 text-center text-base-content/70">
            No games installed on this server yet.
          </div>
        ) : (
          <CatalogByCategory
            games={games}
            pending={pending}
            onStart={startNewGame}
          />
        )}
      </section>

      {/* ============ How it works ============ */}
      <section className="flex flex-col gap-6">
        <div className="rule-ornament">
          <span className="rule-ornament-line" />
          <span>◆ How it works ◆</span>
          <span className="rule-ornament-line" />
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
          <Step n="I" title="Pick a game">
            Choose from the catalog above. Each game runs in its own module, so
            more can be added without changing anything else.
          </Step>
          <Step n="II" title="Share the code">
            You'll get a four-letter code. Send it over whatever you already use
            — no accounts to create, no app to install.
          </Step>
          <Step n="III" title="Play in real-time">
            Every move syncs instantly over WebSockets. Play from laptop, phone,
            or tablet — your seat follows you between devices.
          </Step>
        </ol>
      </section>
    </div>
  );
}

/* -------------------------- Catalog grouping -------------------------- */

const CATEGORY_ORDER: GameCategoryWire[] = [
  "classic",
  "strategy",
  "cards-dice",
  "party",
];

const CATEGORY_LABEL: Record<GameCategoryWire, string> = {
  classic: "Classics",
  strategy: "Strategy",
  "cards-dice": "Cards & Dice",
  party: "Party & Bluffing",
};

const CATEGORY_BLURB: Record<GameCategoryWire, string> = {
  classic: "Quick, timeless games for two.",
  strategy: "Heavier thinking — boards worth studying.",
  "cards-dice": "Cards and dice, a little luck, a little skill.",
  party: "Group games with hidden roles, words, and bluffs.",
};

function categoryPlayerRange(games: GameMetaWire[]): string {
  const min = Math.min(...games.map((g) => g.minPlayers));
  const max = Math.max(...games.map((g) => g.maxPlayers));
  if (min === max) return `${min} players`;
  return `${min}–${max} players`;
}

function CatalogByCategory({
  games,
  pending,
  onStart,
}: {
  games: GameMetaWire[];
  pending: string | null;
  onStart: (gameType: string) => void;
}) {
  const grouped = new Map<GameCategoryWire, GameMetaWire[]>();
  for (const g of games) {
    const bucket = grouped.get(g.category) ?? [];
    bucket.push(g);
    grouped.set(g.category, bucket);
  }
  const sections = CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => ({
    category: c,
    games: grouped.get(c)!,
  }));

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      {sections.map(({ category, games: gs }, sectionIdx) => (
        <article
          key={category}
          className="flex flex-col gap-5 md:gap-6 parlor-rise"
          style={{ animationDelay: `${sectionIdx * 90}ms` }}
        >
          <header className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <h3
                className="font-display tracking-tight leading-[1.02]"
                style={{ fontSize: "clamp(1.75rem, 2vw + 1rem, 2.5rem)" }}
              >
                {CATEGORY_LABEL[category]}
              </h3>
              <span className="font-mono text-[11px] tabular uppercase tracking-[0.22em] text-base-content/45 whitespace-nowrap">
                {gs.length} {gs.length === 1 ? "game" : "games"}
                <span className="mx-1.5 text-base-content/25">·</span>
                {categoryPlayerRange(gs)}
              </span>
            </div>
            <p className="text-sm md:text-[0.95rem] text-base-content/60 leading-relaxed max-w-[52ch]">
              {CATEGORY_BLURB[category]}
            </p>
          </header>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {gs.map((g, i) => (
              <li
                key={g.type}
                className="parlor-rise rise-stagger"
                style={{ ["--i" as string]: i }}
              >
                <GameCard
                  game={g}
                  pending={pending === `create:${g.type}`}
                  disabled={pending !== null}
                  onStart={() => onStart(g.type)}
                />
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

/* -------------------------- Subcomponents -------------------------- */

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[10px] font-semibold uppercase tracking-[0.22em] text-base-content/55"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function GameCard({
  game,
  pending,
  disabled,
  onStart,
}: {
  game: GameMetaWire;
  pending: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className={[
        "group block w-full text-left",
        "surface-ivory",
        "px-5 py-5",
        "transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "disabled:opacity-60 disabled:pointer-events-none",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <GameIcon type={game.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-xl md:text-2xl tracking-tight">
              {game.displayName}
            </h3>
            <span className="text-xs tabular text-base-content/50 shrink-0">
              {game.minPlayers === game.maxPlayers
                ? `${game.minPlayers} pl`
                : `${game.minPlayers}–${game.maxPlayers} pl`}
            </span>
          </div>
          <p className="mt-1 text-sm text-base-content/65 leading-relaxed">
            {game.description}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-base-content/45">
              {pending ? "Opening…" : "Open a table"}
            </span>
            <span
              aria-hidden
              className="text-primary font-semibold text-sm transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function CatalogSkeleton() {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="surface-ivory p-5 h-[9.5rem] relative overflow-hidden"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in oklch, var(--color-base-content) 6%, transparent), transparent)",
              backgroundSize: "200% 100%",
              animation: "parlorShimmer 1.8s infinite linear",
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="font-display text-primary text-3xl md:text-4xl leading-none tabular mt-0.5"
      >
        {n}.
      </span>
      <div className="flex-1">
        <h3 className="font-display text-xl tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm text-base-content/65 leading-relaxed">
          {children}
        </p>
      </div>
    </li>
  );
}
