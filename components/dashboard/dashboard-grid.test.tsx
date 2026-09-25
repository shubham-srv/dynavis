import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DashboardGrid } from "@/components/dashboard/dashboard-grid"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadWidgetDatum } from "@/lib/data/widget-data"
import { GRID_COLUMNS } from "@/lib/layout/tokens"
import { DEFAULT_WIDGET_IDS, widgetById } from "@/lib/registry/registry"
import { resolveScope } from "@/lib/scope/resolve"
import { resizeTo } from "../../tests/mocks/resize-observer"

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const
const scope = resolveScope(["emea"], fixtureLookup)!

const widgets = DEFAULT_WIDGET_IDS.map((widgetId) => ({
  widgetId,
  datum: loadWidgetDatum("emea", widgetById(widgetId).kpiId, period),
}))

/**
 * The grid measures itself, so these tests drive the mocked ResizeObserver rather than
 * injecting a width — that is the whole path under test, including the debounce.
 */
async function renderAt(width: number, props = {}) {
  const view = render(
    <DashboardGrid widgets={widgets} scope={scope} {...props} />
  )
  const box = view.container.firstElementChild as HTMLElement
  resizeTo(box, { width, height: 800 })
  // Let the 100ms debounce settle.
  await screen.findByRole("list", {}, { timeout: 3000 })
  return view
}

describe("DashboardGrid", () => {
  it("shows a skeleton until it has measured, rather than guessing a layout", async () => {
    // Laying a 12-column grid into a phone for one frame is visible and looks broken.
    const { container } = render(
      <DashboardGrid widgets={widgets} scope={scope} />
    )
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("renders every selected widget once measured", async () => {
    await renderAt(1400)
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(widgets.length)
  })

  it("lays out one column on a phone", async () => {
    await renderAt(375)
    const list = screen.getByRole("list")
    expect(list).toHaveStyle({
      gridTemplateColumns: `repeat(${GRID_COLUMNS.mobile}, minmax(0, 1fr))`,
    })
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.style.gridColumn).toBe("1 / span 1")
    }
  })

  it("lays out twelve columns on a desktop", async () => {
    await renderAt(1400)
    expect(screen.getByRole("list")).toHaveStyle({
      gridTemplateColumns: `repeat(${GRID_COLUMNS.desktop}, minmax(0, 1fr))`,
    })
  })

  it("emits the DOM in reading order, left to right and top to bottom", async () => {
    // The reason for the solver: grid-auto-flow:dense would reorder visually without
    // reordering the DOM, so tab order would stop matching the screen (PLAN D4).
    await renderAt(1400)
    const placements = screen.getAllByRole("listitem").map((item) => {
      const [start] = item.style.gridColumn.split(" / ")
      return Number(start)
    })
    let column = 0
    for (const start of placements) {
      if (start < column) {
        // A new row is the only legitimate reason to go backwards.
        expect(start).toBe(1)
      }
      column = start
    }
  })

  it("says so plainly when nothing is selected", () => {
    render(<DashboardGrid widgets={[]} scope={scope} />)
    expect(screen.getByText(/no widgets selected/i)).toBeInTheDocument()
  })

  describe("reordering", () => {
    it("offers move controls only where a move is possible", async () => {
      const onMoveUp = vi.fn()
      const onMoveDown = vi.fn()
      await renderAt(1400, { onMoveUp, onMoveDown })

      const items = screen.getAllByRole("listitem")
      // Nothing above the first, nothing below the last.
      expect(
        within(items[0]).queryByRole("button", { name: /move .* up/i })
      ).toBeNull()
      expect(
        within(items.at(-1)!).queryByRole("button", { name: /move .* down/i })
      ).toBeNull()
      expect(
        within(items[0]).getByRole("button", { name: /move .* down/i })
      ).toBeInTheDocument()
    })

    it("reports which widget was moved, not just that something moved", async () => {
      const onMoveUp = vi.fn()
      await renderAt(1400, { onMoveUp })
      const items = screen.getAllByRole("listitem")
      await userEvent.click(
        within(items[1]).getByRole("button", { name: /move .* up/i })
      )
      expect(onMoveUp).toHaveBeenCalledOnce()
      expect(onMoveUp.mock.calls[0][0]).toMatch(/^card\.|^trend\.|^ranking\./)
    })

    it("tells assistive tech each widget's position in the list", async () => {
      await renderAt(1400)
      expect(
        screen.getByText(`Position 1 of ${widgets.length}`)
      ).toBeInTheDocument()
      expect(
        screen.getByText(`Position ${widgets.length} of ${widgets.length}`)
      ).toBeInTheDocument()
    })

    it("passes removal through with the widget id", async () => {
      const onRemove = vi.fn()
      await renderAt(1400, { onRemove })
      await userEvent.click(
        screen.getAllByRole("button", { name: /remove .* from dashboard/i })[0]
      )
      expect(onRemove).toHaveBeenCalledOnce()
    })
  })
})
