import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ContainerSizeProvider } from "@/components/dashboard/container-size"
import { RankingWidget } from "@/components/widgets/ranking-widget"
import { TrendWidget } from "@/components/widgets/trend-widget"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadWidgetDatum } from "@/lib/data/widget-data"
import { kpiById } from "@/lib/kpi/catalog"
import { resolveScope } from "@/lib/scope/resolve"
import type { Variant } from "@/lib/viz/variants"

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const
const scope = resolveScope(["emea"], fixtureLookup)!

/**
 * The chart adapters are mocked, and that is the point of this file.
 *
 * A widget's job is to *choose* a form for its size; drawing is the adapter's job, tested
 * in components/charts and in a real browser by Playwright. Asserting the real adapter
 * here meant waiting on a next/dynamic import plus the Recharts module graph inside
 * jsdom, which flaked under parallel load — twice. Raising the timeout again would have
 * been treating the symptom; mocking removes the dependency entirely and makes the
 * assertion about the widget.
 */
vi.mock("@/components/charts/lazy", () => ({
  TrendChart: ({ label }: { label: string }) => (
    <div role="img" aria-label={label} data-testid="trend" />
  ),
  RankingBar: ({ label }: { label: string }) => (
    <div role="img" aria-label={label} data-testid="ranking" />
  ),
  ScatterPlot: ({ label }: { label: string }) => (
    <div role="img" aria-label={label} data-testid="scatter" />
  ),
}))

const show = (node: React.ReactNode, width = 900) =>
  render(<ContainerSizeProvider width={width}>{node}</ContainerSizeProvider>)

describe("RankingWidget", () => {
  const kpi = kpiById("seatUtilisation")
  const datum = loadWidgetDatum("emea", "seatUtilisation", period)

  it("degrades to a labelled list at the narrowest size, not a tiny chart", () => {
    // Substitution, not shrinking: three names and three numbers beat an illegible
    // bar chart at 320px (PLAN §7).
    show(
      <RankingWidget datum={datum} kpi={kpi} scope={scope} variant="micro" />,
      320
    )
    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent(/%/)
  })

  it("ranks strongest first in the narrow list", () => {
    show(
      <RankingWidget datum={datum} kpi={kpi} scope={scope} variant="micro" />,
      320
    )
    const values = screen
      .getAllByRole("listitem")
      .map((item) => Number(item.textContent!.match(/([\d.]+)%/)![1]))
    expect(values).toEqual([...values].sort((a, b) => b - a))
  })

  it("hands off to the chart adapter once there is room for one", () => {
    show(
      <RankingWidget datum={datum} kpi={kpi} scope={scope} variant="expanded" />
    )
    expect(screen.getByTestId("ranking")).toHaveAccessibleName(/by child unit/i)
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
  })

  it("says so plainly when there is nothing below this level", () => {
    const leaf = loadWidgetDatum("sch-dxb-01", "seatUtilisation", period)
    show(
      <RankingWidget datum={leaf} kpi={kpi} scope={scope} variant="expanded" />
    )
    expect(screen.getByText(/nothing below this level/i)).toBeInTheDocument()
  })
})

describe("TrendWidget", () => {
  const kpi = kpiById("reEnrolmentRate")
  const datum = loadWidgetDatum("emea", "reEnrolmentRate", period)

  it.each(["micro", "compact", "standard", "expanded"] as Variant[])(
    "always leads with the number at the %s variant",
    (variant) => {
      show(
        <TrendWidget datum={datum} kpi={kpi} scope={scope} variant={variant} />
      )
      expect(screen.getByRole("status")).toHaveTextContent(/%/)
    }
  )

  it("does not attempt a chart at the narrowest size", () => {
    show(
      <TrendWidget datum={datum} kpi={kpi} scope={scope} variant="micro" />,
      320
    )
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("hands off to the trend adapter once the box can carry axes", () => {
    show(
      <TrendWidget datum={datum} kpi={kpi} scope={scope} variant="expanded" />
    )
    expect(screen.getByTestId("trend")).toHaveAccessibleName(/over time/i)
  })

  it("states what the delta is measured against", () => {
    show(
      <TrendWidget datum={datum} kpi={kpi} scope={scope} variant="standard" />
    )
    expect(screen.getByText(/vs\./)).toBeInTheDocument()
  })

  it("omits the delta rather than inventing one when there is no baseline", () => {
    const orphan = { ...datum, delta: null }
    show(
      <TrendWidget datum={orphan} kpi={kpi} scope={scope} variant="standard" />
    )
    expect(screen.queryByText(/vs\./)).not.toBeInTheDocument()
  })
})
