import { useEffect, useMemo, useState } from "react";
import type {
  BoardProps,
  ClientGameModule,
  SummaryProps,
} from "@bgo/sdk-client";
import {
  AVALON_TYPE,
  type AvalonMove,
  type AvalonRole,
  type AvalonView,
} from "./shared";

type PlayerLike = { id: string; name: string };

function AvalonBoard({
  view,
  me,
  isMyTurn,
  players,
  sendMove,
}: BoardProps<AvalonView, AvalonMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, PlayerLike> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const [proposal, setProposal] = useState<string[]>([]);

  const isOver = view.phase === "gameOver";
  const isProposal = view.phase === "proposal";
  const isVote = view.phase === "vote";
  const isQuest = view.phase === "quest";
  const isMerlinGuess = view.phase === "merlinGuess";

  const amLeader = me === view.leader;
  const iAmOnQuest =
    isQuest &&
    view.proposedTeam != null &&
    view.proposedTeam.includes(me);
  const myVote = view.voteTally.results?.[me] ?? null;
  const iHaveVoted =
    isVote && view.voteTally.voters.includes(me);

  const toggleProposal = (id: string) => {
    if (!amLeader || !isProposal) return;
    setProposal((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= view.currentQuestSize) return cur;
      return [...cur, id];
    });
  };

  const submitProposal = async () => {
    if (!amLeader || !isProposal) return;
    if (proposal.length !== view.currentQuestSize) return;
    await sendMove({ kind: "proposeTeam", team: proposal });
    setProposal([]);
  };

  const castVote = async (vote: "approve" | "reject") => {
    if (!isVote || iHaveVoted) return;
    await sendMove({ kind: "vote", vote });
  };

  const [mySubmittedQuest, setMySubmittedQuest] = useState<
    "success" | "fail" | null
  >(null);
  // Reset the local "I've played my card" memory each time a new quest starts.
  useEffect(() => {
    setMySubmittedQuest(null);
  }, [view.questIdx, view.proposalNumber]);
  const castQuest = async (vote: "success" | "fail") => {
    if (!isQuest || !iAmOnQuest) return;
    if (mySubmittedQuest) return;
    setMySubmittedQuest(vote);
    try {
      await sendMove({ kind: "questVote", vote });
    } catch (err) {
      setMySubmittedQuest(null);
      throw err;
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <QuestTokens view={view} />

      <RoleCard view={view} playersById={playersById} />

      <LeaderBanner view={view} playersById={playersById} me={me} />

      {isProposal && (
        <ProposalPanel
          view={view}
          playersById={playersById}
          me={me}
          amLeader={amLeader}
          proposal={proposal}
          onToggle={toggleProposal}
          onSubmit={submitProposal}
        />
      )}

      {isVote && (
        <VotePanel
          view={view}
          playersById={playersById}
          me={me}
          iHaveVoted={iHaveVoted}
          myVote={myVote}
          onVote={castVote}
        />
      )}

      {isQuest && (
        <QuestPanel
          view={view}
          playersById={playersById}
          me={me}
          iAmOnQuest={iAmOnQuest}
          myRole={view.viewerRole}
          mySubmittedQuest={mySubmittedQuest}
          onSubmit={castQuest}
        />
      )}

      {isMerlinGuess && (
        <MerlinGuessPanel
          view={view}
          playersById={playersById}
          me={me}
          onAccuse={(target) => sendMove({ kind: "accuseMerlin", target })}
        />
      )}

      {isOver && <GameOverPanel view={view} playersById={playersById} />}

      {!isOver && !isMyTurn && (
        <div className="text-xs text-base-content/55 italic">
          Waiting on other players…
        </div>
      )}
    </div>
  );
}

function QuestTokens({ view }: { view: AvalonView }) {
  return (
    <div className="flex items-center gap-2 md:gap-3">
      {view.questResults.map((res, i) => {
        const active = i === view.questIdx && view.phase !== "gameOver";
        const color =
          res === "success"
            ? "var(--color-info)"
            : res === "failure"
              ? "var(--color-error)"
              : active
                ? "var(--color-primary)"
                : "color-mix(in oklch, var(--color-base-300) 70%, transparent)";
        const contentColor =
          res === "success"
            ? "var(--color-info-content)"
            : res === "failure"
              ? "var(--color-error-content)"
              : active
                ? "var(--color-primary-content)"
                : "var(--color-base-content)";
        const fails = view.questFailsNeeded[i]!;
        const size = view.questSizes[i]!;
        return (
          <div
            key={i}
            className={[
              "w-14 h-16 md:w-16 md:h-[76px] rounded-xl flex flex-col items-center justify-center",
              "transition-all duration-200 relative",
              active
                ? "ring-2 ring-offset-2 ring-offset-base-200"
                : "",
            ].join(" ")}
            style={{
              background: color,
              color: contentColor,
              boxShadow:
                "inset 0 1px 0 oklch(100% 0 0 / 0.2), inset 0 -2px 0 oklch(0% 0 0 / 0.15), 0 2px 6px oklch(0% 0 0 / 0.08)",
            }}
            aria-label={`Quest ${i + 1}, team size ${size}, ${fails} fail${fails > 1 ? "s" : ""} to fail`}
          >
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold opacity-70">
              Q{i + 1}
            </div>
            <div className="font-display tracking-tight text-2xl leading-none">
              {size}
            </div>
            {fails > 1 && (
              <div
                className="absolute -top-2 -right-2 text-[9px] font-bold rounded-full px-1.5 py-[1px]"
                style={{
                  background: "var(--color-warning)",
                  color: "var(--color-warning-content)",
                }}
                title="Needs 2 fails to fail"
              >
                ×2
              </div>
            )}
            {res === "success" && (
              <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-60 pointer-events-none">
                ✓
              </div>
            )}
            {res === "failure" && (
              <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-60 pointer-events-none">
                ✗
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RoleCard({
  view,
  playersById,
}: {
  view: AvalonView;
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
  const isSpy = role === "spy";
  const isMerlin = role === "merlin";
  const knownSpies = view.knownSpies;
  const label: Record<AvalonRole, string> = {
    spy: "Spy",
    merlin: "Merlin",
    loyal: "Loyal Servant",
  };
  const blurb: Record<AvalonRole, string> = {
    spy: "Lie. Fail quests. Don't let the loyal out-vote you — and catch Merlin if you lose.",
    merlin:
      "You see the spies. Guide the loyal to victory — but never reveal yourself, or the spies will name you.",
    loyal:
      "You don't know who's who. Read the table, vote with your gut, play success every quest.",
  };
  return (
    <div
      className={[
        "rounded-2xl p-5 flex flex-col gap-2 max-w-xl w-full",
        isSpy ? "bg-neutral text-neutral-content" : "surface-ivory",
      ].join(" ")}
      style={{
        boxShadow: isSpy
          ? "inset 0 1px 0 oklch(100% 0 0 / 0.1), inset 0 -2px 0 oklch(0% 0 0 / 0.3), 0 12px 32px oklch(0% 0 0 / 0.25)"
          : undefined,
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.3em] font-semibold"
        style={{
          color: isSpy
            ? "color-mix(in oklch, currentColor 65%, transparent)"
            : isMerlin
              ? "var(--color-primary)"
              : "var(--color-base-content)",
          opacity: isSpy ? 1 : 0.65,
        }}
      >
        ◆ Your role ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{
          fontSize: "var(--text-display-sm)",
          color: isSpy
            ? "currentColor"
            : isMerlin
              ? "var(--color-primary)"
              : "var(--color-base-content)",
        }}
      >
        {label[role]}
      </div>
      <div className="text-sm opacity-80 leading-relaxed">{blurb[role]}</div>
      {knownSpies.length > 0 && (
        <div className="mt-2 pt-2 border-t border-current/15">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold opacity-70 mb-1">
            {isMerlin ? "The spies (you see them)" : "Your fellow spies"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {knownSpies.map((id) => (
              <span
                key={id}
                className="text-xs px-2.5 py-0.5 rounded-full"
                style={{
                  background: isSpy
                    ? "oklch(100% 0 0 / 0.15)"
                    : "color-mix(in oklch, var(--color-error) 85%, transparent)",
                  color: isSpy ? "currentColor" : "var(--color-error-content)",
                }}
              >
                {playersById[id]?.name ?? id}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderBanner({
  view,
  playersById,
  me,
}: {
  view: AvalonView;
  playersById: Record<string, PlayerLike>;
  me: string;
}) {
  if (view.phase === "gameOver" || view.phase === "merlinGuess") return null;
  const leaderName = playersById[view.leader]?.name ?? view.leader;
  const isMeLeader = view.leader === me;
  const failsLabel =
    view.currentQuestFailsNeeded > 1
      ? ` — needs ${view.currentQuestFailsNeeded} fails`
      : "";
  return (
    <div className="text-sm text-base-content/70 text-center">
      Quest <span className="font-semibold">{view.questIdx + 1}</span>
      {" · "}
      Team of <span className="font-semibold">{view.currentQuestSize}</span>
      {failsLabel}
      {" · "}
      Proposal{" "}
      <span className="font-semibold tabular-nums">
        {view.proposalNumber}/5
      </span>
      {" · Leader: "}
      <span className="font-display tracking-tight text-primary">
        {isMeLeader ? "you" : leaderName}
      </span>
    </div>
  );
}

function ProposalPanel({
  view,
  playersById,
  me,
  amLeader,
  proposal,
  onToggle,
  onSubmit,
}: {
  view: AvalonView;
  playersById: Record<string, PlayerLike>;
  me: string;
  amLeader: boolean;
  proposal: string[];
  onToggle: (id: string) => void;
  onSubmit: () => void;
}) {
  const ready = proposal.length === view.currentQuestSize;
  return (
    <div className="surface-ivory w-full max-w-xl p-5 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        {amLeader ? "Assemble your team" : "Waiting for the leader"}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {view.playerOrder.map((id) => {
          const p = playersById[id] ?? { id, name: id };
          const selected = proposal.includes(id);
          const isMe = id === me;
          const isLeader = id === view.leader;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              disabled={!amLeader}
              className={[
                "rounded-xl px-3 py-2 text-left transition-all border",
                "flex items-center justify-between gap-2",
                selected
                  ? "bg-primary text-primary-content border-primary"
                  : "bg-base-100 border-base-300 hover:border-primary/50",
                amLeader ? "cursor-pointer" : "cursor-default opacity-90",
              ].join(" ")}
            >
              <div className="flex flex-col min-w-0">
                <span className="font-semibold truncate">{p.name}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">
                  {isLeader ? "Leader" : isMe ? "You" : " "}
                </span>
              </div>
              {selected && <span className="font-bold">✓</span>}
            </button>
          );
        })}
      </div>
      {amLeader && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-base-content/55 tabular-nums">
            {proposal.length}/{view.currentQuestSize} selected
          </div>
          <button
            type="button"
            className="btn btn-primary rounded-full px-6 font-semibold"
            onClick={onSubmit}
            disabled={!ready}
          >
            Propose
          </button>
        </div>
      )}
    </div>
  );
}

function VotePanel({
  view,
  playersById,
  me,
  iHaveVoted,
  myVote,
  onVote,
}: {
  view: AvalonView;
  playersById: Record<string, PlayerLike>;
  me: string;
  iHaveVoted: boolean;
  myVote: "approve" | "reject" | null;
  onVote: (v: "approve" | "reject") => void;
}) {
  const proposed = view.proposedTeam ?? [];
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
        ◆ Vote on the team ◆
      </div>
      <div className="flex flex-wrap gap-1.5">
        {proposed.map((id) => {
          const p = playersById[id] ?? { id, name: id };
          return (
            <span
              key={id}
              className="text-xs px-2.5 py-0.5 rounded-full bg-base-100 border border-base-300 font-semibold"
            >
              {p.name}
            </span>
          );
        })}
      </div>
      <div className="text-xs text-base-content/65">
        Majority approves to send the team; a tie rejects. Five consecutive
        rejections and the spies win.
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-base-content/55 tabular-nums">
          {view.voteTally.voters.length}/{view.playerOrder.length} voted
          {pending.length > 0 && (
            <span className="ml-2 text-base-content/45">
              (waiting: {pending
                .map((id) => playersById[id]?.name ?? id)
                .join(", ")})
            </span>
          )}
        </div>
        {!iHaveVoted ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-info rounded-full px-5 font-semibold"
              onClick={() => onVote("approve")}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-error rounded-full px-5 font-semibold"
              onClick={() => onVote("reject")}
            >
              Reject
            </button>
          </div>
        ) : (
          <div className="text-xs uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Your vote:{" "}
            <span
              style={{
                color:
                  myVote === "approve"
                    ? "var(--color-info)"
                    : "var(--color-error)",
              }}
            >
              {myVote === "approve" ? "Approved" : "Rejected"}
            </span>{" "}
            · waiting for the rest
          </div>
        )}
      </div>
      {view.voteTally.results && (
        <div className="pt-2 mt-1 border-t border-warning/30">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 mb-1.5">
            Revealed votes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {view.playerOrder.map((id) => {
              const v = view.voteTally.results![id];
              const p = playersById[id] ?? { id, name: id };
              return (
                <span
                  key={id}
                  className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background:
                      v === "approve"
                        ? "var(--color-info)"
                        : "var(--color-error)",
                    color:
                      v === "approve"
                        ? "var(--color-info-content)"
                        : "var(--color-error-content)",
                  }}
                  title={p.name}
                >
                  {p.name}: {v === "approve" ? "✓" : "✗"}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestPanel({
  view,
  playersById,
  me,
  iAmOnQuest,
  myRole,
  mySubmittedQuest,
  onSubmit,
}: {
  view: AvalonView;
  playersById: Record<string, PlayerLike>;
  me: string;
  iAmOnQuest: boolean;
  myRole: AvalonRole | null;
  mySubmittedQuest: "success" | "fail" | null;
  onSubmit: (v: "success" | "fail") => void;
}) {
  const team = view.proposedTeam ?? [];
  const needed = view.currentQuestFailsNeeded;
  const mayFail = myRole === "spy";
  return (
    <div
      className="w-full max-w-xl rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: "var(--color-base-100)",
        border: "1px solid var(--color-base-300)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary">
        ◆ Quest underway ◆
      </div>
      <div className="flex flex-wrap gap-1.5">
        {team.map((id) => (
          <span
            key={id}
            className={[
              "text-xs px-2.5 py-0.5 rounded-full font-semibold",
              id === me ? "ring-2 ring-primary" : "",
            ].join(" ")}
            style={{
              background: "var(--color-primary)",
              color: "var(--color-primary-content)",
            }}
          >
            {playersById[id]?.name ?? id}
          </span>
        ))}
      </div>
      <div className="text-xs text-base-content/65">
        {view.questSubmissions}/{team.length} cards played.
        {needed > 1 && (
          <>
            {" "}
            This quest needs{" "}
            <span className="font-semibold text-warning-content">
              {needed} fails
            </span>{" "}
            to fail.
          </>
        )}
      </div>
      {iAmOnQuest ? (
        mySubmittedQuest ? (
          <div className="text-xs uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Card played. Waiting on the rest of the team…
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-success rounded-full px-5 font-semibold"
              onClick={() => onSubmit("success")}
            >
              Success
            </button>
            <button
              type="button"
              className="btn btn-error rounded-full px-5 font-semibold disabled:opacity-40"
              disabled={!mayFail}
              onClick={() => onSubmit("fail")}
              title={mayFail ? "" : "Only spies may play fail"}
            >
              Fail
            </button>
          </div>
        )
      ) : (
        <div className="text-xs uppercase tracking-[0.22em] text-base-content/55">
          Not on the team — waiting for the quest to resolve.
        </div>
      )}
    </div>
  );
}

function MerlinGuessPanel({
  view,
  playersById,
  me,
  onAccuse,
}: {
  view: AvalonView;
  playersById: Record<string, PlayerLike>;
  me: string;
  onAccuse: (target: string) => void;
}) {
  const youGuess = view.viewerIsMerlinGuesser;
  // Valid Merlin targets are non-spies. The guesser (also a spy) sees
  // `knownSpies` as their fellow spies — they and every teammate are excluded.
  const candidates = view.playerOrder.filter(
    (id) => id !== me && !view.knownSpies.includes(id),
  );
  return (
    <div className="w-full max-w-xl rounded-2xl p-5 flex flex-col gap-3 bg-neutral text-neutral-content">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-70">
        ◆ The loyal have won three quests ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-xs)" }}
      >
        {youGuess
          ? "Pick Merlin to snatch the win."
          : "The spies are choosing who they think is Merlin…"}
      </div>
      {youGuess && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {candidates.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onAccuse(id)}
              className="rounded-xl px-3 py-2 bg-base-100 text-base-content border border-base-300 hover:border-primary/50 cursor-pointer transition-colors font-semibold"
            >
              {playersById[id]?.name ?? id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GameOverPanel({
  view,
  playersById,
}: {
  view: AvalonView;
  playersById: Record<string, PlayerLike>;
}) {
  const winner = view.winner;
  if (!winner) return null;
  const label = winner === "loyal" ? "The Loyal win." : "The Spies win.";
  const reasonMap: Record<NonNullable<AvalonView["winReason"]>, string> = {
    loyalQuests: "Three quests succeeded.",
    spyQuests: "Three quests failed.",
    hammerReject: "Five proposals rejected in a row.",
    merlinCaught: "The spies named Merlin.",
    merlinSaved: "The spies guessed wrong — Merlin survived.",
  };
  const reason = view.winReason ? reasonMap[view.winReason] : "";
  const roles = view.allRoles ?? {};
  return (
    <div className="surface-ivory max-w-xl w-full px-6 py-5 flex flex-col gap-3 text-center">
      <div
        className="text-[10px] uppercase tracking-[0.3em] font-semibold"
        style={{
          color:
            winner === "loyal" ? "var(--color-info)" : "var(--color-error)",
        }}
      >
        ◆ Result ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{
          fontSize: "var(--text-display-sm)",
          color:
            winner === "loyal" ? "var(--color-info)" : "var(--color-error)",
        }}
      >
        {label}
      </div>
      <div className="text-sm text-base-content/65">{reason}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left mt-2">
        {view.playerOrder.map((id) => {
          const role = roles[id];
          const name = playersById[id]?.name ?? id;
          const roleLabel: Record<AvalonRole, string> = {
            spy: "Spy",
            merlin: "Merlin",
            loyal: "Loyal",
          };
          const color =
            role === "spy"
              ? "var(--color-error)"
              : role === "merlin"
                ? "var(--color-primary)"
                : "var(--color-info)";
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
      {view.merlinGuess && (
        <div className="text-xs text-base-content/55 mt-1">
          Merlin guess:{" "}
          <span className="font-semibold">
            {playersById[view.merlinGuess]?.name ?? view.merlinGuess}
          </span>
        </div>
      )}
    </div>
  );
}

function AvalonSummary({ view }: SummaryProps<AvalonView>) {
  if (view.phase !== "gameOver" || !view.winner) return null;
  return (
    <div className="surface-ivory max-w-xl mx-auto px-6 py-5 text-center">
      <div
        className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-1"
        style={{
          color:
            view.winner === "loyal"
              ? "var(--color-info)"
              : "var(--color-error)",
        }}
      >
        ◆ Victory ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        <span
          style={{
            color:
              view.winner === "loyal"
                ? "var(--color-info)"
                : "var(--color-error)",
          }}
        >
          {view.winner === "loyal" ? "Loyal servants" : "Spies"}
        </span>{" "}
        take it.
      </div>
    </div>
  );
}

export const avalonClientModule: ClientGameModule<
  AvalonView,
  AvalonMove,
  Record<string, never>
> = {
  type: AVALON_TYPE,
  Board: AvalonBoard,
  Summary: AvalonSummary,
};
