"use client";

import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BOTC_TYPE,
  type BotCMove,
  type BotCView,
} from "./shared";

/**
 * Phase 1 skeleton client. The real Town Square / Grimoire UI lands in
 * commits 5+; for now we render placeholders that prove the view-shape
 * dispatch works end-to-end.
 */
function BotCBoard({ view }: BoardProps<BotCView, BotCMove>) {
  if (view.viewer === "storyteller") {
    return <StorytellerPlaceholder view={view} />;
  }
  if (view.viewer === "spectator") {
    return <SpectatorPlaceholder view={view} />;
  }
  return <PlayerPlaceholder view={view} />;
}

function StorytellerPlaceholder({
  view,
}: {
  view: Extract<BotCView, { viewer: "storyteller" }>;
}) {
  const seatCount = view.state.seatOrder.length;
  return (
    <div className="surface-ivory p-6 max-w-xl w-full flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          Storyteller view · script {view.state.scriptId}
        </span>
        <h2 className="font-display text-2xl tracking-tight">Grimoire</h2>
      </header>
      <p className="text-sm text-base-content/65 leading-relaxed">
        {seatCount} {seatCount === 1 ? "seat" : "seats"} at the table. Phase:{" "}
        <span className="font-mono text-base-content/85">{view.state.phase}</span>
        . The full Grimoire UI (character assignment, night order, reminder
        tokens, voting) is still under construction.
      </p>
    </div>
  );
}

function PlayerPlaceholder({
  view,
}: {
  view: Extract<BotCView, { viewer: "player" }>;
}) {
  return (
    <div className="surface-ivory p-6 max-w-md w-full flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          Town square
        </span>
        <h2 className="font-display text-2xl tracking-tight">
          {view.me ? "Your seat" : "Watching"}
        </h2>
      </header>
      <p className="text-sm text-base-content/65 leading-relaxed">
        Phase:{" "}
        <span className="font-mono text-base-content/85">{view.phase}</span>.
        {view.me?.characterId
          ? ` You are the ${view.me.characterId}.`
          : " The Storyteller will assign your character shortly."}
      </p>
    </div>
  );
}

function SpectatorPlaceholder({
  view,
}: {
  view: Extract<BotCView, { viewer: "spectator" }>;
}) {
  return (
    <div className="surface-ivory p-6 max-w-md w-full flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          Spectating
        </span>
        <h2 className="font-display text-2xl tracking-tight">Town square</h2>
      </header>
      <p className="text-sm text-base-content/65 leading-relaxed">
        Phase:{" "}
        <span className="font-mono text-base-content/85">{view.phase}</span>.
        Roles and Grimoire reveal at the end of the match.
      </p>
    </div>
  );
}

export const bloodClocktowerClientModule: ClientGameModule<
  BotCView,
  BotCMove,
  unknown
> = {
  type: BOTC_TYPE,
  Board: BotCBoard,
};
