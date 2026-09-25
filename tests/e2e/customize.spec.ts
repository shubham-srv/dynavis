import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

/**
 * Customisation, driven by the keyboard alone.
 *
 * Phase 7's exit criterion, and the reason move/remove are buttons rather than a drag
 * handle: drag-and-drop with no alternative fails WCAG 2.5.7 outright, and is unusable
 * on a phone regardless (PLAN §10).
 *
 * **Nothing in this file may call `page.mouse` or `.click()`.** If a flow cannot be
 * completed here, it cannot be completed by a keyboard user.
 */

/** Tab until the named control has focus, then activate it. */
async function tabTo(page: Page, name: RegExp, limit = 60): Promise<void> {
  const target = page.getByRole("button", { name }).first()
  await target.waitFor()
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate((node) => node === document.activeElement)) return
    await page.keyboard.press("Tab")
  }
  throw new Error(`never reached ${name} by tabbing`)
}

async function pressTo(page: Page, name: RegExp): Promise<void> {
  await tabTo(page, name)
  await page.keyboard.press("Enter")
}

async function widgetTitles(page: Page): Promise<string[]> {
  return page
    .locator("ul li section[aria-label]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? "")
    )
}

test.describe("keyboard-only customisation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/emea")
    await page.getByRole("button", { name: /arrange/i }).waitFor()
  })

  test("reorders a widget and announces its new position", async ({ page }) => {
    const before = await widgetTitles(page)

    await pressTo(page, /^Arrange$/)
    await pressTo(page, new RegExp(`Move ${escape(before[1])} up`, "i"))

    const after = await widgetTitles(page)
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[0])

    // Silent to a screen reader unless said out loud (WCAG 4.1.3).
    await expect(page.getByText(/moved to position 1 of \d+\./)).toBeAttached()
  })

  test("removes a widget and takes it back with Undo", async ({ page }) => {
    const before = await widgetTitles(page)

    await pressTo(page, /^Arrange$/)
    await pressTo(page, new RegExp(`Remove ${escape(before[0])} from`, "i"))
    expect(await widgetTitles(page)).toHaveLength(before.length - 1)

    await pressTo(page, /^Undo$/)
    expect(await widgetTitles(page)).toEqual(before)
  })

  test("adds a metric from the picker", async ({ page }) => {
    const before = await widgetTitles(page)

    await pressTo(page, /choose metrics/i)
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    // The native dialog traps focus, so tabbing stays inside it.
    const checkbox = dialog
      .getByRole("checkbox", { name: /^Staff turnover/ })
      .first()
    for (let i = 0; i < 40; i++) {
      if (await checkbox.evaluate((node) => node === document.activeElement))
        break
      await page.keyboard.press("Tab")
    }
    await expect(checkbox).toBeFocused()
    await page.keyboard.press("Space")
    await expect(checkbox).toBeChecked()

    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()

    const after = await widgetTitles(page)
    expect(after).toHaveLength(before.length + 1)
    expect(after).toContain("Staff turnover")
  })

  test("survives a reload, per role", async ({ page }) => {
    const before = await widgetTitles(page)

    await pressTo(page, /^Arrange$/)
    await pressTo(page, new RegExp(`Remove ${escape(before[0])} from`, "i"))
    // Wait for the removal to land before reloading, or the test races the save.
    await expect
      .poll(async () => (await widgetTitles(page)).length)
      .toBe(before.length - 1)

    await page.reload()
    await page.getByRole("button", { name: /arrange/i }).waitFor()
    expect(await widgetTitles(page)).toHaveLength(before.length - 1)

    // A different role must not inherit it — storage is keyed by user AND role.
    await page.goto("/dashboard/emea?role=regional-manager")
    await page.getByRole("button", { name: /arrange/i }).waitFor()
    expect(await widgetTitles(page)).toHaveLength(before.length)
  })

  test("resets to the role's defaults", async ({ page }) => {
    const before = await widgetTitles(page)

    await pressTo(page, /^Arrange$/)
    await pressTo(page, new RegExp(`Remove ${escape(before[0])} from`, "i"))
    expect(await widgetTitles(page)).toHaveLength(before.length - 1)

    await pressTo(page, /reset to default/i)
    expect(await widgetTitles(page)).toEqual(before)
  })

  test("keeps the picker accessible while open", async ({ page }) => {
    await pressTo(page, /choose metrics/i)
    await expect(page.getByRole("dialog")).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})

/** Widget titles contain regex metacharacters, e.g. "Student:teacher ratio". */
function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
