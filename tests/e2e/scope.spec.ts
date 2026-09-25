import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

/**
 * Scope navigation, driven entirely through URLs and clicks.
 *
 * This is the payoff of putting scope in the path (PLAN D14): every one of these is a
 * real user journey, and none of them needs a test hook or a seeded store.
 */

test.describe("drill-down", () => {
  test("lands at the group and shows its regions", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nova Schools Group"
    )
    await expect(page.getByRole("link", { name: /EMEA/ })).toBeVisible()
  })

  test("redirects the root to the dashboard", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test("drills group → region → country → school by clicking", async ({
    page,
  }) => {
    await page.goto("/dashboard")

    await page.getByRole("link", { name: /^EMEA/ }).click()
    await expect(page).toHaveURL(/\/dashboard\/emea$/)

    await page.getByRole("link", { name: /United Arab Emirates/ }).click()
    await expect(page).toHaveURL(/\/dashboard\/emea\/uae$/)

    await page.getByRole("link", { name: /^Dubai/ }).click()
    await page
      .getByRole("link", { name: /Al Barsha International School/ })
      .click()

    await expect(page).toHaveURL(/\/dashboard\/emea\/uae\/dubai\/sch-dxb-01$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Al Barsha International School"
    )
    // A leaf has nothing below it, so no drill list is offered.
    await expect(page.getByText(/deepest level available/i)).toBeVisible()
  })

  test("deep-links to a leaf on a cold load", async ({ page }) => {
    await page.goto("/dashboard/emea/uae/dubai/sch-dxb-01")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Al Barsha International School"
    )
  })

  test("keeps the back button walking the drill history", async ({ page }) => {
    await page.goto("/dashboard")
    await page.getByRole("link", { name: /^EMEA/ }).click()
    await page.getByRole("link", { name: /United Arab Emirates/ }).click()
    await expect(page).toHaveURL(/\/emea\/uae$/)

    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard\/emea$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test("handles the country that has no cluster tier", async ({ page }) => {
    // Egypt's schools hang off the country directly — the non-uniform branch.
    await page.goto("/dashboard/emea/eg")
    await page.getByRole("link", { name: /New Cairo International/ }).click()
    await expect(page).toHaveURL(/\/dashboard\/emea\/eg\/sch-eg-01$/)
  })
})

test.describe("breadcrumbs", () => {
  test("track position and walk back up", async ({ page }) => {
    await page.goto("/dashboard/emea/uae")
    const trail = page.getByRole("navigation", { name: "Scope" })

    // Exactly one element in the trail may claim to be the current page.
    await expect(trail.locator('[aria-current="page"]')).toHaveCount(1)
    await expect(trail.locator('[aria-current="page"]')).toHaveText(
      "United Arab Emirates"
    )

    await trail.getByRole("link", { name: "EMEA" }).click()
    await expect(page).toHaveURL(/\/dashboard\/emea$/)
  })

  test("collapse the middle of a deep trail, keeping it reachable", async ({
    page,
  }) => {
    // Elided, not dropped: the ellipsis is a disclosure, so EMEA is still one click away
    // rather than requiring two trips back up (PLAN §6.3).
    await page.goto("/dashboard/emea/uae/dubai")
    const trail = page.getByRole("navigation", { name: "Scope" })

    await expect(trail.getByRole("link", { name: "EMEA" })).not.toBeVisible()
    await trail.getByLabel(/Show \d+ hidden level/).click()
    await trail.getByRole("link", { name: "EMEA" }).click()

    await expect(page).toHaveURL(/\/dashboard\/emea$/)
  })

  test("offer siblings so you can move laterally without going back up", async ({
    page,
  }) => {
    await page.goto("/dashboard/emea/uae")
    const trail = page.getByRole("navigation", { name: "Scope" })

    await trail.getByLabel(/Switch from United Arab Emirates/).click()
    await trail.getByRole("link", { name: "Egypt" }).click()

    await expect(page).toHaveURL(/\/dashboard\/emea\/eg$/)
  })
})

test.describe("guardrails", () => {
  test("a malformed scope is a 404, not a crash", async ({ page }) => {
    const response = await page.goto("/dashboard/NOT%20A%20SCOPE")
    expect(response?.status()).toBe(404)
  })

  test("a path whose steps are not parent-and-child is a 404", async ({
    page,
  }) => {
    // Both ids exist; the school is not under EMEA. Rendering it would put a Sydney
    // school beneath EMEA's breadcrumb trail.
    const response = await page.goto("/dashboard/emea/sch-au-01")
    expect(response?.status()).toBe(404)
  })

  test("a hand-edited URL outside the role's subtree is denied", async ({
    page,
  }) => {
    // The principal's root is one school. APAC is a perfectly real path, and still off
    // limits for them (PLAN §6.4).
    await page.goto("/dashboard/apac/au?role=principal")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /don't have access/i
    )
    await expect(
      page.getByRole("link", { name: /go to your dashboard/i })
    ).toBeVisible()
  })

  test("a regional manager can see their own region and not another", async ({
    page,
  }) => {
    await page.goto("/dashboard/emea/uae?role=regional-manager")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "United Arab Emirates"
    )

    await page.goto("/dashboard/apac?role=regional-manager")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /don't have access/i
    )
  })

  test("an unknown role falls back to the default rather than 404ing", async ({
    page,
  }) => {
    await page.goto("/dashboard/emea?role=janitor")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("EMEA")
  })
})

test.describe("accessibility", () => {
  for (const path of [
    "/dashboard",
    "/dashboard/emea/uae",
    "/dashboard/emea/uae/dubai/sch-dxb-01",
  ]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path)
      // Wait for the matrix to measure itself and render. Auditing before the debounce
      // elapses audits a skeleton, which is how an axe suite gives false confidence.
      // Narrow viewports render the ranked list rather than a grid, and a leaf renders
      // neither — wait for whichever this route and width produce.
      await page
        .getByRole("table")
        .or(page.getByRole("combobox", { name: /ranked by/i }))
        .or(page.getByText(/deepest level available/i))
        .first()
        .waitFor()
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
      expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
  }

  test("has no page-level horizontal scroll, even with a long non-ASCII name", async ({
    page,
  }) => {
    // The Arabic school name in the Dubai cluster is the fixture that breaks naive layout.
    await page.goto("/dashboard/emea/uae/dubai")
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    )
    expect(overflows).toBe(false)
  })

  test("drives the matrix grid with the keyboard alone", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === "mobile-375",
      "narrow widths render a ranked list, not a grid"
    )
    // The matrix is a roving-tabindex grid: one tab stop, then arrow keys. Tabbing to
    // every one of 30 cells would bury the rest of the page (PLAN §8.8).
    await page.goto("/dashboard/emea/eg")
    // Every KPI widget also ships a hidden data table, so name the matrix explicitly.
    await page.getByRole("table", { name: /metrics for/i }).waitFor()

    const firstRow = page.locator('[data-cell="0--1"]')
    for (let i = 0; i < 90; i++) {
      if (await firstRow.evaluate((node) => node === document.activeElement))
        break
      await page.keyboard.press("Tab")
    }
    await expect(firstRow).toBeFocused()

    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/\/dashboard\/emea\/eg\/sch-/)
  })

  test("keeps the ranked list plainly tabbable on a phone", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "mobile-375",
      "the grid model applies at wider widths"
    )
    await page.goto("/dashboard/emea/eg")
    const target = page.getByRole("link", { name: /New Cairo International/ })
    await target.waitFor()

    for (let i = 0; i < 40; i++) {
      if (await target.evaluate((node) => node === document.activeElement))
        break
      await page.keyboard.press("Tab")
    }
    await expect(target).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(/sch-eg-01$/)
  })
})
