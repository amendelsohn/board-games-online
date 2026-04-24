import { test, expect } from "@playwright/test";

/**
 * Negative path: the join input enforces a 4-letter code before hitting
 * the server. A malformed code surfaces an inline error without
 * navigating away from home.
 *
 * Note: a companion feature branch (feat/ci-and-home-ux, PR #41) adds a
 * /join/:code alias route and a `?invalidJoin=<code>` banner on home.
 * When that ships, expand this spec to cover the banner — for now we
 * test the behaviour that exists on master.
 */
test("invalid join code surfaces an error and stays on /", async ({ page }) => {
  await page.goto("/");

  const input = page.getByTestId("join-code-input");
  const submit = page.getByTestId("join-submit");

  // Only 1 letter — fails the /^[A-Z]{4}$/ guard.
  await input.fill("A");
  await submit.click();

  // Inline alert fires synchronously; no network round-trip expected.
  // Next.js renders a separate aria-live route announcer with
  // role="alert" on mount, so we scope to the specific error copy
  // rather than getByRole("alert") (which would match both).
  await expect(page.getByText(/Join code must be 4 letters/i)).toBeVisible({
    timeout: 5_000,
  });

  // We should still be on the home page, not navigated to a lobby.
  expect(page.url()).toMatch(/\/$|\/\?/);
});
