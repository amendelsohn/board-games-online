import { useMemo, useState, type CSSProperties } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import type { PlayerId } from "@bgo/sdk";
import {
  BATTLESHIP_TYPE,
  BOARD_SIZE,
  SHIP_LENGTHS,
  SHIP_TYPES,
  cellIndex,
  shipCells,
  type BattleshipMove,
  type BattleshipView,
  type Board,
  type Orient,
  type Placement,
  type ShipType,
  type Shots,
} from "./shared";

const COLUMN_LABELS = "ABCDEFGHIJ".split("");

const SHIP_DISPLAY: Record<ShipType, string> = {
  carrier: "Carrier",
  battleship: "Battleship",
  cruiser: "Cruiser",
  submarine: "Submarine",
  destroyer: "Destroyer",
};

// Parlor palette for Battleship. Full-strength --color-info read as saturated
// Bootstrap blue and flattened the board; muted "water" is a slate of info
// blended into base-200, and ships are warm graphite instead of cold neutral.
const WATER_BG =
  "color-mix(in oklch, var(--color-info) 22%, var(--color-base-200))";
const SHIP_BG =
  "color-mix(in oklch, var(--color-neutral) 70%, var(--color-base-content) 8%)";
const SHIP_INK =
  "color-mix(in oklch, var(--color-neutral) 55%, var(--color-base-content) 25%)";

function MissDot() {
  return (
    <span
      className="absolute inset-0 flex items-center justify-center"
      style={{
        color: "var(--color-base-content)",
        opacity: 0.45,
        fontSize: "0.9em",
      }}
      aria-hidden
    >
      •
    </span>
  );
}

function HitMark() {
  return (
    <span
      className="absolute inset-0 flex items-center justify-center battleship-hit-pop"
      aria-hidden
    >
      <span
        className="absolute inset-[2px] rounded-[2px]"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--color-error) 90%, white 10%), var(--color-error) 65%, color-mix(in oklch, var(--color-error) 80%, black 20%))",
          boxShadow:
            "0 0 0 1px color-mix(in oklch, var(--color-error) 40%, transparent), 0 0 10px color-mix(in oklch, var(--color-error) 45%, transparent)",
        }}
      />
      <span
        className="relative text-[0.75em] font-black leading-none"
        style={{
          color: "color-mix(in oklch, var(--color-error-content) 70%, white 30%)",
          textShadow: "0 1px 0 oklch(0% 0 0 / 0.45)",
        }}
      >
        ✕
      </span>
    </span>
  );
}

const BATTLESHIP_KEYFRAMES = `
@keyframes battleship-hit-pop {
  0%   { transform: scale(0.55); opacity: 0; }
  55%  { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}
.battleship-hit-pop { animation: battleship-hit-pop 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .battleship-hit-pop { animation: none; }
}
`;

function BattleshipBoard(
  props: BoardProps<BattleshipView, BattleshipMove>,
) {
  const { view, phase } = props;

  const body =
    phase === "placing" || view.phase === "placing" ? (
      <PlacementView {...props} />
    ) : (
      <FiringView {...props} />
    );

  return (
    <>
      <style>{BATTLESHIP_KEYFRAMES}</style>
      {body}
    </>
  );
}

// =======================================================================
// Placement phase
// =======================================================================

type PlacementMap = Partial<Record<ShipType, { row: number; col: number; orient: Orient }>>;

function PlacementView({
  view,
  me,
  sendMove,
}: BoardProps<BattleshipView, BattleshipMove>) {
  const [selected, setSelected] = useState<ShipType | null>("carrier");
  const [orient, setOrient] = useState<Orient>("h");
  const [placements, setPlacements] = useState<PlacementMap>({});
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mySide = view.sides[me];
  const alreadyLocked = view.placed[me] === true;

  // Which cells are currently occupied by already-placed ships.
  const occupied = useMemo(() => {
    const set = new Set<number>();
    for (const ship of SHIP_TYPES) {
      const p = placements[ship];
      if (!p) continue;
      const cells = shipCells(p.row, p.col, SHIP_LENGTHS[ship], p.orient);
      if (!cells) continue;
      for (const { row, col } of cells) set.add(cellIndex(row, col));
    }
    return set;
  }, [placements]);

  // Preview cells for the currently-selected ship at hover, along with validity.
  const preview = useMemo(() => {
    if (!selected || !hover) return null;
    const cells = shipCells(
      hover.row,
      hover.col,
      SHIP_LENGTHS[selected],
      orient,
    );
    if (!cells) return { cells: null, ok: false };
    const occupiedWithoutSelected = new Set<number>();
    for (const ship of SHIP_TYPES) {
      if (ship === selected) continue;
      const p = placements[ship];
      if (!p) continue;
      const c = shipCells(p.row, p.col, SHIP_LENGTHS[ship], p.orient);
      if (!c) continue;
      for (const { row, col } of c) {
        occupiedWithoutSelected.add(cellIndex(row, col));
      }
    }
    const ok = cells.every(
      ({ row, col }) => !occupiedWithoutSelected.has(cellIndex(row, col)),
    );
    return { cells, ok };
  }, [hover, selected, orient, placements]);

  const clickCell = (row: number, col: number) => {
    if (!selected || alreadyLocked) return;
    const cells = shipCells(row, col, SHIP_LENGTHS[selected], orient);
    if (!cells) {
      setError(`${SHIP_DISPLAY[selected]} doesn't fit there`);
      return;
    }
    const occupiedWithoutSelected = new Set<number>();
    for (const ship of SHIP_TYPES) {
      if (ship === selected) continue;
      const p = placements[ship];
      if (!p) continue;
      const c = shipCells(p.row, p.col, SHIP_LENGTHS[ship], p.orient);
      if (!c) continue;
      for (const { row, col } of c) {
        occupiedWithoutSelected.add(cellIndex(row, col));
      }
    }
    const overlap = cells.some(({ row, col }) =>
      occupiedWithoutSelected.has(cellIndex(row, col)),
    );
    if (overlap) {
      setError(`${SHIP_DISPLAY[selected]} would overlap another ship`);
      return;
    }
    setError(null);
    setPlacements({
      ...placements,
      [selected]: { row, col, orient },
    });
    // Auto-advance to the next unplaced ship for faster setup.
    const next = SHIP_TYPES.find(
      (s) => s !== selected && !placements[s],
    );
    setSelected(next ?? null);
  };

  const removeShip = (ship: ShipType) => {
    if (alreadyLocked) return;
    const next = { ...placements };
    delete next[ship];
    setPlacements(next);
    setSelected(ship);
  };

  const allPlaced = SHIP_TYPES.every((s) => placements[s]);

  const confirm = async () => {
    if (!allPlaced || alreadyLocked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const list: Placement[] = SHIP_TYPES.map((ship) => {
        const p = placements[ship]!;
        return { ship, row: p.row, col: p.col, orient: p.orient };
      });
      await sendMove({ kind: "place", placements: list });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit fleet");
    } finally {
      setSubmitting(false);
    }
  };

  const randomize = () => {
    if (alreadyLocked) return;
    // Simple deterministic-enough randomizer for client convenience.
    // This is ONLY the local UI; the server validates the final fleet.
    for (let attempt = 0; attempt < 200; attempt++) {
      const next: PlacementMap = {};
      const occ = new Set<number>();
      let good = true;
      for (const ship of SHIP_TYPES) {
        let placed = false;
        for (let tries = 0; tries < 100; tries++) {
          const o: Orient = Math.random() < 0.5 ? "h" : "v";
          const r = Math.floor(Math.random() * BOARD_SIZE);
          const c = Math.floor(Math.random() * BOARD_SIZE);
          const cells = shipCells(r, c, SHIP_LENGTHS[ship], o);
          if (!cells) continue;
          if (cells.some(({ row, col }) => occ.has(cellIndex(row, col)))) {
            continue;
          }
          for (const { row, col } of cells) occ.add(cellIndex(row, col));
          next[ship] = { row: r, col: c, orient: o };
          placed = true;
          break;
        }
        if (!placed) {
          good = false;
          break;
        }
      }
      if (good) {
        setPlacements(next);
        setSelected(null);
        setError(null);
        return;
      }
    }
  };

  if (alreadyLocked) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
          Fleet locked in
        </div>
        <FleetGrid
          board={mySide?.board ?? null}
          preview={null}
          incoming={mySide?.incoming ?? []}
          hover={null}
          setHover={() => {}}
          onClickCell={() => {}}
          placementSelection={null}
        />
        <div className="text-sm text-base-content/65">
          Waiting for opponent to place their fleet…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        Place your fleet
      </div>

      <div className="flex flex-col md:flex-row items-start gap-6 w-full justify-center">
        <FleetGrid
          board={null}
          preview={
            preview && preview.cells
              ? { cells: preview.cells, ok: preview.ok }
              : null
          }
          placementSelection={placements}
          incoming={[]}
          hover={hover}
          setHover={setHover}
          onClickCell={clickCell}
        />

        <div className="flex flex-col gap-3 min-w-[14rem]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
              Ships
            </span>
            <div
              role="radiogroup"
              aria-label="Ship orientation"
              className="inline-flex rounded-full p-[2px] border border-base-300/70 bg-base-100"
            >
              {(
                [
                  { key: "h" as Orient, label: "Horiz", glyph: "↔" },
                  { key: "v" as Orient, label: "Vert", glyph: "↕" },
                ]
              ).map(({ key, label, glyph }) => {
                const active = orient === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setOrient(key)}
                    className={[
                      "flex items-center gap-1 rounded-full px-2.5 py-1",
                      "text-[11px] font-semibold uppercase tracking-wider",
                      "transition-colors",
                      active
                        ? "bg-primary text-primary-content shadow-sm"
                        : "text-base-content/60 hover:text-base-content/90",
                    ].join(" ")}
                  >
                    <span aria-hidden className="text-[0.95em] leading-none">
                      {glyph}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {selected && !placements[selected] && !hover && (
            <div
              className="text-[11px] leading-snug text-base-content/70 rounded-md px-2.5 py-1.5"
              style={{
                background:
                  "color-mix(in oklch, var(--color-primary) 8%, transparent)",
                border:
                  "1px dashed color-mix(in oklch, var(--color-primary) 35%, transparent)",
              }}
            >
              Tap a cell to place your{" "}
              <span className="font-semibold">{SHIP_DISPLAY[selected]}</span> (
              {SHIP_LENGTHS[selected]}).
            </div>
          )}

          {SHIP_TYPES.map((ship) => {
            const placed = Boolean(placements[ship]);
            const isSel = selected === ship;
            return (
              <div
                key={ship}
                className={[
                  "flex items-center gap-3 px-3 py-2 rounded-lg",
                  "border transition-colors",
                  isSel
                    ? "border-primary bg-primary/10"
                    : placed
                      ? "border-success/40 bg-success/5"
                      : "border-base-300/70 bg-base-100",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => setSelected(ship)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <span>{SHIP_DISPLAY[ship]}</span>
                    <span className="text-base-content/45 font-mono text-[11px] tabular-nums">
                      ({SHIP_LENGTHS[ship]})
                    </span>
                  </div>
                  <div className="flex gap-[3px] mt-1.5">
                    {Array.from({ length: SHIP_LENGTHS[ship] }).map((_, i) => (
                      <span
                        key={i}
                        className="h-3 w-6 rounded-[3px]"
                        style={{
                          background: placed
                            ? "color-mix(in oklch, var(--color-success) 70%, var(--color-base-content) 10%)"
                            : "color-mix(in oklch, var(--color-base-content) 60%, transparent)",
                          opacity: placed ? 0.9 : 0.55,
                          boxShadow:
                            "inset 0 1px 0 oklch(100% 0 0 / 0.15), inset 0 -1px 0 oklch(0% 0 0 / 0.18)",
                        }}
                      />
                    ))}
                  </div>
                </button>
                {placed && (
                  <button
                    type="button"
                    onClick={() => removeShip(ship)}
                    className="text-xs text-base-content/50 hover:text-error"
                    aria-label={`remove ${ship}`}
                  >
                    reset
                  </button>
                )}
              </div>
            );
          })}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={randomize}
              className="btn btn-sm btn-ghost rounded-full flex-1"
            >
              Randomize
            </button>
            <button
              type="button"
              disabled={!allPlaced || submitting}
              onClick={confirm}
              className="btn btn-sm btn-primary rounded-full flex-1 font-semibold"
            >
              Ready
            </button>
          </div>

          {error && (
            <div className="text-xs text-error">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// =======================================================================
// Firing phase
// =======================================================================

function FiringView({
  view,
  me,
  isMyTurn,
  sendMove,
  players,
}: BoardProps<BattleshipView, BattleshipMove>) {
  const [error, setError] = useState<string | null>(null);
  const isOver = view.phase === "gameOver";
  const opp = view.players.find((p) => p !== me) ?? view.players[1];
  const mySide = view.sides[me];
  const oppSide = opp ? view.sides[opp] : undefined;

  // The marks on the opponent's "incoming" array are exactly the shots I've
  // fired onto them — that's what we render on the attack grid.
  const attackMarks = oppSide?.incoming ?? [];

  const nameFor = (id: PlayerId) =>
    players.find((p) => p.id === id)?.name ?? "Player";

  const fireOnCell = async (row: number, col: number) => {
    if (!isMyTurn || isOver) return;
    const idx = cellIndex(row, col);
    if (attackMarks[idx]) return;
    setError(null);
    try {
      await sendMove({ kind: "fire", row, col });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shot failed");
    }
  };

  const statusLine = (() => {
    if (isOver) {
      if (view.winner === me) return "Victory. Enemy fleet destroyed.";
      if (view.winner) return `${nameFor(view.winner)} won.`;
      return "Game over.";
    }
    if (isMyTurn) return "Your turn — pick a cell on the enemy grid.";
    return `Waiting on ${nameFor(view.current)}…`;
  })();

  const lastShotLine = (() => {
    const ls = view.lastShot;
    if (!ls) return null;
    const who = ls.by === me ? "You" : nameFor(ls.by);
    const coord = `${COLUMN_LABELS[ls.col]}${ls.row + 1}`;
    if (ls.result === "miss") return `${who} fired ${coord} — miss.`;
    if (ls.sunk) {
      return `${who} fired ${coord} — hit and sunk the ${SHIP_DISPLAY[ls.sunk]}!`;
    }
    return `${who} fired ${coord} — hit!`;
  })();

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        {statusLine}
      </div>
      {lastShotLine && (
        <div className="text-sm text-base-content/65">{lastShotLine}</div>
      )}

      <div className="flex flex-col lg:flex-row items-start gap-6 justify-center w-full">
        {/* Your fleet */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/55 font-semibold">
            Your fleet
          </div>
          <FleetGrid
            board={mySide?.board ?? null}
            incoming={mySide?.incoming ?? []}
            preview={null}
            placementSelection={null}
            hover={null}
            setHover={() => {}}
            onClickCell={() => {}}
            compact
          />
          <FleetStatus side={mySide} showSunkOnly={false} />
        </div>

        {/* Opponent */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/55 font-semibold">
            {nameFor(opp!)}'s waters
          </div>
          <AttackGrid
            marks={attackMarks}
            clickable={isMyTurn && !isOver}
            onFire={fireOnCell}
            revealedBoard={isOver ? oppSide?.board ?? null : null}
          />
          <FleetStatus side={oppSide} showSunkOnly={!isOver} />
        </div>
      </div>

      {error && <div className="text-xs text-error">{error}</div>}
    </div>
  );
}

// =======================================================================
// Grid components
// =======================================================================

function cellSize(_compact?: boolean) {
  // Cells keep their aspect ratio regardless of viewport width; the grid
  // wrapper caps the outer size so we never blow up on desktop.
  return "aspect-square w-full";
}

function gridWrapperStyle(compact?: boolean): CSSProperties {
  // Cap the rendered grid width so 11 × aspect-square cells stay crisp.
  // compact = "your fleet" mini-grid in combat; larger = placement + attack.
  return {
    width: "100%",
    maxWidth: compact ? "17rem" : "22rem",
  };
}

function Gutters({ compact }: { compact?: boolean }) {
  const size = cellSize(compact);
  return (
    <>
      <div className={`${size} opacity-0`} aria-hidden />
      {COLUMN_LABELS.map((ch) => (
        <div
          key={ch}
          className={`${size} flex items-center justify-center text-[10px] uppercase tracking-wider text-base-content/45 font-semibold`}
        >
          {ch}
        </div>
      ))}
    </>
  );
}

function FleetGrid({
  board,
  incoming,
  preview,
  placementSelection,
  hover,
  setHover,
  onClickCell,
  compact,
}: {
  board: Board | null;
  incoming: Shots;
  preview: { cells: { row: number; col: number }[]; ok: boolean } | null;
  placementSelection: PlacementMap | null;
  hover: { row: number; col: number } | null;
  setHover: (h: { row: number; col: number } | null) => void;
  onClickCell: (row: number, col: number) => void;
  compact?: boolean;
}) {
  const size = cellSize(compact);
  const previewSet = useMemo(() => {
    if (!preview || !preview.cells) return new Set<number>();
    return new Set(preview.cells.map((c) => cellIndex(c.row, c.col)));
  }, [preview]);

  const localOccupied = useMemo(() => {
    if (!placementSelection) return new Set<number>();
    const s = new Set<number>();
    for (const ship of SHIP_TYPES) {
      const p = placementSelection[ship];
      if (!p) continue;
      const cells = shipCells(p.row, p.col, SHIP_LENGTHS[ship], p.orient);
      if (!cells) continue;
      for (const { row, col } of cells) s.add(cellIndex(row, col));
    }
    return s;
  }, [placementSelection]);

  return (
    <div
      className="rounded-xl p-2"
      style={{
        ...gridWrapperStyle(compact),
        background: "color-mix(in oklch, var(--color-base-300) 70%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.08)",
      }}
    >
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE + 1}, minmax(0, 1fr))` }}
      >
        <Gutters compact={compact} />
        {Array.from({ length: BOARD_SIZE }).map((_, row) => (
          <FleetRow
            key={row}
            row={row}
            size={size}
            board={board}
            incoming={incoming}
            preview={preview}
            previewSet={previewSet}
            localOccupied={localOccupied}
            hover={hover}
            setHover={setHover}
            onClickCell={onClickCell}
          />
        ))}
      </div>
    </div>
  );
}

function FleetRow({
  row,
  size,
  board,
  incoming,
  preview,
  previewSet,
  localOccupied,
  setHover,
  onClickCell,
}: {
  row: number;
  size: string;
  board: Board | null;
  incoming: Shots;
  preview: { cells: { row: number; col: number }[]; ok: boolean } | null;
  previewSet: Set<number>;
  localOccupied: Set<number>;
  hover: { row: number; col: number } | null;
  setHover: (h: { row: number; col: number } | null) => void;
  onClickCell: (row: number, col: number) => void;
}) {
  return (
    <>
      <div
        className={`${size} flex items-center justify-center text-[10px] tabular-nums text-base-content/45 font-semibold`}
      >
        {row + 1}
      </div>
      {Array.from({ length: BOARD_SIZE }).map((_, col) => {
        const idx = cellIndex(row, col);
        const shipHere = board ? board[idx] : null;
        const selectionHere = localOccupied.has(idx);
        const incomingMark = incoming[idx] ?? null;
        const isPreview = previewSet.has(idx);
        const previewOk = preview?.ok === true;

        let bg = WATER_BG;
        let showShip = false;
        if (shipHere || selectionHere) {
          bg = SHIP_BG;
          showShip = true;
        }
        if (isPreview) {
          bg = previewOk
            ? `color-mix(in oklch, var(--color-success) 45%, ${WATER_BG})`
            : `color-mix(in oklch, var(--color-error) 45%, ${WATER_BG})`;
        }
        return (
          <button
            key={col}
            type="button"
            onMouseEnter={() => setHover({ row, col })}
            onMouseLeave={() => setHover(null)}
            onClick={() => onClickCell(row, col)}
            className={[
              size,
              "relative rounded-[3px] transition-colors",
              "focus:outline-none",
            ].join(" ")}
            style={{
              background: bg,
              boxShadow:
                "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.14)",
            }}
            aria-label={`${COLUMN_LABELS[col]}${row + 1}`}
          >
            {showShip && (
              <span
                className="absolute inset-[2px] rounded-[2px]"
                style={{
                  background: SHIP_INK,
                }}
              />
            )}
            {incomingMark === "miss" && <MissDot />}
            {incomingMark === "hit" && <HitMark />}
          </button>
        );
      })}
    </>
  );
}

function AttackGrid({
  marks,
  clickable,
  onFire,
  revealedBoard,
}: {
  marks: Shots;
  clickable: boolean;
  onFire: (row: number, col: number) => void;
  revealedBoard: Board | null;
}) {
  const size = cellSize(false);
  return (
    <div
      className="rounded-xl p-2"
      style={{
        ...gridWrapperStyle(false),
        background: "color-mix(in oklch, var(--color-base-300) 70%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.08)",
      }}
    >
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE + 1}, minmax(0, 1fr))` }}
      >
        <Gutters />
        {Array.from({ length: BOARD_SIZE }).map((_, row) => (
          <AttackRow
            key={row}
            row={row}
            size={size}
            marks={marks}
            clickable={clickable}
            onFire={onFire}
            revealedBoard={revealedBoard}
          />
        ))}
      </div>
    </div>
  );
}

function AttackRow({
  row,
  size,
  marks,
  clickable,
  onFire,
  revealedBoard,
}: {
  row: number;
  size: string;
  marks: Shots;
  clickable: boolean;
  onFire: (row: number, col: number) => void;
  revealedBoard: Board | null;
}) {
  return (
    <>
      <div
        className={`${size} flex items-center justify-center text-[10px] tabular-nums text-base-content/45 font-semibold`}
      >
        {row + 1}
      </div>
      {Array.from({ length: BOARD_SIZE }).map((_, col) => {
        const idx = cellIndex(row, col);
        const mark = marks[idx];
        const hasShip = revealedBoard ? revealedBoard[idx] !== null : false;
        const disabled = !clickable || mark !== null;

        let bg = WATER_BG;
        if (revealedBoard && hasShip && mark !== "hit") {
          bg = `color-mix(in oklch, ${SHIP_BG} 70%, ${WATER_BG})`;
        }

        return (
          <button
            key={col}
            type="button"
            disabled={disabled}
            onClick={() => onFire(row, col)}
            className={[
              size,
              "relative rounded-[3px] transition-all",
              clickable && mark === null
                ? "hover:scale-[1.08] cursor-crosshair"
                : "cursor-default",
            ].join(" ")}
            style={{
              background: bg,
              boxShadow:
                "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.14)",
            }}
            aria-label={`fire on ${COLUMN_LABELS[col]}${row + 1}`}
          >
            {mark === "miss" && <MissDot />}
            {mark === "hit" && <HitMark />}
          </button>
        );
      })}
    </>
  );
}

function FleetStatus({
  side,
  showSunkOnly,
}: {
  side: BattleshipView["sides"][string] | undefined;
  showSunkOnly: boolean;
}) {
  if (!side) return null;
  const ships = side.ships;
  if (!ships) {
    // Hidden fleet — show a summary row: N of 5 sunk.
    return (
      <div className="text-[11px] text-base-content/55 tracking-wide">
        {side.sunkCount} / {SHIP_TYPES.length} sunk
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5 justify-center max-w-[22rem]">
      {ships.map((s) => {
        if (showSunkOnly && !s.sunk) return null;
        return (
          <span
            key={s.ship}
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              background: s.sunk
                ? "color-mix(in oklch, var(--color-error) 20%, transparent)"
                : "color-mix(in oklch, var(--color-neutral) 20%, transparent)",
              color: s.sunk
                ? "var(--color-error)"
                : "var(--color-base-content)",
              textDecoration: s.sunk ? "line-through" : undefined,
              opacity: s.sunk ? 1 : 0.75,
            }}
          >
            {SHIP_DISPLAY[s.ship]} · {s.hits}/{s.length}
          </span>
        );
      })}
    </div>
  );
}

export const battleshipClientModule: ClientGameModule<
  BattleshipView,
  BattleshipMove,
  Record<string, never>
> = {
  type: BATTLESHIP_TYPE,
  Board: BattleshipBoard,
};
