import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ContainerSizeProvider } from "@/components/dashboard/container-size"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadForWidget, loadWidgetDatum } from "@/lib/data/widget-data"
import { kpiById } from "@/lib/kpi/catalog"
import { LEVELS } from "@/lib/scope/levels"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { resolveScope } from "@/lib/scope/resolve"
import {
  DEFAULT_WIDGET_IDS,
  isValidAtLevel,
  unavailableReason,
  widgetById,
  widgetsForLevel,
  WIDGETS,
} from "@/lib/registry/registry"
import { VARIANT_MIN_WIDTH, type Variant } from "@/lib/viz/variants"

/**
 * The contract test.
 *
 * One `describe.each` over the registry, asserting the things that must be true of every
 * widget. ~70 lines that scale automatically with every widget added, and they catch the
 * class of bug that actually breaks dashboards: a widget that renders at three sizes and
 * throws at the fourth, or one whose accessible table is empty (PLAN §14, tier 3).
 */

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const
const scope = resolveScope(
  ["emea", "uae", "dubai", "sch-dxb-01"],
  fixtureLookup
)!
const LEVEL_KEYS = LEVELS.map((level) => level.key)

describe("registry", () => {
  it("is not empty and has unique ids", () => {
    expect(WIDGETS.length).toBeGreaterThan(0)
    const ids = WIDGETS.map((widget) => widget.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("resolves widgets by id and rejects unknown ones", () => {
    expect(widgetById(WIDGETS[0].id)).toBe(WIDGETS[0])
    expect(() => widgetById("card.nope")).toThrow(RangeError)
  })

  it("offers a default dashboard whose every entry exists", () => {
    for (const id of DEFAULT_WIDGET_IDS)
      expect(() => widgetById(id)).not.toThrow()
    // The north star leads (PLAN §1.2).
    expect(DEFAULT_WIDGET_IDS[0]).toBe("card.reEnrolmentRate")
  })

  it("covers all three pillars, so the dashboard cannot become single-pillar by accident", () => {
    const pillars = new Set(WIDGETS.map((widget) => widget.pillar))
    expect(pillars).toEqual(new Set(["revenue", "efficiency", "academic"]))
  })

  it("filters by scope level, and explains what it filtered", () => {
    const atGroup = widgetsForLevel("group").map((widget) => widget.id)
    // A university placement rate is meaningless above a school.
    expect(atGroup).not.toContain("card.universityPlacement")
    expect(widgetsForLevel("school").map((w) => w.id)).toContain(
      "card.universityPlacement"
    )

    const placement = widgetById("card.universityPlacement")
    expect(unavailableReason(placement, "group")).toMatch(/senior years/i)
    expect(unavailableReason(placement, "school")).toBeNull()
  })
})

describe.each(WIDGETS.map((widget) => [widget.id, widget] as const))(
  "%s",
  (_id, widget) => {
    const kpi = kpiById(widget.kpiId)
    const Body = widget.render

    /*
      Load where the widget is actually meaningful.

      A correlation widget needs a population to correlate across, and a school has no
      children — loaded at `sch-dxb-01` it can only ever report "too few units", so every
      assertion below would pass against a widget that never drew anything. The scope
      *reference* stays the school either way, because the summary assertion is about
      naming the scope you are looking at, not about where the rows came from.
    */
    const atSchool = isValidAtLevel(widget, "school")
    const dataScopeId = atSchool ? "sch-dxb-01" : "emea"
    const sparseScopeId = atSchool ? "sch-eg-01" : "eg"

    // `loadForWidget`, not `loadWidgetDatum`: it is what every page uses, and it is what
    // attaches the paired series a correlation widget declares.
    const datum = loadForWidget(widget, dataScopeId, period)

    it("answers a question in words", () => {
      expect(widget.question.trim().length).toBeGreaterThan(0)
      expect(widget.title.trim().length).toBeGreaterThan(0)
    })

    it("declares a footprint at every breakpoint", () => {
      for (const breakpoint of ["mobile", "tablet", "desktop"] as const) {
        expect(widget.size[breakpoint].rowSpan).toBeGreaterThan(0)
        expect(widget.size[breakpoint].token).toBeTruthy()
      }
    })

    it("declares only levels the hierarchy actually contains", () => {
      if (widget.validAtLevels === "all") return
      for (const level of widget.validAtLevels)
        expect(LEVEL_KEYS).toContain(level)
    })

    it("declares at least one breakdown axis, and a component axis only if it can fill one", () => {
      expect(widget.breakdowns.length).toBeGreaterThan(0)
      if (widget.breakdowns.includes("component")) {
        expect(kpi.components?.length).toBeGreaterThan(0)
      }
    })

    it.each(["micro", "compact", "standard", "expanded"] as Variant[])(
      "renders at the %s variant without throwing",
      (variant) => {
        // The bug this catches: a widget that works at three sizes and explodes at the
        // fourth, which nobody notices until a phone.
        expect(() =>
          render(
            <ContainerSizeProvider width={VARIANT_MIN_WIDTH[variant]}>
              <Body datum={datum} kpi={kpi} scope={scope} variant={variant} />
            </ContainerSizeProvider>
          )
        ).not.toThrow()
      }
    )

    it("produces a non-empty accessible summary naming the scope", () => {
      const summary = widget.a11y.summary(datum, kpi, scope)
      expect(summary.trim().length).toBeGreaterThan(0)
      expect(summary).toContain("Al Barsha International School")
    })

    it("produces a table whose rows match its column count", () => {
      const table = widget.a11y.table(datum, kpi)
      expect(table.columns.length).toBeGreaterThan(1)
      expect(table.rows.length).toBeGreaterThan(0)
      for (const row of table.rows)
        expect(row).toHaveLength(table.columns.length)
    })

    it("survives a scope where the KPI was never measured", () => {
      // Egypt reports no progress score; the primary school has no placement rate. Both
      // must render as "not measured" rather than throwing or showing zero.
      const sparse = loadForWidget(widget, sparseScopeId, period)
      expect(() =>
        render(
          <ContainerSizeProvider width={560}>
            <Body
              datum={sparse}
              kpi={kpi}
              scope={scope}
              variant="standard"
            />
          </ContainerSizeProvider>
        )
      ).not.toThrow()
    })
  }
)

describe("KPI card rendering", () => {
  const kpi = kpiById("attendanceRate")
  const widget = widgetById("card.attendanceRate")
  const datum = loadWidgetDatum("sch-dxb-01", "attendanceRate", period)

  it("always shows the number, whatever the size", () => {
    for (const variant of ["micro", "expanded"] as Variant[]) {
      const { unmount } = render(
        <ContainerSizeProvider width={VARIANT_MIN_WIDTH[variant]}>
          {widget.render({ datum, kpi, scope, variant })}
        </ContainerSizeProvider>
      )
      expect(screen.getByRole("status")).toHaveTextContent(/%$/)
      unmount()
    }
  })

  it("states what the number is measured against", () => {
    render(
      <ContainerSizeProvider width={560}>
        {widget.render({ datum, kpi, scope, variant: "standard" })}
      </ContainerSizeProvider>
    )
    expect(
      screen.getByText(/vs\. (target|ay-|peer median)/)
    ).toBeInTheDocument()
  })

  it("says a value was not measured instead of showing a zero", () => {
    const missing = loadWidgetDatum("sch-eg-01", "progressScore", period)
    render(
      <ContainerSizeProvider width={560}>
        {widgetById("card.progressScore").render({
          datum: missing,
          kpi: kpiById("progressScore"),
          scope,
          variant: "standard",
        })}
      </ContainerSizeProvider>
    )
    expect(screen.getByText(/not measured this period/i)).toBeInTheDocument()
  })
})
