import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

/**
 * The conditions a dashboard is least likely to have been tried in.
 *
 * Everything here is automatable. The things that are NOT — what a screen reader actually
 * announces, whether the reading order makes sense out loud — are covered by the manual
 * script in `docs/accessibility-manual-pass.md`, which a person has to run (PLAN §13).
 */

const ROUTES = [
  "/dashboard/emea",
  "/dashboard/emea/uae/dubai/sch-dxb-01",
  "/focus/card.contributionMargin/emea",
]

test.describe("forced colours", () => {
  test.use({ forcedColors: "active" })

  for (const route of ROUTES) {
    test(`${route} stays usable with colour removed`, async ({ page }) => {
      await page.goto(route)
      await page.getByRole("heading", { level: 1 }).waitFor()

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
      expect(results.violations.map((v) => v.id)).toEqual([])
    })
  }

  test("direction is still readable when the tints are gone", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === "mobile-375",
      "narrow widths render the ranked list, which has no cells to tint"
    )
    // Forced-colors overrides backgrounds, so the matrix tints disappear entirely. The
    // glyph and the signed number are what survive, which is exactly why the glyph is
    // mandatory rather than decorative (PLAN §8.3).
    await page.goto("/dashboard/emea")
    const table = page.getByRole("table", { name: /metrics for/i })
    await table.waitFor()
    expect(await table.getByText(/[▲▼●]/).count()).toBeGreaterThan(0)
  })
})

test.describe("reflow", () => {
  // WCAG 1.4.10: content must work at 320 CSS px with no two-dimensional scrolling —
  // which is what 400% zoom on a 1280px desktop produces.
  test.use({ viewport: { width: 320, height: 512 } })

  for (const route of ROUTES) {
    test(`${route} reflows to 320px without sideways scrolling`, async ({
      page,
    }) => {
      await page.goto(route)
      await page.getByRole("heading", { level: 1 }).waitFor()

      const overflows = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1
      )
      expect(overflows).toBe(false)
    })
  }

  test("the matrix becomes a ranked list, not a squeezed grid", async ({
    page,
  }) => {
    await page.goto("/dashboard/emea")
    await expect(
      page.getByRole("combobox", { name: /ranked by/i })
    ).toBeVisible()
    await expect(page.getByRole("table", { name: /metrics for/i })).toHaveCount(
      0
    )
  })
})

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" })

  for (const route of ROUTES) {
    test(`${route} is clean in dark mode`, async ({ page }) => {
      // The dark tokens are validated numerically by validate:palette, but until now
      // nothing had actually rendered them.
      await page.addInitScript(() => {
        document.documentElement.classList.add("dark")
      })
      await page.goto(route)
      await page.getByRole("heading", { level: 1 }).waitFor()
      await expect(page.locator("html")).toHaveClass(/dark/)

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
      expect(results.violations.map((v) => v.id)).toEqual([])
    })
  }
})

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" })

  test("honours the preference", async ({ page }) => {
    await page.goto("/dashboard/emea")
    await page.getByRole("heading", { level: 1 }).waitFor()
    expect(
      await page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    ).toBe(true)

    // Charts are built with isAnimationActive={false} regardless, so there is no
    // transition to suppress — assert that rather than implying one exists.
    const animating = await page.evaluate(
      () =>
        [...document.querySelectorAll("svg *")].filter((node) => {
          const style = getComputedStyle(node)
          return (
            style.animationName !== "none" && style.animationDuration !== "0s"
          )
        }).length
    )
    expect(animating).toBe(0)
  })
})

test.describe("interaction latency", () => {
  test("sorting the matrix stays responsive", async ({ page }, info) => {
    test.skip(
      info.project.name === "mobile-375",
      "the sortable grid only exists at tablet width and above"
    )
    // A crude INP proxy: real INP is a field metric, but a sort that blocks for
    // hundreds of milliseconds will show up here (PLAN §15).
    await page.goto("/dashboard/emea")
    const header = page
      .getByRole("table", { name: /metrics for/i })
      .getByRole("columnheader", { name: /Seats/ })
    await header.waitFor()

    const elapsed = await page.evaluate(async () => {
      const button = document.querySelector("th[aria-sort] button")
      const start = performance.now()
      ;(button as HTMLElement)?.click()
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      return performance.now() - start
    })
    expect(elapsed).toBeLessThan(200)
  })

  test("a window resize does not stall the page", async ({ page }) => {
    await page.goto("/dashboard/emea")
    await page.getByRole("heading", { level: 1 }).waitFor()

    const start = Date.now()
    for (const width of [1400, 1100, 900, 700, 500, 375]) {
      await page.setViewportSize({ width, height: 900 })
    }
    // Widths are bucketed to 8px and debounced, so a drag must not trigger a
    // re-render storm (PLAN §15).
    expect(Date.now() - start).toBeLessThan(5000)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })
})
