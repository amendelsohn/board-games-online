# @bgo/web — E2E tests

Playwright smoke harness for the web client. Boots the server + web dev
servers via `playwright.config.ts` and drives them through a real Chromium
browser.

## Running locally

From the repo root:

```bash
# One-time: install Chromium + system deps (Linux may need sudo).
pnpm test:e2e:install

# Run the suite.
pnpm test:e2e
```

Or directly against the web package:

```bash
pnpm --filter @bgo/web test:e2e
pnpm --filter @bgo/web test:e2e:ui   # interactive mode
```

The config auto-starts `@bgo/server` on `:8080` and `@bgo/web` on `:3000`
using `reuseExistingServer: true`, so running `pnpm dev` in a separate
shell before the tests is faster and avoids the NestJS boot cost.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Base URL the web client hits. Override when pointing tests at a non-default server port. |
| `PLAYWRIGHT_BASE_URL` | `http://localhost:3000` | Base URL Playwright navigates to. |
| `CI` | unset | When set, retries each test twice. |

## Specs

| File | Covers |
| --- | --- |
| `home.spec.ts` | Hero renders, catalog has ≥10 cards, join-code input present. |
| `debug-table.spec.ts` | Dev-only debug-seat flow: home → `/play/:matchId` → board renders + accepts a move. |
| `invalid-join.spec.ts` | Join-code format validation surfaces an inline error. |
| `tictactoe-match.spec.ts` | Two-browser critical path: host + guest play a full match to a terminal outcome. |
| `rematch.spec.ts` | Rematch loop returns both players to the lobby with a clean table. |

## Adding a new spec

- Prefer `data-testid` selectors over brittle text for per-game hooks
  (e.g. `ttt-cell-3`). Use role-based selectors (`getByRole("button", …)`)
  for generic chrome.
- Tests must be idempotent. The monorepo's match store is in-memory, so
  each test creates its own table — don't rely on cross-test state.
- Keep specs under ~30 seconds each; aggregate suite runtime should
  stay under 3 minutes in CI.

## Debugging a failed run

- `playwright-report/` is generated at the web package root — open
  `index.html` locally for traces + screenshots.
- `trace: "on-first-retry"` means the first attempt is lightweight;
  inspect the retry's `.zip` trace for the interesting state.
- When tests hang waiting for the dev servers, check both ports:
  `curl -sS http://localhost:8080/games` and
  `curl -sS http://localhost:3000/`.
