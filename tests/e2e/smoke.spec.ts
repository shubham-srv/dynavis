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

/**
 * The pages shown to the client. They live under app/(demo) and are deleted at kickoff,
 * but while they exist they are the first thing anyone sees — a broken pitch page is a
 * worse outcome than a broken widget.
 */
test.describe("demo pages", () => {
  for (const route of ["/before-after", "/states"]) {
    test(`${route} renders and is axe-clean`, async ({ page }) => {
      await page.goto(route)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
      expect(results.violations.map((violation) => violation.id)).toEqual([])
    })

    test(`${route} does not scroll sideways`, async ({ page }) => {
      await page.goto(route)
      const overflows = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1
      )
      expect(overflows).toBe(false)
    })
  }

  test("the before panel is labelled as an illustration, not their board", async ({
    page,
  }) => {
    // Presenting an invented screen as the client's would be a fabricated artefact in
    // the one place it would be most persuasive and most wrong.
    await page.goto("/before-after")
    await expect(
      page.getByText(/not.*the client's actual board/i)
    ).toBeVisible()
  })

  test("states distinguishes empty from error from not-measured", async ({
    page,
  }) => {
    await page.goto("/states")
    // Next ships its own role="alert" route announcer, so scope to the page content.
    await expect(
      page.getByRole("region", { name: "Shell states" }).getByRole("alert")
    ).toBeVisible()
    await expect(
      page
        .getByRole("region", { name: "Shell states" })
        .getByText("No data recorded for this period.")
    ).toBeVisible()
    // The real sparse widgets say "not measured" rather than showing a zero.
    await expect(
      page
        .getByRole("region", { name: "Genuinely missing data" })
        .getByText(/not measured this period/i)
        .first()
    ).toBeVisible()
  })
})
