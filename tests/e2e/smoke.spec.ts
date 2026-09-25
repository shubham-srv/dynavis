import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

/**
 * The Phase 0 harness proof: the app builds, serves, and is axe-clean at every
 * viewport the responsive ladder is specified against.
 *
 * As real routes land this file stays as the baseline — a route that regresses the
 * accessibility gate fails here before anyone opens a browser.
 */
test.describe("app shell", () => {
  test("renders and exposes a single top-level heading", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("has no page-level horizontal scroll", async ({ page }) => {
    await page.goto("/")
    // PLAN §7: charts and wide tables may scroll inside their own card, never the page.
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    )
    expect(overflows).toBe(false)
  })

  test("has no axe violations", async ({ page }) => {
    await page.goto("/")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()

    // Report the rule ids, not just a count — a bare number tells you nothing on CI.
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})

/**
 * The kitchen sink is the pa11y-ci and visual-regression target: every widget at every
 * variant on one page, so a responsive or accessibility regression surfaces here before
 * anyone opens a browser (PLAN §14).
 */
test.describe("kitchen sink", () => {
  test("renders every widget at every variant", async ({ page }) => {
    await page.goto("/kitchen-sink")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Kitchen sink"
    )
    // 18 widgets x 4 variants, each shell a labelled region.
    expect(await page.getByRole("region").count()).toBeGreaterThanOrEqual(72)
  })

  test("has no axe violations across the whole matrix", async ({ page }) => {
    await page.goto("/kitchen-sink")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  test("never scrolls the page sideways, at any viewport", async ({ page }) => {
    await page.goto("/kitchen-sink")
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    )
    expect(overflows).toBe(false)
  })
})
