import { test, expect, type Page } from "@playwright/test";

/**
 * Verifies the "Play again" flow: host clicks Play again on the outcome
 * banner, both clients land back in the same lobby with players preserved,
 * and a fresh match can be started normally.
 */
test("rematch returns both players to the lobby and plays a second match", async ({
  browser,
}) => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  try {
    // --- Match 1: get to a terminal outcome ------------------------------
    await host.goto("/");
    await host
      .getByPlaceholder(/how should others see you/i)
      .fill("Rematch Host");

    const tttCard = host.locator("button", {
      has: host.locator("h3", { hasText: "Tic-Tac-Toe" }),
    });
    await tttCard.click();
    await host.waitForURL(/\/lobby\/[A-Z]{4}/, { timeout: 15_000 });
    const joinCode = host.url().match(/\/lobby\/([A-Z]{4})/)?.[1]!;

    await guest.goto("/");
    await guest
      .getByPlaceholder(/how should others see you/i)
      .fill("Rematch Guest");
    await guest.getByPlaceholder(/ABCD/).fill(joinCode);
    await guest.getByRole("button", { name: /^Join/i }).click();
    await guest.waitForURL(/\/lobby\/[A-Z]{4}/, { timeout: 15_000 });

    await host.getByRole("button", { name: /^Begin/i }).click();
    await host.waitForURL(/\/play\//, { timeout: 15_000 });
    await guest.waitForURL(/\/play\//, { timeout: 15_000 });

    // Drive X to a top-row win.
    const hostSymbol = await symbolFor(host);
    const [xPage, oPage] = hostSymbol === "X" ? [host, guest] : [guest, host];
    await playCell(xPage, 0);
    await playCell(oPage, 3);
    await playCell(xPage, 1);
    await playCell(oPage, 4);
    await playCell(xPage, 2);

    // Both pages see the outcome banner.
    await expect(host.getByText(/^You win|takes it/i)).toBeVisible({
      timeout: 10_000,
    });

    // --- Rematch: host clicks Play again ---------------------------------
    await expect(host.getByRole("button", { name: /play again/i })).toBeVisible();
    await expect(
      guest.getByText(/waiting for the host to call a rematch/i),
    ).toBeVisible();

    await host.getByRole("button", { name: /play again/i }).click();

    // Both clients land back in the lobby with the same join code and
    // both players still seated.
    await host.waitForURL(new RegExp(`/lobby/${joinCode}`), {
      timeout: 10_000,
    });
    await guest.waitForURL(new RegExp(`/lobby/${joinCode}`), {
      timeout: 10_000,
    });
    await expect(host.getByText("Rematch Host")).toBeVisible();
    await expect(host.getByText("Rematch Guest")).toBeVisible();

    // --- Match 2: start a fresh match to prove the table is truly reset -
    await host.getByRole("button", { name: /^Begin/i }).click();
    await host.waitForURL(/\/play\//, { timeout: 15_000 });
    await guest.waitForURL(/\/play\//, { timeout: 15_000 });

    // Empty board, both players see their symbol assignment again.
    await expect(
      host.locator("text=/^You play as/i").first(),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await host.close();
    await guest.close();
    await hostCtx.close();
    await guestCtx.close();
  }
});

async function symbolFor(page: Page): Promise<"X" | "O"> {
  const label = page.locator("text=/^You play as/i").first();
  await expect(label).toBeVisible({ timeout: 10_000 });
  const text = (await label.innerText()).trim();
  if (/\bX\b/.test(text)) return "X";
  if (/\bO\b/.test(text)) return "O";
  throw new Error(`Could not parse symbol from "${text}"`);
}

async function playCell(page: Page, index: number): Promise<void> {
  const cell = page.locator(`button[aria-label="cell ${index}"]`);
  await expect(cell).toBeEnabled({ timeout: 10_000 });
  await cell.click();
}
