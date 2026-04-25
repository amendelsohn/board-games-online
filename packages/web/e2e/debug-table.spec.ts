import { test, expect } from "@playwright/test";

/**
 * End-to-end happy path using the dev-only "fully-seated debug table"
 * flow on the home page. One browser, one click: the debug button
 * creates a table, fills all seats with fake players, and starts the
 * match — so we land on /play directly.
 *
 * This stays out of the tic-tac-toe-match spec's lane (which exercises
 * two real browser contexts over WebSockets). Here we just prove the
 * board mounts and accepts a move.
 *
 * Dev flow only: if the server ever disables the dev routes in
 * production, this test will fail fast at the debug button — a clear
 * signal, not a flaky symptom.
 */
test("debug-seat flow takes a player from home to a live tic-tac-toe board", async ({
  page,
}) => {
  await page.goto("/");

  // Give the player a name so the session gets a sensible label.
  await page
    .getByPlaceholder(/how should others see you/i)
    .fill("Smoke Player");

  // The dev-only debug button is tagged per game type; it kicks off
  // the one-click fill + start flow documented in startDebugGame.
  const debugBtn = page.getByTestId("debug-tic-tac-toe");
  await expect(debugBtn).toBeVisible({ timeout: 15_000 });
  await debugBtn.click();

  // Debug flow lands directly on /play/:matchId (not /lobby).
  await page.waitForURL(/\/play\/[^/?]+/, { timeout: 20_000 });

  // Wait for the board to mount. Tic-tac-toe renders 9 cells with
  // stable test-ids; if even one is there the board is alive.
  const cell0 = page.getByTestId("ttt-cell-0");
  await expect(cell0).toBeVisible({ timeout: 15_000 });

  // The player-symbol banner appears once the view is populated —
  // good proxy for "the websocket connected and state arrived".
  await expect(page.locator("text=/^You play as/i").first()).toBeVisible({
    timeout: 15_000,
  });

  // If the player goes first, play the first move and verify the cell
  // flips to X or O. Debug seats play deterministically but the host's
  // X/O assignment is random, so if it's not our turn we still pass —
  // the board rendering is the real signal here.
  const cell4 = page.getByTestId("ttt-cell-4");
  if (await cell4.isEnabled()) {
    await cell4.click();
    await expect(cell4).toHaveText(/^[XO]$/, { timeout: 5_000 });
  }
});
