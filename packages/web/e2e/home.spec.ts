import { test, expect } from "@playwright/test";

/**
 * Home / catalog smoke: the hero renders, the catalog populates with a
 * healthy fleet of game cards, and the join-code input is present.
 *
 * Intentionally shallow — this exists to catch the "site is broken"
 * class of regression on PRs without locking us into specific game
 * names or catalog ordering.
 */
test.describe("home page", () => {
  test("renders hero, catalog, and join input", async ({ page }) => {
    await page.goto("/");

    // Young Serif display hero copy. The h1 spans multiple lines via a
    // child <span>, so we match a recognizable substring rather than
    // the whole heading.
    await expect(
      page.getByRole("heading", {
        name: /quiet corner of the internet/i,
        level: 1,
      }),
    ).toBeVisible();

    // The catalog renders one "new-game-<type>" button per registered
    // game. There are ~30 games in the monorepo — require at least 10
    // so we catch a catastrophic registration failure without locking
    // the test to an exact count.
    const cards = page.locator('[data-testid^="new-game-"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const count = await cards.count();
    expect(count, "at least 10 game cards should render").toBeGreaterThanOrEqual(
      10,
    );

    // Join-code input + submit button are the other critical home entry
    // point. If these disappear, guests can't join a table at all.
    await expect(page.getByTestId("join-code-input")).toBeVisible();
    await expect(page.getByTestId("join-submit")).toBeVisible();
  });
});
