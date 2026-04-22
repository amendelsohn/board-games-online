import { useEffect, useMemo, useState } from "react";
import type {
  BoardProps,
  ClientGameModule,
  LobbyPanelProps,
  SummaryProps,
} from "@bgo/sdk-client";
import {
  DEFAULT_ROUND_SECONDS,
  MAX_ROUND_SECONDS,
  MIN_ROUND_SECONDS,
  SPYFALL_TYPE,
  type SpyfallConfig,
  type SpyfallMove,
  type SpyfallView,
} from "./shared";

function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function useCountdown(endsAt: number): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (Date.now() >= endsAt) {
      setNow(Date.now());
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return Math.max(0, endsAt - now);
}

function SpyfallBoard({
  view,
  me,
  players,
  sendMove,
}: BoardProps<SpyfallView, SpyfallMove>) {
  const remainingMs = useCountdown(view.endsAt);
  const [guess, setGuess] = useState<string>("");

  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const accusation = view.accusation;
  const isOver = view.phase === "gameOver";
  const isPlaying = view.phase === "playing";
  const isVoting = view.phase === "voting";
  const isSpy = view.viewer.isSpy;

  const accuse = async (target: string) => {
    if (!isPlaying || isSpy) return;
    await sendMove({ kind: "accuse", target });
  };
  const vote = async (approve: boolean) => {
    if (!isVoting || !accusation?.viewerMustVote) return;
    await sendMove({ kind: "vote", approve });
  };
  const cancelAccusation = async () => {
    if (!isVoting || !accusation || accusation.accuser !== me) return;
    await sendMove({ kind: "cancelAccusation" });
  };
  const submitSpyGuess = async () => {
    if (!isSpy || !guess) return;
    await sendMove({ kind: "spyGuess", location: guess });
    setGuess("");
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <ClockBanner remainingMs={remainingMs} phase={view.phase} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
        <IdentityCard view={view} />
        <PlayersCard
          view={view}
          players={players}
          playersById={playersById}
          me={me}
          canAccuse={isPlaying && !isSpy && !isOver}
          onAccuse={accuse}
        />
      </div>

      {isVoting && accusation && (
        <VotingPanel
          view={view}
          playersById={playersById}
          me={me}
          onVote={vote}
          onCancel={cancelAccusation}
        />
      )}

      {isSpy && !isOver && (
        <SpyGuessPanel
          locations={view.locationPool}
          guess={guess}
          setGuess={setGuess}
          onSubmit={submitSpyGuess}
        />
      )}

      {!isSpy && !isOver && (
        <LocationPoolHint locations={view.locationPool} />
      )}
    </div>
  );
}

function ClockBanner({
  remainingMs,
  phase,
}: {
  remainingMs: number;
  phase: SpyfallView["phase"];
}) {
  if (phase === "gameOver") return null;
  const low = remainingMs < 60_000;
  return (
    <div
      className={[
        "px-5 py-2 rounded-full font-mono text-2xl font-bold",
        low ? "bg-error text-white animate-pulse" : "bg-base-200",
      ].join(" ")}
    >
      {formatClock(remainingMs)}
    </div>
  );
}

function IdentityCard({ view }: { view: SpyfallView }) {
  const isSpy = view.viewer.isSpy;
  return (
    <div
      className={[
        "card border",
        isSpy
          ? "bg-neutral text-neutral-content border-neutral"
          : "bg-base-200/60 border-base-300",
      ].join(" ")}
    >
      <div className="card-body p-5 gap-2">
        {isSpy ? (
          <>
            <div className="text-sm uppercase tracking-widest opacity-70">
              Your role
            </div>
            <div className="text-3xl font-black">You are the Spy 🕵️</div>
            <div className="text-sm opacity-80">
              You don't know the location. Ask sharp questions and play along.
              When you're ready, pick the location from the list below.
            </div>
          </>
        ) : (
          <>
            <div className="text-sm uppercase tracking-widest text-base-content/60">
              Location
            </div>
            <div className="text-3xl font-black">{view.viewer.location}</div>
            <div className="text-sm text-base-content/70">
              Your role:{" "}
              <span className="font-bold">{view.viewer.role}</span>
            </div>
            <div className="text-xs text-base-content/60 pt-1">
              Don't say the location out loud — someone here is a spy.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlayersCard({
  view,
  players,
  playersById,
  me,
  canAccuse,
  onAccuse,
}: {
  view: SpyfallView;
  players: { id: string; name: string }[];
  playersById: Record<string, { id: string; name: string }>;
  me: string;
  canAccuse: boolean;
  onAccuse: (id: string) => void;
}) {
  const order = view.order;
  return (
    <div className="card bg-base-200/60 border border-base-300">
      <div className="card-body p-5 gap-3">
        <div className="text-sm uppercase tracking-widest text-base-content/60">
          Players
        </div>
        <ul className="flex flex-col gap-1">
          {order.map((id, i) => {
            const p = playersById[id] ?? { id, name: id };
            const isMe = id === me;
            const isSpy = view.spyId === id; // only non-null post-terminal or if viewer is spy
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-2 border border-base-300 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-base-content/50 w-5">
                    {i + 1}.
                  </span>
                  <span className="font-semibold truncate">{p.name}</span>
                  {isMe && (
                    <span className="badge badge-ghost badge-xs">you</span>
                  )}
                  {isSpy && (
                    <span className="badge badge-neutral badge-xs">spy</span>
                  )}
                </div>
                {canAccuse && !isMe && (
                  <button
                    type="button"
                    className="btn btn-error btn-xs"
                    onClick={() => onAccuse(id)}
                  >
                    Accuse
                  </button>
                )}
              </li>
            );
          })}
          {players.length === 0 && (
            <li className="text-sm text-base-content/50">No players.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function VotingPanel({
  view,
  playersById,
  me,
  onVote,
  onCancel,
}: {
  view: SpyfallView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
  onVote: (approve: boolean) => void;
  onCancel: () => void;
}) {
  const acc = view.accusation!;
  const accuserName = playersById[acc.accuser]?.name ?? acc.accuser;
  const targetName = playersById[acc.target]?.name ?? acc.target;
  const iAmAccuser = acc.accuser === me;
  return (
    <div className="card bg-warning/20 border border-warning max-w-xl w-full">
      <div className="card-body p-4 gap-3">
        <div className="text-sm uppercase tracking-widest text-warning-content/70">
          Accusation in progress
        </div>
        <div className="text-lg">
          <span className="font-bold">{accuserName}</span> accuses{" "}
          <span className="font-bold">{targetName}</span>.
        </div>
        <div className="text-xs text-base-content/70">
          All other players must vote to approve. Any rejection cancels it.
        </div>
        <div className="text-sm">
          <span className="badge badge-success badge-sm mr-1">
            ✓ {acc.approvals}
          </span>
          <span className="badge badge-error badge-sm">
            ✗ {acc.rejections}
          </span>
          {acc.pending.length > 0 && (
            <span className="text-base-content/60 ml-2">
              waiting on:{" "}
              {acc.pending
                .map((id) => playersById[id]?.name ?? id)
                .join(", ")}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {acc.viewerMustVote && (
            <>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => onVote(true)}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={() => onVote(false)}
              >
                Reject
              </button>
            </>
          )}
          {iAmAccuser && (
            <button
              type="button"
              className="btn btn-ghost ml-auto"
              onClick={onCancel}
            >
              Cancel accusation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SpyGuessPanel({
  locations,
  guess,
  setGuess,
  onSubmit,
}: {
  locations: string[];
  guess: string;
  setGuess: (s: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="card bg-base-200/60 border border-base-300 max-w-xl w-full">
      <div className="card-body p-4 gap-3">
        <div className="text-sm uppercase tracking-widest text-base-content/60">
          Spy: guess the location
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            className="select select-bordered flex-1"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
          >
            <option value="">Choose a location…</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={!guess}
          >
            Guess
          </button>
        </div>
        <div className="text-xs text-base-content/60">
          If you guess correctly, you win — if not, the non-spies win
          immediately.
        </div>
      </div>
    </div>
  );
}

function LocationPoolHint({ locations }: { locations: string[] }) {
  return (
    <details className="max-w-3xl w-full">
      <summary className="cursor-pointer text-sm text-base-content/70">
        All possible locations ({locations.length})
      </summary>
      <div className="flex flex-wrap gap-2 mt-2">
        {locations.map((l) => (
          <span key={l} className="badge badge-outline">
            {l}
          </span>
        ))}
      </div>
    </details>
  );
}

function SpyfallLobbyPanel({
  config,
  onChange,
  isHost,
}: LobbyPanelProps<SpyfallConfig>) {
  const seconds = config.roundSeconds ?? DEFAULT_ROUND_SECONDS;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-base-content/70">
        {isHost
          ? "Pick a round length. The spy wins if the clock runs out."
          : "The host chooses the round length."}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-semibold" htmlFor="spyfall-seconds">
          Round length
        </label>
        <input
          id="spyfall-seconds"
          type="range"
          className="range range-primary flex-1 min-w-[200px]"
          min={MIN_ROUND_SECONDS}
          max={MAX_ROUND_SECONDS}
          step={30}
          value={seconds}
          disabled={!isHost}
          onChange={(e) =>
            onChange({ ...config, roundSeconds: parseInt(e.target.value, 10) })
          }
        />
        <span className="font-mono font-bold">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function SpyfallSummary({ view }: SummaryProps<SpyfallView>) {
  if (view.phase !== "gameOver" || !view.winner) return null;
  const headline =
    view.winner === "spy" ? "The Spy wins!" : "The Non-Spies win!";
  const reasonLabel: Record<NonNullable<SpyfallView["winReason"]>, string> = {
    timeUp: "The clock ran out before the spy was caught.",
    spyGuessedRight: "The spy guessed the location correctly.",
    spyGuessedWrong: "The spy guessed wrong.",
    accusedSpy: "The spy was caught by vote.",
    accusedNonSpy: "The non-spies accused the wrong player.",
  };
  const reason = view.winReason ? reasonLabel[view.winReason] : "";

  return (
    <div className="card bg-base-200/60 border border-base-300 max-w-xl mx-auto">
      <div className="card-body p-4 text-center gap-1">
        <div className="text-2xl font-bold">{headline}</div>
        <div className="text-sm text-base-content/70">{reason}</div>
        <div className="text-sm mt-2">
          Location was{" "}
          <span className="font-bold">{view.location ?? "?"}</span>
        </div>
        {view.spyGuess && (
          <div className="text-xs text-base-content/60">
            Spy's guess: {view.spyGuess}
          </div>
        )}
      </div>
    </div>
  );
}

export const spyfallClientModule: ClientGameModule<
  SpyfallView,
  SpyfallMove,
  SpyfallConfig
> = {
  type: SPYFALL_TYPE,
  Board: SpyfallBoard,
  LobbyPanel: SpyfallLobbyPanel,
  Summary: SpyfallSummary,
};
