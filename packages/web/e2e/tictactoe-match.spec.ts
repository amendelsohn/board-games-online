import { test, expect, type Page } from "@playwright/test";

/**
 * Critical-path E2E: two players go from home → lobby → live match →
 * terminal outcome. Template for per-game specs.
 *
 * Uses two independent browser contexts so each player has their own
 * localStorage + cookie jar (the server identifies players by session
 * cookie; a shared context would collapse to a single player).
 */
test("two-player tic-tac-toe match ends with the expected winner", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  try {
    // ----- Host creates a game ---------------------------------------------
    await host.goto("/");
    await host
      .getByPlaceholder(/how should others see you/i)
      .fill("E2E Host");

    // Game cards render their title in an <h3>; anchor on that rather than
    // the button's full accessible name (which includes description + CTA).
    const tttCard = host.locator("button", {
      has: host.locator("h3", { hasText: "Tic-Tac-Toe" }),
    });
    await expect(tttCard).toBeVisible({ timeout: 15_000 });
    await tttCard.click();
    await host.waitForURL(/\/lobby\/[A-Z]{4}/, { timeout: 15_000 });

    const joinCode = host.url().match(/\/lobby\/([A-Z]{4})/)?.[1];
    expect(joinCode, "host ended up on a lobby with a 4-letter code").toMatch(
      /^[A-Z]{4}$/,
    );

    // ----- Guest joins via the code on the home page -----------------------
    await guest.goto("/");
    await guest
      .getByPlaceholder(/how should others see you/i)
      .fill("E2E Guest");
    await guest.getByPlaceholder(/ABCD/).fill(joinCode!);
    await guest.getByRole("button", { name: /^Join/i }).click();
    await guest.waitForURL(/\/lobby\/[A-Z]{4}/, { timeout: 15_000 });

    // Host sees both players before starting.
    await expect(host.getByText("E2E Host")).toBeVisible();
    await expect(host.getByText("E2E Guest")).toBeVisible();

    // ----- Host starts — both pages move to /play -------------------------
    await host.getByRole("button", { name: /^Begin/i }).click();
    await host.waitForURL(/\/play\//, { timeout: 15_000 });
    await guest.waitForURL(/\/play\//, { timeout: 15_000 });

    // ----- Play to a deterministic outcome --------------------------------
    // Tic-Tac-Toe assigns X/O randomly, so detect which page is X and drive
    // from there. The X player wins the top row (cells 0,1,2); O blocks the
    // middle row (cells 3,4) along the way.
    const hostSymbol = await symbolFor(host);
    const [xPage, oPage] = hostSymbol === "X" ? [host, guest] : [guest, host];

    await playCell(xPage, 0);
    await playCell(oPage, 3);
    await playCell(xPage, 1);
    await playCell(oPage, 4);
    await playCell(xPage, 2);

    // ----- Assert outcome banner on both sides ----------------------------
    await expect(xPage.getByText(/^You win/i)).toBeVisible({ timeout: 10_000 });
    await expect(oPage.getByText(/takes it/i)).toBeVisible({ timeout: 10_000 });
  } finally {
    await host.close();
    await guest.close();
    await hostCtx.close();
    await guestCtx.close();
  }
});

/** Read the "You play as X" / "You play as O" indicator. */
async function symbolFor(page: Page): Promise<"X" | "O"> {
  const label = page.locator("text=/^You play as/i").first();
  await expect(label).toBeVisible({ timeout: 10_000 });
  const text = (await label.innerText()).trim();
  if (/\bX\b/.test(text)) return "X";
  if (/\bO\b/.test(text)) return "O";
  throw new Error(`Could not parse symbol from "${text}"`);
}

/** Click a Tic-Tac-Toe cell by index (0–8). Waits for the cell to be enabled. */
async function playCell(page: Page, index: number): Promise<void> {
  const cell = page.locator(`button[aria-label="cell ${index}"]`);
  await expect(cell).toBeEnabled({ timeout: 10_000 });
  await cell.click();
}
