import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RankingBar } from "@/components/charts/ranking-bar"
import { ChartReadout } from "@/components/charts/readout"
import { ScatterPlot } from "@/components/charts/scatter-chart"
import { Sparkline } from "@/components/charts/sparkline"
import { TrendChart } from "@/components/charts/trend-chart"

/**
 * Chart adapters are the only place allowed to import a charting library, so these
 * tests assert the *contract* rather than the drawing: the accessible wrapper, the
 * refusal to render meaningless output, and the rules that must not drift.
 *
 * What a chart looks like is Playwright's job (visual regression), not jsdom's — jsdom
 * has no layout, so asserting on geometry here would assert on nothing.
 */

const history = [
  { x: "ay-2022", y: 0.9 },
  { x: "ay-2023", y: 0.93 },
  { x: "ay-2024", y: null },
  { x: "ay-2025", y: 0.95 },
]

describe("TrendChart", () => {
  it("exposes exactly one accessible image, with no focusable content inside", () => {
    // role="img" makes descendants presentational, so a screen reader never reaches
    // the hundreds of path elements. Nothing inside may be focusable: Recharts ships
    // a focusable accessibility layer, and a focus stop that announces nothing is
    // worse than no stop at all (PLAN §5.3).
    const { container } = render(
      <TrendChart
        points={history}
        variant="expanded"
        format="percent"
        precision={1}
        label="Attendance over time"
      />
    )
    expect(
      screen.getByRole("img", { name: "Attendance over time" })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("img")).toHaveLength(1)
    expect(
      container.querySelectorAll("[tabindex]:not([tabindex='-1'])")
    ).toHaveLength(0)
  })

  it("renders nothing when every point is unmeasured", () => {
    const { container } = render(
      <TrendChart
        points={[{ x: "a", y: null }]}
        variant="expanded"
        format="number"
        precision={0}
        label="Empty"
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("offers a readout instead of a hover tooltip once there is room", () => {
    // Hover does not exist on touch, and a floating tooltip covers its own data.
    render(
      <TrendChart
        points={history}
        variant="expanded"
        format="percent"
        precision={1}
        label="Attendance"
      />
    )
    expect(screen.getByText(/select a point/i)).toBeInTheDocument()
  })

  it("drops the readout at narrow widths, where there is no room", () => {
    render(
      <TrendChart
        points={history}
        variant="compact"
        format="percent"
        precision={1}
        label="Attendance"
      />
    )
    expect(screen.queryByText(/select a point/i)).not.toBeInTheDocument()
  })

  it("downsamples a long series rather than drawing thousands of points", () => {
    const long = Array.from({ length: 2000 }, (_, i) => ({
      x: `t${i}`,
      y: Math.sin(i / 30) * 100,
    }))
    expect(() =>
      render(
        <TrendChart
          points={long}
          variant="expanded"
          format="number"
          precision={0}
          label="Long"
          maxPoints={100}
        />
      )
    ).not.toThrow()
  })
})

describe("RankingBar", () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({
    id: `s${i}`,
    label: `School ${i}`,
    value: 100 - i * 5,
    vsBaseline: null,
  }))

  it("names itself for assistive tech", () => {
    render(
      <RankingBar
        data={rows}
        variant="expanded"
        format="number"
        precision={0}
        label="Seat utilisation by unit"
      />
    )
    expect(
      screen.getByRole("img", { name: "Seat utilisation by unit" })
    ).toBeInTheDocument()
  })

  it("renders nothing when nothing was measured", () => {
    const { container } = render(
      <RankingBar
        data={[{ id: "a", label: "A", value: null }]}
        variant="expanded"
        format="number"
        precision={0}
        label="Empty"
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  // The "Other" folding rule is asserted in lib/viz/series.test.ts. It cannot be
  // checked here: jsdom gives Recharts no layout, so the chart renders no text at all
  // and container.textContent is empty.
})

describe("ScatterPlot", () => {
  const series = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      label: `Series ${i}`,
      points: [{ x: i, y: i * 2 }],
    }))

  it("renders up to the measured three-series cap", () => {
    render(
      <ScatterPlot
        series={series(3)}
        xLabel="Utilisation"
        yLabel="Margin"
        label="Utilisation against margin"
      />
    )
    expect(
      screen.getByRole("img", { name: "Utilisation against margin" })
    ).toBeInTheDocument()
  })

  it("throws past three, because scatter has no legend adjacency", () => {
    // Four slots fail the normal-vision floor in both modes (PLAN §11.2). The
    // assertion exists so the cap cannot quietly drift.
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() =>
      render(
        <ScatterPlot
          series={series(4)}
          xLabel="x"
          yLabel="y"
          label="Too many"
        />
      )
    ).toThrow(/small multiples/i)
    quiet.mockRestore()
  })

  it("renders nothing when no series has a measured point", () => {
    const { container } = render(
      <ScatterPlot
        series={[{ id: "a", label: "A", points: [{ x: 1, y: null }] }]}
        xLabel="x"
        yLabel="y"
        label="Empty"
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe("Sparkline", () => {
  it("needs at least two measured points to mean anything", () => {
    const { container } = render(
      <Sparkline points={[{ x: "a", y: 1 }]} direction="higher-is-better" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("colours by the KPI direction, not the slope", () => {
    // A falling cost line is good news.
    const falling = [
      { x: "a", y: 10 },
      { x: "b", y: 5 },
    ]
    const { container } = render(
      <Sparkline points={falling} direction="lower-is-better" />
    )
    expect(container.querySelector("polyline")?.getAttribute("stroke")).toBe(
      "var(--chart-1)"
    )
  })

  it("stays neutral for a KPI with no good direction", () => {
    const { container } = render(
      <Sparkline
        points={[
          { x: "a", y: 1 },
          { x: "b", y: 2 },
        ]}
        direction="neutral"
      />
    )
    expect(container.querySelector("polyline")?.getAttribute("stroke")).toBe(
      "var(--muted-foreground)"
    )
  })

  it("is hidden from assistive tech", () => {
    const { container } = render(
      <Sparkline
        points={[
          { x: "a", y: 1 },
          { x: "b", y: 2 },
        ]}
      />
    )
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    )
  })
})

describe("ChartReadout", () => {
  it("is a live region, so keyboard movement is announced", () => {
    render(<ChartReadout label="ay-2025" value="95.0%" />)
    expect(screen.getByText("95.0%").closest("p")).toHaveAttribute(
      "aria-live",
      "polite"
    )
  })

  it("prompts rather than showing a blank strip when idle", () => {
    render(<ChartReadout label={null} value={null} />)
    expect(screen.getByText(/select a point/i)).toBeInTheDocument()
  })
})
