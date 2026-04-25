import { useMemo } from "react";
import {
  Card as CardShell,
  HiddenRoleLayout,
  type BoardProps,
  type ClientGameModule,
  type SummaryProps,
} from "@bgo/sdk-client";
import {
  FASCIST_TRACK_WIN,
  LIBERAL_TRACK_WIN,
  SECRET_HITLER_TYPE,
  type SHMove,
  type SHPolicy,
  type SHRole,
  type SHView,
} from "./shared";

type PlayerLike = { id: string; name: string };

function SecretHitlerBoard({
  view,
  me,
  players,
  sendMove,
}: BoardProps<SHView, SHMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, PlayerLike> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const isNomination = view.phase === "nomination";
  const isVote = view.phase === "vote";
  const isPresidentDiscard = view.phase === "presidentDiscard";
  const isChancellorEnact = view.phase === "chancellorEnact";
  const isOver = view.phase === "gameOver";

  const presidentId = view.president ?? view.playerOrder[view.presidentIdx] ?? null;
  const amPresident = me === presidentId;
  const amChancellor = me === view.chancellor;
  const iHaveVoted = view.voteTally.voters.includes(me);

  if (isOver) {
    return (
      <div className="flex flex-col items-center gap-5 w-full max-w-3xl mx-auto">
        <PolicyTracks view={view} />
        <GameOverPanel view={view} playersById={playersById} />
        <PolicyHistoryStrip view={view} />
      </div>
    );
  }

  let phasePanel: React.ReactNode = null;
  if (isNomination) {
    phasePanel = (
      <NominationPanel
        view={view}
        playersById={playersById}
        amPresident={amPresident}
        onNominate={(target) => sendMove({ kind: "nominate", target })}
      />
    );
  } else if (isVote) {
    phasePanel = (
      <VotePanel
        view={view}
        playersById={playersById}
        iHaveVoted={iHaveVoted}
        onVote={(vote) => sendMove({ kind: "vote", vote })}
      />
    );
  } else if (isPresidentDiscard) {
    phasePanel = (
      <PresidentDiscardPanel
        view={view}
        amPresident={amPresident}
        onDiscard={(index) => sendMove({ kind: "presidentDiscard", index })}
      />
    );
  } else if (isChancellorEnact) {
    phasePanel = (
      <ChancellorEnactPanel
        view={view}
        amChancellor={amChancellor}
        onEnact={(index) => sendMove({ kind: "chancellorEnact", index })}
      />
    );
  }

  return (
    <HiddenRoleLayout
      phaseBar={
        <div className="flex flex-col items-center gap-3">
          <PolicyTracks view={view} />
          <RoundBanner view={view} playersById={playersById} me={me} />
        </div>
      }
      privatePanel={<RoleCard view={view} playersById={playersById} />}
      decision={
        <div className="flex flex-col gap-4">
          <PlayerBoard view={view} playersById={playersById} me={me} />
          {phasePanel}
        </div>
      }
      log={<PolicyHistoryStrip view={view} />}
      mainMaxWidth={720}
    />
  );
}

function PolicyTracks({ view }: { view: SHView }) {
  const liberalSlots = Array.from({ length: LIBERAL_TRACK_WIN }, (_, i) => i);
  const fascistSlots = Array.from({ length: FASCIST_TRACK_WIN }, (_, i) => i);
  return (
    <div className="w-full max-w-2xl flex flex-col gap-2">
      <Track
        label="Liberals"
        color="var(--color-info)"
        slots={liberalSlots}
        filled={view.liberalTrack}
        goalLabel={`${view.liberalTrack}/${LIBERAL_TRACK_WIN}`}
      />
      <Track
        label="Fascists"
        color="var(--color-error)"
        slots={fascistSlots}
        filled={view.fascistTrack}
        goalLabel={`${view.fascistTrack}/${FASCIST_TRACK_WIN}`}
      />
      <ElectionTrackerRow tracker={view.electionTracker} />
    </div>
  );
}

function Track({
  label,
  color,
  slots,
  filled,
  goalLabel,
}: {
  label: string;
  color: string;
  slots: number[];
  filled: number;
  goalLabel: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="text-[10px] uppercase tracking-[0.3em] font-semibold w-20 shrink-0"
        style={{ color }}
      >
        {label}
      </div>
      <div className="flex gap-1.5 flex-1">
        {slots.map((i) => {
          const on = i < filled;
          return (
            <div
              key={i}
              className="h-7 flex-1 rounded-md flex items-center justify-center"
              style={{
                background: on
                  ? color
                  : "color-mix(in oklch, var(--color-base-300) 60%, transparent)",
                boxShadow: on
                  ? "inset 0 1px 0 oklch(100% 0 0 / 0.22), inset 0 -2px 0 oklch(0% 0 0 / 0.2)"
                  : "inset 0 0 0 1px color-mix(in oklch, currentColor 12%, transparent)",
                color: on ? "oklch(100% 0 0 / 0.85)" : "transparent",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.2em",
              }}
            >
              {on ? "■" : ""}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-base-content/65 tabular w-14 text-right">
        {goalLabel}
      </div>
    </div>
  );
}

function ElectionTrackerRow({ tracker }: { tracker: number }) {
  return (
    <div className="flex items-center gap-3 mt-1">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold w-20 shrink-0 text-base-content/55">
        Elections
      </div>
      <div className="flex gap-1.5 flex-1">
        {[0, 1, 2].map((i) => {
          const active = i < tracker;
          return (
            <div
              key={i}
              className="h-5 flex-1 rounded-md flex items-center justify-center text-[11px] font-bold"
              style={{
                background: active
                  ? "var(--color-warning)"
                  : "color-mix(in oklch, var(--color-base-300) 60%, transparent)",
                color: active
                  ? "var(--color-warning-content)"
                  : "var(--color-base-content)",
                opacity: active ? 1 : 0.4,
              }}
              title={
                active
                  ? "Failed election"
                  : "No failed election here yet"
              }
            >
              {active ? "☠" : ""}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-base-content/45 w-14 text-right">
        {tracker}/3
      </div>
    </div>
  );
}

function RoleCard({
  view,
  playersById,
}: {
  view: SHView;
  playersById: Record<string, PlayerLike>;
}) {
  const role = view.viewerRole;
  if (!role) {
    return (
      <div className="surface-ivory max-w-md px-4 py-3 text-center text-sm text-base-content/65">
        You are watching — roles are hidden until the game ends.
      </div>
    );
  }
  const isFascist = role === "fascist";
  const isHitler = role === "hitler";
  const label: Record<SHRole, string> = {
    liberal: "Liberal",
    fascist: "Fascist",
    hitler: "Hitler",
  };
  const blurb: Record<SHRole, string> = {
    liberal:
      "You want five Liberal policies enacted. Trust no one; figure out who's who from the votes and the policies they let through.",
    fascist:
      "Drip Fascist policies onto the track. Cover for Hitler — and slip them into the Chancellor's chair once 3 Fascist policies are out.",
    hitler:
      "Survive, blend in, and take the Chancellor's gavel. If you're elected Chancellor after 3 Fascist policies, your team wins.",
  };
  const known = view.knownFascists;
  return (
    <div
      className={[
        "rounded-2xl p-5 flex flex-col gap-2 max-w-xl w-full",
        isFascist || isHitler ? "bg-neutral text-neutral-content" : "surface-ivory",
      ].join(" ")}
      style={{
        boxShadow:
          isFascist || isHitler
            ? "inset 0 1px 0 oklch(100% 0 0 / 0.1), inset 0 -2px 0 oklch(0% 0 0 / 0.3), 0 12px 32px oklch(0% 0 0 / 0.25)"
            : undefined,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.3em] font-semibold"
        style={{
          color:
            isFascist || isHitler
              ? "color-mix(in oklch, currentColor 65%, transparent)"
              : "var(--color-info)",
          opacity: isFascist || isHitler ? 1 : 0.65,
        }}
      >
        {"◆"} Your role {"◆"}
      </div>
      <div
        className="font-display tracking-tight"
        style={{
          fontSize: "var(--text-display-sm)",
          color: isHitler
            ? "var(--color-error)"
            : isFascist
              ? "currentColor"
              : "var(--color-info)",
        }}
      >
        {label[role]}
      </div>
      <div className="text-sm opacity-80 leading-relaxed">{blurb[role]}</div>
      {known && Object.keys(known).length > 0 && (
        <div className="mt-2 pt-2 border-t border-current/15">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold opacity-70 mb-1">
            {isFascist ? "Your team" : "The Fascists"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(known).map(([id, r]) => {
              const name = playersById[id]?.name ?? id;
              return (
                <span
                  key={id}
                  className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background:
                      r === "hitler"
                        ? "var(--color-error)"
                        : "oklch(100% 0 0 / 0.15)",
                    color:
                      r === "hitler"
                        ? "var(--color-error-content)"
                        : "currentColor",
                  }}
                >
                  {name}
                  {r === "hitler" ? " — Hitler" : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}
      {isHitler &&
        !known &&
        view.playerOrder.length >= 7 && (
          <div className="mt-2 pt-2 border-t border-current/15 text-xs opacity-70">
            With {view.playerOrder.length} players you don't know your Fascists. Sit
            tight and blend in.
          </div>
        )}
    </div>
  );
}

function RoundBanner({
  view,
  playersById,
  me,
}: {
  view: SHView;
  playersById: Record<string, PlayerLike>;
  me: string;
}) {
  if (view.phase === "gameOver") return null;
  const presidentId =
    view.president ?? view.playerOrder[view.presidentIdx] ?? null;
  const presidentName = presidentId
    ? playersById[presidentId]?.name ?? presidentId
    : "(none)";
  const chancellorName = view.chancellor
    ? playersById[view.chancellor]?.name ?? view.chancellor
    : null;
  const phaseLabel: Record<Exclude<SHView["phase"], "gameOver">, string> = {
    nomination: "Nominate a Chancellor",
    vote: "Vote Ja or Nein",
    presidentDiscard: "President discards a policy",
    chancellorEnact: "Chancellor enacts a policy",
  };
  return (
    <div className="text-sm text-base-content/70 text-center flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary">
        {phaseLabel[view.phase as Exclude<SHView["phase"], "gameOver">]}
      </div>
      <div>
        President:{" "}
        <span className="font-display tracking-tight text-primary">
          {presidentId === me ? "you" : presidentName}
        </span>
        {chancellorName && (
          <>
            {" · Chancellor: "}
            <span className="font-display tracking-tight text-secondary">
              {view.chancellor === me ? "you" : chancellorName}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function PlayerBoard({
  view,
  playersById,
  me,
}: {
  view: SHView;
  playersById: Record<string, PlayerLike>;
  me: string;
}) {
  const presidentId =
    view.president ?? view.playerOrder[view.presidentIdx] ?? null;
  return (
    <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {view.playerOrder.map((id) => {
        const p = playersById[id] ?? { id, name: id };
        const isPresident = id === presidentId;
        const isChancellor = id === view.chancellor;
        const isLastP = id === view.lastPresident;
        const isLastC = id === view.lastChancellor;
        const isMe = id === me;
        const known = view.knownFascists?.[id];
        const voted = view.voteTally.voters.includes(id);
        const revealed = view.voteTally.results?.[id];
        return (
          <div
            key={id}
            className="relative rounded-xl px-3 py-2 border border-base-300 bg-base-100 flex flex-col gap-1"
            style={{
              boxShadow: isMe
                ? "inset 0 0 0 2px var(--color-primary)"
                : undefined,
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-semibold truncate text-sm flex-1">
                {p.name}
                {isMe && (
                  <span className="text-[9px] uppercase tracking-[0.18em] opacity-55 ml-1">
                    you
                  </span>
                )}
              </span>
              {known === "hitler" && (
                <span
                  className="text-[9px] px-1.5 py-[1px] rounded-full font-bold uppercase tracking-wider"
                  style={{
                    background: "var(--color-error)",
                    color: "var(--color-error-content)",
                  }}
                  title="Hitler"
                >
                  H
                </span>
              )}
              {known === "fascist" && (
                <span
                  className="text-[9px] px-1.5 py-[1px] rounded-full font-bold uppercase tracking-wider"
                  style={{
                    background: "var(--color-neutral)",
                    color: "var(--color-neutral-content)",
                  }}
                  title="Fascist"
                >
                  F
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {isPresident && (
                <span
                  className="text-[9px] px-1.5 py-[1px] rounded font-semibold uppercase tracking-wider"
                  style={{
                    background: "var(--color-primary)",
                    color: "var(--color-primary-content)",
                  }}
                >
                  President
                </span>
              )}
              {isChancellor && (
                <span
                  className="text-[9px] px-1.5 py-[1px] rounded font-semibold uppercase tracking-wider"
                  style={{
                    background: "var(--color-secondary)",
                    color: "var(--color-secondary-content)",
                  }}
                >
                  Chancellor
                </span>
              )}
              {!isPresident && isLastP && (
                <span
                  className="text-[9px] px-1.5 py-[1px] rounded uppercase tracking-wider opacity-65"
                  style={{
                    border: "1px solid var(--color-primary)",
                    color: "var(--color-primary)",
                  }}
                  title="Previous President — not eligible as Chancellor"
                >
                  Prev P
                </span>
              )}
              {!isChancellor && isLastC && (
                <span
                  className="text-[9px] px-1.5 py-[1px] rounded uppercase tracking-wider opacity-65"
                  style={{
                    border: "1px solid var(--color-secondary)",
                    color: "var(--color-secondary)",
                  }}
                  title="Previous Chancellor — not eligible again"
                >
                  Prev C
                </span>
              )}
            </div>
            {view.phase === "vote" && (
              <div className="text-[10px] opacity-70 mt-0.5">
                {revealed
                  ? revealed === "ja"
                    ? "✅ Ja"
                    : "❌ Nein"
                  : voted
                    ? "✓ Voted"
                    : "… Thinking"}
              </div>
            )}
            {view.phase !== "vote" && revealed && (
              <div
                className="text-[10px] mt-0.5"
                style={{
                  color:
                    revealed === "ja"
                      ? "var(--color-success)"
                      : "var(--color-error)",
                }}
              >
                {revealed === "ja" ? "Ja" : "Nein"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NominationPanel({
  view,
  playersById,
  amPresident,
  onNominate,
}: {
  view: SHView;
  playersById: Record<string, PlayerLike>;
  amPresident: boolean;
  onNominate: (target: string) => void;
}) {
  if (!amPresident) {
    return (
      <div className="w-full max-w-xl rounded-2xl p-4 surface-ivory text-center text-sm text-base-content/65">
        Waiting for the President to nominate a Chancellor…
      </div>
    );
  }
  return (
    <div className="w-full max-w-xl rounded-2xl p-5 surface-ivory flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Nominate your Chancellor
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {view.eligibleChancellors.map((id) => {
          const p = playersById[id] ?? { id, name: id };
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNominate(id)}
              className="rounded-xl px-3 py-2 bg-base-100 border border-base-300 hover:border-primary/50 cursor-pointer transition-colors text-left font-semibold"
            >
              {p.name}
            </button>
          );
        })}
      </div>
      {view.eligibleChancellors.length === 0 && (
        <div className="text-xs text-error">
          No eligible Chancellor candidates. Something is off.
        </div>
      )}
    </div>
  );
}

function VotePanel({
  view,
  playersById,
  iHaveVoted,
  onVote,
}: {
  view: SHView;
  playersById: Record<string, PlayerLike>;
  iHaveVoted: boolean;
  onVote: (v: "ja" | "nein") => void;
}) {
  const presidentName = view.president
    ? playersById[view.president]?.name ?? view.president
    : "?";
  const chancellorName = view.chancellor
    ? playersById[view.chancellor]?.name ?? view.chancellor
    : "?";
  const pending = view.playerOrder.filter(
    (id) => !view.voteTally.voters.includes(id),
  );
  return (
    <div
      className="w-full max-w-xl rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-warning) 18%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-warning) 45%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-warning-content">
        {"◆"} Vote on the government {"◆"}
      </div>
      <div className="text-sm">
        <span className="font-display tracking-tight text-primary">
          {presidentName}
        </span>{" "}
        nominates{" "}
        <span className="font-display tracking-tight text-secondary">
          {chancellorName}
        </span>{" "}
        as Chancellor.
      </div>
      <div className="text-xs text-base-content/65">
        Majority <b>Ja</b> elects the government. Ties fail. Three failed
        elections in a row trigger a forced policy.
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-base-content/55 tabular">
          {view.voteTally.voters.length}/{view.playerOrder.length} voted
          {pending.length > 0 && (
            <span className="ml-2 text-base-content/45">
              (waiting:{" "}
              {pending.map((id) => playersById[id]?.name ?? id).join(", ")})
            </span>
          )}
        </div>
        {!iHaveVoted ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-success rounded-full px-5 font-semibold"
              onClick={() => onVote("ja")}
            >
              Ja
            </button>
            <button
              type="button"
              className="btn btn-error rounded-full px-5 font-semibold"
              onClick={() => onVote("nein")}
            >
              Nein
            </button>
          </div>
        ) : (
          <div className="text-xs uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Vote cast · waiting for the rest
          </div>
        )}
      </div>
    </div>
  );
}

/** SVG art for one policy card. Liberal = dove; Fascist = eagle silhouette. */
function PolicyFace({ policy }: { policy: SHPolicy }) {
  const isLiberal = policy === "liberal";
  const bg = isLiberal ? "var(--color-info)" : "var(--color-error)";
  const fg = isLiberal
    ? "var(--color-info-content)"
    : "var(--color-error-content)";
  const ink = `color-mix(in oklch, ${fg} 85%, transparent)`;
  const accent = `color-mix(in oklch, ${fg} 25%, transparent)`;
  const id = `policy-grad-${policy}`;
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
          <stop offset="0%" stopColor={`color-mix(in oklch, ${bg} 80%, white)`} />
          <stop offset="100%" stopColor={`color-mix(in oklch, ${bg} 100%, black)`} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="140" fill={`url(#${id})`} />
      {/* Inner deco frame */}
      <rect
        x="6"
        y="6"
        width="88"
        height="128"
        rx="4"
        fill="none"
        stroke={accent}
        strokeWidth="1"
      />
      {/* Header strip */}
      <text
        x="50"
        y="22"
        fill={ink}
        fontFamily="var(--font-display, serif)"
        fontWeight="700"
        fontSize="8"
        letterSpacing="2"
        textAnchor="middle"
      >
        POLICY
      </text>
      <line x1="20" y1="26" x2="80" y2="26" stroke={accent} strokeWidth="0.8" />

      {/* Symbol */}
      {isLiberal ? (
        <g transform="translate(50 70)">
          {/* Dove silhouette */}
          <path
            d="M -22 6 Q -18 -2 -8 -6 Q -2 -10 6 -10 Q 14 -10 18 -4 L 22 -8 L 18 0 L 24 4 L 16 6 Q 12 14 0 14 Q -12 14 -22 6 Z"
            fill={fg}
            stroke={accent}
            strokeWidth="0.6"
          />
          {/* Eye */}
          <circle cx="14" cy="-4" r="1.2" fill={bg} />
          {/* Wing detail */}
          <path d="M -10 4 Q -2 -2 8 0" stroke={accent} strokeWidth="0.8" fill="none" />
          {/* Olive branch */}
          <path d="M -22 8 Q -28 12 -32 18" stroke={fg} strokeWidth="1.2" fill="none" />
          <ellipse cx="-28" cy="14" rx="2.5" ry="1" fill={fg} transform="rotate(40 -28 14)" />
          <ellipse cx="-31" cy="17" rx="2" ry="0.9" fill={fg} transform="rotate(40 -31 17)" />
        </g>
      ) : (
        <g transform="translate(50 70)">
          {/* Eagle silhouette - aggressive spread wings */}
          <path
            d="M 0 -14 Q -4 -8 -10 -10 L -28 -4 L -22 0 L -28 4 L -10 4 Q -6 8 -6 14 L 6 14 Q 6 8 10 4 L 28 4 L 22 0 L 28 -4 L 10 -10 Q 4 -8 0 -14 Z"
            fill={fg}
            stroke={accent}
            strokeWidth="0.6"
          />
          {/* Head */}
          <circle cx="0" cy="-14" r="3" fill={fg} />
          {/* Beak */}
          <path d="M 0 -11 L -2 -8 L 2 -8 Z" fill={bg} />
          {/* Wing feather lines */}
          <line x1="-22" y1="-2" x2="-12" y2="0" stroke={accent} strokeWidth="0.8" />
          <line x1="-20" y1="2" x2="-10" y2="2" stroke={accent} strokeWidth="0.8" />
          <line x1="22" y1="-2" x2="12" y2="0" stroke={accent} strokeWidth="0.8" />
          <line x1="20" y1="2" x2="10" y2="2" stroke={accent} strokeWidth="0.8" />
        </g>
      )}

      {/* Footer label */}
      <line x1="20" y1="112" x2="80" y2="112" stroke={accent} strokeWidth="0.8" />
      <text
        x="50"
        y="126"
        fill={ink}
        fontFamily="var(--font-display, serif)"
        fontWeight="800"
        fontSize="13"
        letterSpacing="1"
        textAnchor="middle"
      >
        {isLiberal ? "LIBERAL" : "FASCIST"}
      </text>
    </svg>
  );
}

function PolicyCard({
  policy,
  onClick,
  disabled,
  action,
}: {
  policy: SHPolicy;
  onClick?: () => void;
  disabled?: boolean;
  action: "discard" | "enact";
}) {
  const isLiberal = policy === "liberal";
  return (
    <div className="flex flex-col items-center gap-1">
      <CardShell
        size="lg"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        highlight={isLiberal ? "info" : "error"}
        ariaLabel={`${isLiberal ? "Liberal" : "Fascist"} policy${onClick && !disabled ? ` — tap to ${action}` : ""}`}
      >
        <PolicyFace policy={policy} />
      </CardShell>
      {onClick && !disabled && (
        <div
          className="text-[10px] uppercase tracking-[0.22em] font-semibold"
          style={{
            color: isLiberal ? "var(--color-info)" : "var(--color-error)",
          }}
        >
          {action === "discard" ? "Tap to discard" : "Tap to enact"}
        </div>
      )}
    </div>
  );
}

function PresidentDiscardPanel({
  view,
  amPresident,
  onDiscard,
}: {
  view: SHView;
  amPresident: boolean;
  onDiscard: (index: number) => void;
}) {
  if (!amPresident) {
    return (
      <div className="w-full max-w-xl rounded-2xl p-4 surface-ivory text-center text-sm text-base-content/65">
        The President is choosing which policy to discard…
      </div>
    );
  }
  const hand = view.presidentHand ?? [];
  return (
    <div className="w-full max-w-xl rounded-2xl p-5 surface-ivory flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        You drew three policies. Discard one face-down.
      </div>
      <div className="flex gap-3 justify-center">
        {hand.map((p, i) => (
          <PolicyCard
            key={i}
            policy={p}
            action="discard"
            onClick={() => onDiscard(i)}
          />
        ))}
      </div>
      <div className="text-xs text-base-content/55 text-center">
        The other two go to the Chancellor.
      </div>
    </div>
  );
}

function ChancellorEnactPanel({
  view,
  amChancellor,
  onEnact,
}: {
  view: SHView;
  amChancellor: boolean;
  onEnact: (index: number) => void;
}) {
  if (!amChancellor) {
    return (
      <div className="w-full max-w-xl rounded-2xl p-4 surface-ivory text-center text-sm text-base-content/65">
        The Chancellor is choosing which policy to enact…
      </div>
    );
  }
  const hand = view.chancellorHand ?? [];
  return (
    <div className="w-full max-w-xl rounded-2xl p-5 surface-ivory flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Two policies remain. Enact one.
      </div>
      <div className="flex gap-3 justify-center">
        {hand.map((p, i) => (
          <PolicyCard
            key={i}
            policy={p}
            action="enact"
            onClick={() => onEnact(i)}
          />
        ))}
      </div>
      <div className="text-xs text-base-content/55 text-center">
        The other is discarded face-down.
      </div>
    </div>
  );
}

function PolicyHistoryStrip({ view }: { view: SHView }) {
  if (view.policyHistory.length === 0) return null;
  return (
    <div className="w-full max-w-2xl">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/45 mb-1">
        Enacted so far
      </div>
      <div className="flex flex-wrap gap-1">
        {view.policyHistory.map((p, i) => {
          const isLib = p === "liberal";
          return (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
              style={{
                background: isLib ? "var(--color-info)" : "var(--color-error)",
                color: isLib
                  ? "var(--color-info-content)"
                  : "var(--color-error-content)",
              }}
            >
              {isLib ? "L" : "F"}
            </span>
          );
        })}
      </div>
      <div className="text-[10px] text-base-content/45 mt-1 tabular">
        Deck: {view.deckSize} · Discard: {view.discardSize}
      </div>
    </div>
  );
}

function GameOverPanel({
  view,
  playersById,
}: {
  view: SHView;
  playersById: Record<string, PlayerLike>;
}) {
  const winner = view.winner;
  if (!winner) return null;
  const label =
    winner === "liberals" ? "The Liberals win." : "The Fascists win.";
  const reasonMap: Record<NonNullable<SHView["winReason"]>, string> = {
    liberalTrack: "Five Liberal policies enacted.",
    fascistTrack: "Six Fascist policies enacted.",
    hitlerChancellor:
      "Hitler was elected Chancellor after three Fascist policies.",
  };
  const reason = view.winReason ? reasonMap[view.winReason] : "";
  const roles = view.allRoles ?? {};
  return (
    <div className="surface-ivory max-w-xl w-full px-6 py-5 flex flex-col gap-3 text-center">
      <div
        className="text-[10px] uppercase tracking-[0.3em] font-semibold"
        style={{
          color:
            winner === "liberals"
              ? "var(--color-info)"
              : "var(--color-error)",
        }}
      >
        {"◆"} Result {"◆"}
      </div>
      <div
        className="font-display tracking-tight"
        style={{
          fontSize: "var(--text-display-sm)",
          color:
            winner === "liberals"
              ? "var(--color-info)"
              : "var(--color-error)",
        }}
      >
        {label}
      </div>
      <div className="text-sm text-base-content/65">{reason}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left mt-2">
        {view.playerOrder.map((id) => {
          const role = roles[id];
          const name = playersById[id]?.name ?? id;
          const roleLabel: Record<SHRole, string> = {
            liberal: "Liberal",
            fascist: "Fascist",
            hitler: "Hitler",
          };
          const color =
            role === "liberal"
              ? "var(--color-info)"
              : role === "hitler"
                ? "var(--color-error)"
                : "var(--color-neutral)";
          return (
            <div
              key={id}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 border border-base-300 bg-base-100"
            >
              <span className="font-semibold truncate">{name}</span>
              <span
                className="text-[10px] uppercase tracking-[0.22em] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: `color-mix(in oklch, ${color} 22%, transparent)`,
                  color,
                }}
              >
                {role ? roleLabel[role] : "?"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecretHitlerSummary({ view }: SummaryProps<SHView>) {
  if (view.phase !== "gameOver" || !view.winner) return null;
  return (
    <div className="surface-ivory max-w-xl mx-auto px-6 py-5 text-center">
      <div
        className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-1"
        style={{
          color:
            view.winner === "liberals"
              ? "var(--color-info)"
              : "var(--color-error)",
        }}
      >
        {"◆"} Victory {"◆"}
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        <span
          style={{
            color:
              view.winner === "liberals"
                ? "var(--color-info)"
                : "var(--color-error)",
          }}
        >
          {view.winner === "liberals" ? "Liberals" : "Fascists"}
        </span>{" "}
        take it.
      </div>
    </div>
  );
}

export const secretHitlerClientModule: ClientGameModule<
  SHView,
  SHMove,
  Record<string, never>
> = {
  type: SECRET_HITLER_TYPE,
  Board: SecretHitlerBoard,
  Summary: SecretHitlerSummary,
};
