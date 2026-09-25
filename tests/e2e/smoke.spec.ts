import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The Phase 0 harness proof: the app builds, serves, and is axe-clean at every
 * viewport the responsive ladder is specified against.
 *
 * As real routes land this file stays as the baseline — a route that regresses the
 * accessibility gate fails here before anyone opens a browser.
 */
test.describe("app shell", () => {
  test("renders and exposes a single top-level heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("has no page-level horizontal scroll", async ({ page }) => {
    await page.goto("/");
    // PLAN §7: charts and wide tables may scroll inside their own card, never the page.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("has no axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Report the rule ids, not just a count — a bare number tells you nothing on CI.
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
