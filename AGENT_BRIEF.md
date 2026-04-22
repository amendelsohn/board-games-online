# Builder / Reviewer Agent Brief — board-games-online

You are adding a new game module to this monorepo. Read this brief end-to-end
before doing anything. It captures the SDK surface and every place a new game
must be wired in. Follow the existing games exactly — consistency matters more
than cleverness.

## 1. Monorepo shape

```
packages/
  sdk/                 — server-side SDK: GameModule, GameContext, types
  sdk-client/          — client-side SDK: ClientGameModule, BoardProps
  contracts/           — zod schemas shared between client & server (don't edit)
  server/              — NestJS backend; registers server modules
  web/                 — Next.js frontend; registers client modules
  games-tictactoe/     — reference: simple 2-player, no config
  games-connectfour/   — reference: simple 2-player
  games-spyfall/       — reference: hidden info + timer
  games-codenames/     — reference: team game + hidden info
```

Every game is a self-contained workspace package named `@bgo/games-<slug>`
with this layout:

```
packages/games-<slug>/
  package.json         — copy from games-tictactoe, change name
  tsconfig.json        — copy from games-tictactoe verbatim
  src/
    shared.ts          — zod move schema, state + view types, config, TYPE const
    server.ts          — exports <camelCase>ServerModule: GameModule<S,M,Cfg,V>
    client.tsx         — exports <camelCase>ClientModule: ClientGameModule
```

## 2. SDK contracts you must implement

From `@bgo/sdk`:

```ts
interface GameModule<S, M, Cfg, V> {
  type: string;               // kebab-case, matches folder slug
  displayName: string;
  description: string;        // one sentence, shown on home page
  minPlayers: number;
  maxPlayers: number;
  defaultConfig(): Cfg;
  validateConfig(cfg: unknown): Cfg;   // throw to reject
  createInitialState(players: Player[], cfg: Cfg, ctx: GameContext): S;
  handleMove(state: S, move: M, actor: PlayerId, ctx: GameContext): MoveResult<S>;
  onTimer?(state: S, key: string, ctx: GameContext): MoveResult<S>;
  view(state: S, viewer: Viewer): V;   // THE projection boundary; strip hidden info here
  phase(state: S): PhaseId;
  currentActors(state: S): PlayerId[]; // [] if nobody / simultaneous
  isTerminal(state: S): boolean;
  outcome(state: S): Outcome | null;
}
```

`MoveResult<S>` is `{ ok: true; state: S; events?: GameEvent[] } | { ok: false; reason: string }`.

`Outcome` is one of:
- `{ kind: "solo"; winners: PlayerId[]; losers: PlayerId[] }`
- `{ kind: "team"; winningTeam: string; losingTeams: string[] }`
- `{ kind: "draw" }`

`Viewer` is `PlayerId | "spectator"`. In `view()`, **always** strip hidden
info for anyone who shouldn't see it. Spectators typically get the same view
as the least-informed player, or a fully public projection.

`GameContext` provides:
- `ctx.rng()` — deterministic; **never call Math.random**
- `ctx.now` — wall clock (ms); **never call Date.now**
- `ctx.scheduleTimer(key, atMs)` / `ctx.cancelTimer(key)` — fires `onTimer`
- `ctx.emit(event)` — side-channel, not part of state

From `@bgo/sdk-client`:

```ts
interface ClientGameModule<V, M, Cfg> {
  type: string;
  Board: ComponentType<BoardProps<V, M>>;
  LobbyPanel?: ComponentType<LobbyPanelProps<Cfg>>;  // optional
  Summary?: ComponentType<SummaryProps<V>>;          // optional
}

interface BoardProps<V, M> {
  view: V; phase: PhaseId; me: PlayerId;
  players: Player[]; isMyTurn: boolean;
  sendMove: (m: M) => Promise<void>;
  onEvent: (listener: (e: GameEvent) => void) => () => void;
  latencyMs: number;
}
```

## 3. Files you MUST update to register your game

After creating `packages/games-<slug>/`, wire it in:

**a. `packages/server/src/games/register-games.ts`** — add import and
`registry.register(...)` call.

**b. `packages/web/src/lib/registerClientGames.ts`** — add import and
`registerClientModule(...)` call.

**c. `packages/web/package.json`** — add `"@bgo/games-<slug>": "workspace:*"`
to dependencies, keeping alphabetical order.

**d. `packages/web/src/components/GameIcon.tsx`** — add an `if (type === "<slug>")`
branch returning a distinctive SVG glyph. Use `var(--color-primary)` etc. so
it themes correctly. Don't just do a rounded box — give it personality.

## 4. Running and testing

From repo root:

```bash
pnpm install                # if you added a new package
pnpm -w -r build            # builds all packages; run this before calling done
pnpm --filter @bgo/games-<slug> typecheck   # your package only
```

The web app's homepage queries `GET /games` at runtime, so no homepage code
change is needed — the game will appear as a card automatically once it's
registered on the server and has an entry in `GameIcon.tsx`.

## 5. Style & conventions (match existing games)

- **Zod schemas** for move validation in `shared.ts`. Use discriminated unions
  for multi-kind moves: `z.discriminatedUnion("kind", [...])`.
- **Deterministic RNG**: `ctx.rng()`, `shuffle(arr, ctx.rng)`, `pickOne(arr, ctx.rng)`.
- **Never ship full state to the client**: the `view()` function is the
  projection boundary. Hidden-info games must redact per viewer.
- **Immutable updates**: `const cells = state.cells.slice()` then mutate copy.
- **Turn passing**: compute next actor in `handleMove`, store in state.
- **Terminal**: `isTerminal(state)` must be true iff `outcome(state)` is non-null.
- **No backwards-compat cruft**, no TODO comments, no placeholder / stub moves.
- **Comments**: only for non-obvious *why*. Don't narrate the code.
- **Client visuals**: Tailwind v4 + daisyUI 5; use `var(--color-primary)`,
  `var(--color-secondary)`, `var(--color-base-100..300)`, `var(--color-success)`,
  etc. Look at `games-tictactoe/src/client.tsx` and `games-connectfour/src/client.tsx`
  for the idiom. Don't import arbitrary UI libraries.
- **Class helper**: `parlor-rise`, `parlor-fade`, `parlor-win`, `font-display`
  are defined globally — optional but fit the look.

## 6. Don't

- Don't edit `packages/sdk/`, `packages/sdk-client/`, `packages/contracts/`,
  `packages/server/` (except `register-games.ts`), or any existing game package.
- Don't call `Math.random` or `Date.now` inside the game module.
- Don't add features that weren't part of the game's rules (variants, chat,
  reactions, etc.) unless your spec calls for them.
- Don't leave `any` in public types. Use real types.
- Don't write tests unless the spec explicitly asks — the repo has no
  game-module test suite yet, and we'll standardize that later.

## 7. Definition of done (builder)

- [ ] New package compiles: `pnpm --filter @bgo/games-<slug> build` succeeds
- [ ] Full workspace compiles: `pnpm -w -r build` succeeds with no errors
- [ ] Game appears at `/games` when server runs (verify via registry list)
- [ ] `GameIcon.tsx` has a dedicated case for the new game type
- [ ] No changes to unrelated files
- [ ] Branch is committed with a conventional message: `add <Display Name> — <one-line rationale>`

## 8. Reviewer checklist (adversarial review)

- [ ] `view()` never leaks hidden info to players who shouldn't see it
- [ ] `handleMove` rejects invalid moves with a helpful `reason`
- [ ] `handleMove` rejects out-of-turn moves
- [ ] Terminal states are handled: `isTerminal` ↔ `outcome !== null`
- [ ] Rules match standard play (no invented variants)
- [ ] No `Math.random` / `Date.now` anywhere in the game package
- [ ] Registrations added in all four places (§3)
- [ ] `pnpm -w -r build` is clean
- [ ] Client component doesn't crash on initial render, unknown phase, or
      terminal state
- [ ] Icon is distinctive (not just a letter in a box)
