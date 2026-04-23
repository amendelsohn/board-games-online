"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getClientModule } from "@bgo/sdk-client";
import type { PlayerWire, TableWire } from "@bgo/contracts";
import { api } from "@/lib/apiClient";
import { ensurePlayer } from "@/lib/playerSession";
import { useMatchSocket, type ConnectionState } from "@/lib/useMatchSocket";
import { registerAllClientGames } from "@/lib/registerClientGames";
import { PlayerAvatar } from "@/components/PlayerAvatar";

registerAllClientGames();

export default function PlayPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const matchId = typeof params.matchId === "string" ? params.matchId : null;
  const tableId = search.get("table");

  const [player, setPlayer] = useState<PlayerWire | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [table, setTable] = useState<TableWire | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await ensurePlayer();
        if (cancelled) return;
        setPlayer(session.player);
        setSessionToken(session.sessionToken);

        if (tableId) {
          const tbl = await api.getTable(tableId);
          if (!cancelled) setTable(tbl.table);
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  const socketState = useMatchSocket({
    matchId,
    playerId: player?.id ?? null,
    sessionToken,
  });
  const {
    view,
    phase,
    currentActors,
    connectionState,
    reconnectAttempt,
    error,
    sendMove,
    addEventListener,
    isTerminal,
    outcome,
  } = socketState;

  const module_ = useMemo(() => {
    if (!table) return null;
    return getClientModule(table.gameType) ?? null;
  }, [table]);

  // After the match ends, poll the table so we notice the host kicking off
  // a rematch (which resets table.status back to "waiting"). When that
  // happens, everyone — host included — redirects back to the lobby.
  useEffect(() => {
    if (!tableId || !isTerminal || !table) return;
    if (table.status === "waiting" && table.matchId === null) {
      router.push(`/lobby/${table.joinCode}`);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await api.getTable(tableId);
        if (cancelled) return;
        setTable(r.table);
        if (r.table.status === "waiting" && r.table.matchId === null) {
          router.push(`/lobby/${r.table.joinCode}`);
        }
      } catch {
        // transient — next tick will retry
      }
    };
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tableId, isTerminal, table, router]);

  const startRematch = async () => {
    if (!tableId) return;
    setRematchPending(true);
    try {
      const r = await api.rematchTable(tableId);
      setTable(r.table);
      router.push(`/lobby/${r.table.joinCode}`);
    } catch (err) {
      setLoadError((err as Error).message);
      setRematchPending(false);
    }
  };

  if (loadError) {
    return (
      <CenterMessage tone="error">
        <div>{loadError}</div>
      </CenterMessage>
    );
  }

  if (!matchId || !tableId) {
    return (
      <CenterMessage tone="warning">
        <div>Missing match or table identifier.</div>
      </CenterMessage>
    );
  }

  if (!table || !player || !sessionToken) {
    return <ConnectingState label="Sitting down…" />;
  }

  if (!module_) {
    return (
      <CenterMessage tone="error">
        <div>Unknown game type: {table.gameType}</div>
      </CenterMessage>
    );
  }

  if (connectionState === "connecting" || !view) {
    return <ConnectingState label="Connecting to match…" />;
  }

  const Board = module_.Board;
  const Summary = module_.Summary;
  const isMyTurn = currentActors.includes(player.id);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-16">
      <MatchHeader
        gameType={table.gameType}
        players={table.players}
        currentActors={currentActors}
        me={player.id}
        phase={phase}
        connectionState={connectionState}
        reconnectAttempt={reconnectAttempt}
      />

      {error && (
        <div
          role="alert"
          className="mt-4 border border-warning/40 bg-warning/10 text-warning-content px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      {isTerminal && outcome && (
        <OutcomeBanner
          outcome={outcome}
          me={player.id}
          players={table.players}
          isHost={player.id === table.hostPlayerId}
          rematchPending={rematchPending}
          onRematch={startRematch}
        />
      )}

      <div className="mt-6 md:mt-8 flex flex-col items-center">
        <Board
          view={view}
          phase={phase ?? "unknown"}
          me={player.id}
          players={table.players}
          isMyTurn={isMyTurn}
          sendMove={sendMove}
          onEvent={addEventListener}
          latencyMs={0}
        />
      </div>

      {isTerminal && Summary && outcome && (
        <div className="mt-8">
          <Summary view={view} outcome={outcome} />
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          className="text-xs uppercase tracking-[0.2em] text-base-content/45 hover:text-base-content transition-colors"
          onClick={() => router.push("/")}
        >
          ← Back home
        </button>
      </div>
    </div>
  );
}

/* =================================================================
   In-match chrome. Compressed so it never competes with the board.
   ================================================================= */

function MatchHeader({
  gameType,
  players,
  currentActors,
  me,
  phase,
  connectionState,
  reconnectAttempt,
}: {
  gameType: string;
  players: PlayerWire[];
  currentActors: string[];
  me: string;
  phase: string | null;
  connectionState: ConnectionState;
  reconnectAttempt: number;
}) {
  const { label, tone } = connectionLabel(connectionState, reconnectAttempt);
  return (
    <div
      className={[
        "flex flex-col gap-3",
        "border-b border-base-300/70",
        "pb-4",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
            {phase ? phaseLabel(phase) : "—"}
          </span>
          <h1 className="font-display text-xl md:text-2xl tracking-tight truncate">
            {gameLabel(gameType)}
          </h1>
        </div>
        <span
          className={[
            "flex items-center gap-1.5 text-xs tabular",
            tone === "good" ? "text-base-content/60" : "",
            tone === "warn" ? "text-warning-content/80" : "",
            tone === "bad" ? "text-error" : "",
          ].join(" ")}
          aria-live="polite"
        >
          <span
            className={[
              "inline-block h-1.5 w-1.5 rounded-full",
              tone === "good" ? "bg-success" : "",
              tone === "warn" ? "bg-warning animate-pulse" : "",
              tone === "bad" ? "bg-error" : "",
            ].join(" ")}
            aria-hidden
          />
          {label}
        </span>
      </div>

      <ul className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        {players.map((p) => {
          const isActive = currentActors.includes(p.id);
          return (
            <li
              key={p.id}
              className={[
                "flex items-center gap-2 px-2.5 py-1.5 rounded-full shrink-0",
                "transition-all",
                isActive
                  ? "bg-primary/10 text-base-content"
                  : "bg-base-200/60 text-base-content/70",
              ].join(" ")}
            >
              <PlayerAvatar name={p.name} size="sm" active={isActive} />
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-sm leading-none">
                  {p.name}
                </span>
                {p.id === me && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-base-content/45">
                    you
                  </span>
                )}
                {isActive && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
                    turn
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OutcomeBanner({
  outcome,
  me,
  players,
  isHost,
  rematchPending,
  onRematch,
}: {
  outcome: { kind: string; winners?: string[]; losers?: string[] };
  me: string;
  players: PlayerWire[];
  isHost: boolean;
  rematchPending: boolean;
  onRematch: () => void;
}) {
  let heading = "Game over";
  let sub = "";
  let eyebrow = "◆ Result ◆";
  let tone: "good" | "bad" | "neutral" = "neutral";

  if (outcome.kind === "draw") {
    heading = "A draw.";
    sub = "No one claims this one.";
  } else if (outcome.kind === "solo" && outcome.winners) {
    const winnerId = outcome.winners[0];
    const winner = players.find((p) => p.id === winnerId);
    if (winnerId === me) {
      heading = "You win.";
      sub = "A well-played round.";
      eyebrow = "◆ Victory ◆";
      tone = "good";
    } else {
      heading = `${winner?.name ?? "Opponent"} takes it.`;
      sub = "Better luck next round.";
      eyebrow = "◆ Outcome ◆";
      tone = "bad";
    }
  }

  return (
    <div
      className={[
        "mt-5 parlor-fade",
        "surface-ivory",
        "px-6 py-6 md:py-7",
        "flex flex-col items-center gap-2 text-center",
      ].join(" ")}
      style={{
        borderColor:
          tone === "good"
            ? "color-mix(in oklch, var(--color-success) 50%, var(--color-base-300))"
            : tone === "bad"
              ? "color-mix(in oklch, var(--color-error) 40%, var(--color-base-300))"
              : undefined,
      }}
    >
      <div
        className={[
          "text-[10px] uppercase tracking-[0.3em] font-semibold",
          tone === "good"
            ? "text-success"
            : tone === "bad"
              ? "text-error"
              : "text-base-content/50",
        ].join(" ")}
      >
        {eyebrow}
      </div>
      <h2
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-md)" }}
      >
        {heading}
      </h2>
      {sub && <div className="text-sm text-base-content/60">{sub}</div>}
      <div className="mt-4 flex items-center gap-3">
        {isHost ? (
          <button
            type="button"
            onClick={onRematch}
            disabled={rematchPending}
            className="btn btn-primary rounded-full px-6 font-semibold disabled:opacity-60"
          >
            {rematchPending ? "Opening…" : "Play again →"}
          </button>
        ) : (
          <span className="text-xs uppercase tracking-[0.22em] text-base-content/50">
            Waiting for the host to call a rematch…
          </span>
        )}
      </div>
    </div>
  );
}

function ConnectingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 mt-24">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-primary"
            style={{
              animation: "parlorWinPulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
      <div className="text-sm uppercase tracking-[0.22em] text-base-content/55">
        {label}
      </div>
    </div>
  );
}

function CenterMessage({
  tone,
  children,
}: {
  tone: "error" | "warning";
  children: React.ReactNode;
}) {
  const color = tone === "error" ? "text-error" : "text-warning-content";
  return (
    <div className="max-w-md mx-auto mt-16 px-6">
      <div className={`surface-ivory p-5 ${color}`}>{children}</div>
    </div>
  );
}

function gameLabel(type: string): string {
  if (type === "tic-tac-toe") return "Tic-Tac-Toe";
  if (type === "connect-four") return "Connect Four";
  if (type === "codenames") return "Codenames";
  if (type === "spyfall") return "Spyfall";
  return type;
}

function connectionLabel(
  state: ConnectionState,
  reconnectAttempt: number,
): { label: string; tone: "good" | "warn" | "bad" } {
  if (state === "connected") return { label: "connected", tone: "good" };
  if (state === "connecting") return { label: "connecting", tone: "warn" };
  if (state === "reconnecting") {
    return {
      label:
        reconnectAttempt > 1
          ? `reconnecting (${reconnectAttempt})`
          : "reconnecting",
      tone: "warn",
    };
  }
  if (state === "error") return { label: "offline", tone: "bad" };
  return { label: "disconnected", tone: "bad" };
}

function phaseLabel(phase: string): string {
  if (phase === "play") return "In play";
  if (phase === "cluing") return "Giving clue";
  if (phase === "guessing") return "Guessing";
  if (phase === "gameOver") return "Finished";
  if (phase === "setup") return "Setup";
  return phase;
}
