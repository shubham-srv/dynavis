import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

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
 * Chart adapters are next/dynamic'd to keep Recharts out of the first-load bundle, so
 * these assertions wait on a real dynamic import plus the Recharts module graph.
 *
 * Both numbers matter and the query timeout must stay UNDER the test timeout —
 * a findBy that waits longer than Vitest allows the test to live can never succeed.
 */
const LAZY_CHART_TIMEOUT = 8_000
const LAZY_CHART_TEST_TIMEOUT = 20_000

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

  it(
    "draws a chart once there is room for one",
    async () => {
      // findBy, not getBy: the chart adapter is next/dynamic'd to keep Recharts out of
      // the first-load bundle, so it resolves a tick later (PLAN §15).
      show(
        <RankingWidget
          datum={datum}
          kpi={kpi}
          scope={scope}
          variant="expanded"
        />
      )
      expect(
        await screen.findByRole(
          "img",
          { name: /by child unit/i },
          // Generous: this waits on a real dynamic import plus the Recharts module
          // graph, which exceeds RTL's 1s default on a cold or busy machine.
          { timeout: LAZY_CHART_TIMEOUT }
        )
      ).toBeInTheDocument()
    },
    LAZY_CHART_TEST_TIMEOUT
  )

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

  it(
    "draws the trend once the box can carry axes",
    async () => {
      show(
        <TrendWidget datum={datum} kpi={kpi} scope={scope} variant="expanded" />
      )
      expect(
        await screen.findByRole(
          "img",
          { name: /over time/i },
          { timeout: LAZY_CHART_TIMEOUT }
        )
      ).toBeInTheDocument()
    },
    LAZY_CHART_TEST_TIMEOUT
  )

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
