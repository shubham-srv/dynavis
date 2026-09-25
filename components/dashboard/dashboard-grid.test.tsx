import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  DashboardGrid,
  SPAN_CLASS,
} from "@/components/dashboard/dashboard-grid"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadWidgetDatum } from "@/lib/data/widget-data"
import { COL_SPAN, type SizeToken } from "@/lib/layout/tokens"
import { DEFAULT_WIDGET_IDS, widgetById } from "@/lib/registry/registry"
import { resolveScope } from "@/lib/scope/resolve"

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const
const scope = resolveScope(["emea"], fixtureLookup)!

const widgets = DEFAULT_WIDGET_IDS.map((widgetId) => ({
  widgetId,
  datum: loadWidgetDatum("emea", widgetById(widgetId).kpiId, period),
}))

describe("DashboardGrid", () => {
  it("renders every selected widget immediately, with no measurement pass", () => {
    // The CLS fix: layout is pure CSS, so there is no placeholder and no swap.
    const { container } = render(
      <DashboardGrid widgets={widgets} scope={scope} />
    )
    expect(container.querySelector(".animate-pulse")).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(widgets.length)
  })

  it("says so plainly when nothing is selected", () => {
    render(<DashboardGrid widgets={[]} scope={scope} />)
    expect(screen.getByText(/no widgets selected/i)).toBeInTheDocument()
  })

  it("emits widgets in the user's saved order", () => {
    // CSS auto-placement (not dense) flows in document order, so DOM order equals
    // visual order equals the saved order at every breakpoint (PLAN D4).
    render(<DashboardGrid widgets={widgets} scope={scope} />)
    const headings = screen
      .getAllByRole("listitem")
      .map((item) => within(item).getByRole("heading").textContent)
    expect(headings).toEqual(
      widgets.map(({ widgetId }) => widgetById(widgetId).title)
    )
  })

  it("is one column on mobile and twelve on desktop", () => {
    const { container } = render(
      <DashboardGrid widgets={widgets} scope={scope} />
    )
    const list = container.querySelector("ul")!
    expect(list.className).toContain("grid-cols-1")
    expect(list.className).toContain("md:grid-cols-6")
    expect(list.className).toContain("xl:grid-cols-12")
  })

  it("never uses dense packing, which would break tab order", () => {
    const { container } = render(
      <DashboardGrid widgets={widgets} scope={scope} />
    )
    expect(container.querySelector("ul")!.className).not.toContain("dense")
  })

  describe("span classes match the token table", () => {
    // The classes must be literal strings for Tailwind, so they duplicate COL_SPAN.
    // This is the check that stops the two drifting apart.
    it.each(Object.keys(SPAN_CLASS) as SizeToken[])("%s", (token) => {
      expect(SPAN_CLASS[token]).toContain(`col-span-${COL_SPAN.mobile[token]}`)
      expect(SPAN_CLASS[token]).toContain(
        `md:col-span-${COL_SPAN.tablet[token]}`
      )
      expect(SPAN_CLASS[token]).toContain(
        `xl:col-span-${COL_SPAN.desktop[token]}`
      )
    })
  })

  describe("reordering", () => {
    it("offers move controls only where a move is possible", async () => {
      const onMoveUp = vi.fn()
      const onMoveDown = vi.fn()
      render(
        <DashboardGrid
          widgets={widgets}
          scope={scope}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      )
      const items = screen.getAllByRole("listitem")
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
      render(
        <DashboardGrid widgets={widgets} scope={scope} onMoveUp={onMoveUp} />
      )
      const items = screen.getAllByRole("listitem")
      await userEvent.click(
        within(items[1]).getByRole("button", { name: /move .* up/i })
      )
      expect(onMoveUp).toHaveBeenCalledOnce()
      expect(onMoveUp.mock.calls[0][0]).toBe(widgets[1].widgetId)
    })

    it("tells assistive tech each widget's position in the list", () => {
      render(<DashboardGrid widgets={widgets} scope={scope} />)
      expect(
        screen.getByText(`Position 1 of ${widgets.length}`)
      ).toBeInTheDocument()
      expect(
        screen.getByText(`Position ${widgets.length} of ${widgets.length}`)
      ).toBeInTheDocument()
    })

    it("passes removal through with the widget id", async () => {
      const onRemove = vi.fn()
      render(
        <DashboardGrid widgets={widgets} scope={scope} onRemove={onRemove} />
      )
      await userEvent.click(
        screen.getAllByRole("button", { name: /remove .* from dashboard/i })[0]
      )
      expect(onRemove).toHaveBeenCalledOnce()
    })
  })
})
