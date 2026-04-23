import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("renders the Parlor hero and the game catalog", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /quiet corner of the internet/i,
        level: 1,
      }),
    ).toBeVisible();

    // At least one playable game shows up in the catalog. Using the
    // trailing "Open a table" call-to-action on each game card so the
    // selector is decoupled from exact game names (which can change as
    // new game packages merge).
    const tiles = page.getByRole("button", { name: /open a table/i });
    await expect(tiles.first()).toBeVisible({ timeout: 15_000 });
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);
  });
});
