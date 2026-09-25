import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

/**
 * The focus view: the escape hatch that makes the responsive strategy work.
 *
 * A dense chart is never asked to be legible in a phone-sized card — the card shows the
 * headline and offers this instead (PLAN §7). These tests cover the parts that are easy
 * to get subtly wrong: deep links on a cold load, the three axes, and getting back out
 * with focus in a sensible place.
 */

const SCHOOL = "/dashboard/emea/uae/dubai/sch-dxb-01"

test.describe("focus view", () => {
  test("opens from a widget and names the metric and the scope", async ({
    page,
  }) => {
    await page.goto("/dashboard/emea")
    await page
      .getByRole("link", { name: /open re-enrolment rate in full view/i })
      .first()
      .click()

    await expect(page).toHaveURL(/\/focus\/card\.reEnrolmentRate\/emea/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Re-enrolment rate"
    )
    await expect(
      page.getByText(/EMEA · Are families choosing to stay/)
    ).toBeVisible()
  })

  test("deep-links on a cold load", async ({ page }) => {
    await page.goto("/focus/card.attendanceRate/emea/uae?by=time")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Student attendance"
    )
    await expect(
      page.getByRole("link", { name: /over time/i })
    ).toHaveAttribute("aria-current", "page")
  })

  test("moves focus to the heading on arrival", async ({ page }) => {
    // A route change alone leaves focus on <body>, so a keyboard user would have to
    // tab in from the top of the document.
    await page.goto("/focus/card.attendanceRate/emea")
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused()
  })

  test("offers a composite its component waterfall first", async ({ page }) => {
    await page.goto("/focus/card.contributionMargin/emea")
    const nav = page.getByRole("navigation", { name: "Breakdown" })
    await expect(
      nav.getByRole("link", { name: /by component/i })
    ).toHaveAttribute("aria-current", "page")
    await expect(
      page.getByRole("figure", { name: /by component/i })
    ).toBeVisible()
    await expect(page.getByText(/largest cost line/i)).toBeVisible()
  })

  test("switches axis via the URL, so a view is shareable", async ({
    page,
  }) => {
    await page.goto("/focus/card.contributionMargin/emea")
    await page.getByRole("link", { name: /^By location$/ }).click()
    await expect(page).toHaveURL(/by=location/)
    await expect(page.getByRole("img", { name: /by unit/i })).toBeVisible()
  })

  test("drills to a child without leaving the metric", async ({ page }) => {
    await page.goto("/focus/card.attendanceRate/emea?by=location")
    await page
      .getByRole("link", { name: "United Arab Emirates" })
      .last()
      .click()
    await expect(page).toHaveURL(/\/focus\/card\.attendanceRate\/emea\/uae/)
    // The metric is pinned; only the scope moved (PLAN §6.5).
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Student attendance"
    )
  })

  test("shows the data as a table and offers a CSV", async ({ page }) => {
    await page.goto("/focus/card.attendanceRate/emea")
    const toggle = page.getByRole("button", { name: /view as table/i })
    await expect(toggle).toHaveAttribute("aria-pressed", "false")

    await toggle.click()
    await expect(
      page.getByRole("region", { name: "Data table" }).getByRole("table")
    ).toBeVisible()

    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: "CSV" }).click()
    expect((await download).suggestedFilename()).toContain("attendanceRate")
  })

  test("closes with Escape, landing back on the widget it came from", async ({
    page,
  }) => {
    await page.goto("/dashboard/emea")
    await page
      .getByRole("link", { name: /open re-enrolment rate in full view/i })
      .first()
      .click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Re-enrolment rate"
    )

    await page.keyboard.press("Escape")
    await expect(page).toHaveURL(/\/dashboard\/emea.*#w-card\.reEnrolmentRate/)
    // The fragment target is focusable, so the keyboard returns to the widget rather
    // than the top of the document (PLAN §6.5).
    await expect(page.locator("#w-card\\.reEnrolmentRate")).toHaveAttribute(
      "tabindex",
      "-1"
    )
  })

  test("the back button also returns to the dashboard", async ({ page }) => {
    await page.goto("/dashboard/emea")
    await page
      .getByRole("link", { name: /open seat utilisation in full view/i })
      .first()
      .click()
    await expect(page).toHaveURL(/\/focus\//)
    await page.goBack()
    await expect(page).toHaveURL(/\/dashboard\/emea$/)
  })

  test("a leaf offers only the time axis", async ({ page }) => {
    await page.goto(
      `/focus/card.attendanceRate${SCHOOL.replace("/dashboard", "")}`
    )
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(
      page.getByRole("navigation", { name: "Breakdown" })
    ).toHaveCount(0)
  })

  test("an unknown widget or a forbidden scope is a 404", async ({ page }) => {
    expect((await page.goto("/focus/card.nope/emea"))?.status()).toBe(404)
    expect(
      (await page.goto("/focus/card.attendanceRate/nowhere"))?.status()
    ).toBe(404)
    // The focus view is not a way around the role check (PLAN §1.4).
    expect(
      (
        await page.goto("/focus/card.attendanceRate/apac?role=principal")
      )?.status()
    ).toBe(404)
  })

  test("has no axe violations, table open or closed", async ({ page }) => {
    await page.goto("/focus/card.contributionMargin/emea")
    for (const step of ["closed", "open"]) {
      if (step === "open") {
        await page.getByRole("button", { name: /view as table/i }).click()
      }
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
      expect(
        results.violations.map((v) => v.id),
        `table ${step}`
      ).toEqual([])
    }
  })

  test("does not scroll the page sideways", async ({ page }) => {
    await page.goto("/focus/card.contributionMargin/emea/uae?by=location")
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    )
    expect(overflows).toBe(false)
  })
})
