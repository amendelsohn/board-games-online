import { useState } from "react";
import type {
  BoardProps,
  ClientGameModule,
  LobbyPanelProps,
  SummaryProps,
} from "@bgo/sdk-client";
import {
  CODENAMES_TYPE,
  GRID_COLS,
  type CodenamesConfig,
  type CodenamesMove,
  type CodenamesView,
  type CardRole,
  type Team,
} from "./shared";

function roleColor(role: CardRole | null | undefined): string {
  if (role === "red") return "bg-error text-white";
  if (role === "blue") return "bg-info text-white";
  if (role === "neutral") return "bg-base-300 text-base-content";
  if (role === "assassin") return "bg-neutral text-neutral-content";
  return "bg-base-100";
}

function roleLabel(role: CardRole | null | undefined): string {
  if (role === "red") return "Red";
  if (role === "blue") return "Blue";
  if (role === "neutral") return "Neutral";
  if (role === "assassin") return "Assassin";
  return "?";
}

function CodenamesBoard({
  view,
  me,
  isMyTurn,
  sendMove,
  players,
}: BoardProps<CodenamesView, CodenamesMove>) {
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState<number>(1);

  const myTeam = view.viewerTeam;
  const myRole = view.viewerRole;
  const amSpymaster = myRole === "spymaster";
  const isGuessing = view.phase === "guessing";
  const isCluing = view.phase === "cluing";
  const isOver = view.phase === "gameOver";

  const submitClue = async () => {
    const w = clueWord.trim();
    if (!w) return;
    await sendMove({ kind: "giveClue", word: w, count: clueCount });
    setClueWord("");
    setClueCount(1);
  };

  const guess = async (cardIndex: number) => {
    if (!isMyTurn || amSpymaster || !isGuessing) return;
    await sendMove({ kind: "guess", cardIndex });
  };

  const endGuessing = async () => {
    if (!isMyTurn || amSpymaster || !isGuessing) return;
    await sendMove({ kind: "endGuessing" });
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <TurnIndicator view={view} players={players} me={me} />

      <div className="flex flex-col items-center gap-2">
        <div
          className={`text-sm font-semibold ${
            myTeam === "red" ? "text-error" : myTeam === "blue" ? "text-info" : ""
          }`}
        >
          You are on team {myTeam ?? "—"} (
          {myRole === "spymaster" ? "Spymaster" : "Operative"})
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="font-bold text-error">Red:</span>{" "}
            {view.remaining.red}
          </div>
          <div>
            <span className="font-bold text-info">Blue:</span>{" "}
            {view.remaining.blue}
          </div>
        </div>
      </div>

      <div
        className="grid gap-2 w-full max-w-3xl"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
        }}
      >
        {view.grid.map((card, i) => {
          const clickable =
            !isOver && isMyTurn && !amSpymaster && isGuessing && !card.revealed;
          const base = card.revealed
            ? roleColor(card.role)
            : amSpymaster && card.role
              ? `${roleColor(card.role)} opacity-95`
              : "bg-base-100";
          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => guess(i)}
              className={[
                "relative min-h-[60px] md:min-h-[80px] px-2 py-3 rounded-lg font-bold text-center transition-all",
                "border border-base-300 shadow-sm",
                base,
                clickable ? "hover:scale-[1.03] cursor-pointer" : "",
                card.revealed ? "bgo-fade" : "",
              ].join(" ")}
              aria-label={card.word}
            >
              <span
                className={[
                  "block text-xs md:text-sm leading-tight",
                  card.revealed ? "line-through opacity-80" : "",
                ].join(" ")}
              >
                {card.word}
              </span>
              {card.revealed && card.role && (
                <span className="absolute bottom-0.5 right-1 text-[9px] opacity-70">
                  {roleLabel(card.role)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!isOver && (
        <div className="w-full max-w-xl card bg-base-200/60 border border-base-300">
          <div className="card-body p-4 gap-3">
            {isCluing && isMyTurn && amSpymaster && (
              <>
                <div className="text-sm text-base-content/70">
                  Give your team a one-word clue:
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    placeholder="clue word"
                    value={clueWord}
                    onChange={(e) => setClueWord(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submitClue();
                    }}
                    maxLength={40}
                  />
                  <input
                    type="number"
                    className="input input-bordered w-20"
                    min={0}
                    max={9}
                    value={clueCount}
                    onChange={(e) => setClueCount(parseInt(e.target.value, 10) || 0)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={submitClue}
                  >
                    Give clue
                  </button>
                </div>
              </>
            )}
            {isCluing && !(isMyTurn && amSpymaster) && (
              <div className="text-sm text-base-content/70 text-center">
                Waiting for the {view.turn === "red" ? "red" : "blue"} spymaster
                to give a clue…
              </div>
            )}
            {isGuessing && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm text-base-content/70">Clue:</div>
                  <div className="text-xl font-bold">
                    <span>{view.clue?.word}</span>
                    <span className="ml-2 text-base-content/60">
                      ({view.clue?.count})
                    </span>
                  </div>
                  <div className="text-xs text-base-content/60">
                    {view.guessesLeft} guess{view.guessesLeft === 1 ? "" : "es"} remaining
                  </div>
                </div>
                {isMyTurn && !amSpymaster && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={endGuessing}
                  >
                    End guessing
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TurnIndicator({
  view,
  players,
  me,
}: {
  view: CodenamesView;
  players: { id: string; name: string }[];
  me: string;
}) {
  if (view.phase === "gameOver") return null;
  const team = view.turn;
  const color =
    team === "red"
      ? "bg-error text-white"
      : "bg-info text-white";
  return (
    <div className={`px-4 py-2 rounded-full font-bold text-lg ${color}`}>
      {team === "red" ? "Red" : "Blue"} team's turn —{" "}
      {view.phase === "cluing" ? "Spymaster giving clue" : "Operatives guessing"}
    </div>
  );
}

function CodenamesLobbyPanel({
  config,
  onChange,
  players,
  isHost,
}: LobbyPanelProps<CodenamesConfig>) {
  const teams = config.teams ?? {};
  const spymasters = config.spymasters ?? {};

  const setTeam = (playerId: string, team: Team) => {
    onChange({
      ...config,
      teams: { ...teams, [playerId]: team },
    });
  };

  const setSpymaster = (team: Team, playerId: string | undefined) => {
    onChange({
      ...config,
      spymasters: { ...spymasters, [team]: playerId },
    });
  };

  const red = players.filter((p) => teams[p.id] === "red");
  const blue = players.filter((p) => teams[p.id] === "blue");
  const unassigned = players.filter(
    (p) => teams[p.id] !== "red" && teams[p.id] !== "blue",
  );

  const isMissingSpymaster = (team: Team) => {
    const id = spymasters[team];
    if (!id) return true;
    return !(team === "red" ? red : blue).some((p) => p.id === id);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-base-content/70">
        {isHost
          ? "As host, assign teams and pick a spymaster for each side before starting."
          : "The host controls team and spymaster assignments."}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TeamColumn
          label="Red team"
          accent="bg-error"
          members={red}
          spymasterId={spymasters.red}
          onSetSpymaster={(id) => isHost && setSpymaster("red", id)}
          onMove={(p) => isHost && setTeam(p, "blue")}
          moveLabel="→ Blue"
          isHost={isHost}
          missingSpymaster={isMissingSpymaster("red")}
        />
        <TeamColumn
          label="Blue team"
          accent="bg-info"
          members={blue}
          spymasterId={spymasters.blue}
          onSetSpymaster={(id) => isHost && setSpymaster("blue", id)}
          onMove={(p) => isHost && setTeam(p, "red")}
          moveLabel="Red ←"
          isHost={isHost}
          missingSpymaster={isMissingSpymaster("blue")}
        />
      </div>

      {unassigned.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Unassigned</div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <div key={p.id} className="badge badge-lg gap-2">
                {p.name}
                {isHost && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTeam(p.id, "red")}
                      className="btn btn-error btn-xs"
                    >
                      Red
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeam(p.id, "blue")}
                      className="btn btn-info btn-xs"
                    >
                      Blue
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamColumn({
  label,
  accent,
  members,
  spymasterId,
  onSetSpymaster,
  onMove,
  moveLabel,
  isHost,
  missingSpymaster,
}: {
  label: string;
  accent: string;
  members: { id: string; name: string }[];
  spymasterId: string | undefined;
  onSetSpymaster: (id: string) => void;
  onMove: (playerId: string) => void;
  moveLabel: string;
  isHost: boolean;
  missingSpymaster: boolean;
}) {
  return (
    <div className="card bg-base-200/60 border border-base-300">
      <div className="card-body p-4 gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${accent}`} />
          <h3 className="font-bold">{label}</h3>
          <span className="text-sm text-base-content/60 ml-auto">
            {members.length} player{members.length === 1 ? "" : "s"}
          </span>
        </div>
        {missingSpymaster && (
          <div className="text-xs text-warning">
            No spymaster picked yet — one will be auto-assigned on start.
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {members.length === 0 && (
            <li className="text-sm text-base-content/50 italic">empty</li>
          )}
          {members.map((p) => {
            const isSpy = p.id === spymasterId;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {isSpy && (
                    <span className="badge badge-primary badge-xs">
                      spymaster
                    </span>
                  )}
                </div>
                {isHost && (
                  <div className="flex gap-1">
                    {!isSpy && (
                      <button
                        type="button"
                        onClick={() => onSetSpymaster(p.id)}
                        className="btn btn-ghost btn-xs"
                        title="Make spymaster"
                      >
                        ★
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onMove(p.id)}
                      className="btn btn-ghost btn-xs"
                    >
                      {moveLabel}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function CodenamesSummary({ view }: SummaryProps<CodenamesView>) {
  if (view.phase !== "gameOver" || !view.winner) return null;
  const reasonLabel =
    view.winReason === "assassin"
      ? "— the other team picked the assassin!"
      : view.winReason === "lastCard"
        ? "— found all their agents."
        : "";
  return (
    <div className="card bg-base-200/60 border border-base-300 max-w-xl mx-auto">
      <div className="card-body p-4 text-center gap-1">
        <div className="text-2xl font-bold">
          <span
            className={view.winner === "red" ? "text-error" : "text-info"}
          >
            {view.winner === "red" ? "Red" : "Blue"}
          </span>{" "}
          wins
        </div>
        <div className="text-sm text-base-content/70">{reasonLabel}</div>
      </div>
    </div>
  );
}

export const codenamesClientModule: ClientGameModule<
  CodenamesView,
  CodenamesMove,
  CodenamesConfig
> = {
  type: CODENAMES_TYPE,
  Board: CodenamesBoard,
  LobbyPanel: CodenamesLobbyPanel,
  Summary: CodenamesSummary,
};
