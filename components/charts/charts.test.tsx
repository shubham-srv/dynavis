import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  labelDomain,
  prefersRows,
  RankingBar,
  rowAxisWidth,
  wrapName,
} from "@/components/charts/ranking-bar"
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

describe("RankingBar — reading the category names", () => {
  const COUNTRIES = ["United Kingdom", "United Arab Emirates", "Egypt"]

  it("uses rows below expanded, whatever the width", () => {
    // The long-standing rule: category names read as left-aligned text, never rotated
    // (PLAN §7).
    for (const variant of ["micro", "compact", "standard"] as const) {
      expect(prefersRows(variant, COUNTRIES, 1400)).toBe(true)
    }
  })

  it("uses columns at expanded when the names fit under them", () => {
    expect(prefersRows("expanded", COUNTRIES, 1400)).toBe(false)
  })

  it("turns horizontal when a name is too long for its column", () => {
    /*
      The bug: at `expanded` the chart always used columns, so "United Kingdom" and
      "United Arab Emirates" were drawn overlapping. Rotating is banned by §7 and
      truncating leaves two labels that both read "United…", so the chart changes
      orientation instead — substitution, for the same reason as everywhere else.
    */
    const longNames = [
      "Sheikh Zayed Academy for Advanced Studies",
      "Docklands International Secondary",
      "Alexandria Bay College",
    ]
    expect(prefersRows("expanded", longNames, 1400)).toBe(true)
  })

  it("turns horizontal when many categories squeeze the bands", () => {
    // Twelve columns share the full width, so each band is narrow even though every name
    // is short enough on its own.
    const many = Array.from({ length: 12 }, (_, i) => `Cluster number ${i + 1}`)
    expect(prefersRows("expanded", many, 700)).toBe(true)
  })

  it("leaves the variant in charge until it has been measured", () => {
    // Width 0 is "not measured yet", the same convention the rest of the app uses.
    // Guessing rows here would flip the chart's orientation on first paint.
    expect(prefersRows("expanded", COUNTRIES, 0)).toBe(false)
  })

  it("renders the measured rows either way", () => {
    render(
      <RankingBar
        data={COUNTRIES.map((label, index) => ({
          id: `r${index}`,
          label,
          value: 10 + index,
        }))}
        variant="expanded"
        format="number"
        precision={1}
        label="ratio by country"
      />
    )
    expect(
      screen.getByRole("img", { name: /ratio by country/i })
    ).toBeInTheDocument()
  })
})

describe("RankingBar — fitting the text in", () => {
  describe("wrapName", () => {
    it("keeps a short name on one line", () => {
      expect(wrapName("Egypt", 16)).toEqual(["Egypt"])
    })

    it("breaks a long name across two lines on a word boundary", () => {
      expect(wrapName("Port Melbourne Academy", 16)).toEqual([
        "Port Melbourne",
        "Academy",
      ])
    })

    it("never produces a third line", () => {
      /*
        PLAN §7: truncate with a title attribute, never wrap to three lines. Recharts wraps
        on word boundaries with no line cap, so narrowing the gutter stacked
        "Port / Melbourne / Academy" into the rows above and below.
      */
      const lines = wrapName("Sheikh Zayed Academy for Advanced Studies", 12)
      expect(lines).toHaveLength(2)
      expect(lines[1].endsWith("…")).toBe(true)
    })

    it("breaks a single word too long for the gutter rather than overflowing it", () => {
      // Some school names are one long word, and a word that ignored the gutter would be
      // drawn straight across the bars.
      const lines = wrapName("Aussenhandelsakademie", 10)
      expect(lines).toHaveLength(2)
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(10)
    })

    it("survives an empty name", () => {
      expect(wrapName("", 12)).toEqual([])
    })
  })

  describe("rowAxisWidth", () => {
    it("gives the gutter a third of a small card, not 132 fixed pixels", () => {
      // At 311px the fixed width took 42% of the card, leaving the bars and both value
      // labels to share what was left.
      expect(rowAxisWidth(311)).toBeLessThan(132)
      expect(rowAxisWidth(311)).toBeGreaterThanOrEqual(104)
    })

    it("stops widening once names have enough room", () => {
      expect(rowAxisWidth(1200)).toBe(132)
    })

    it("falls back to the maximum before measurement", () => {
      expect(rowAxisWidth(0)).toBe(132)
    })
  })

  describe("labelDomain", () => {
    const CHAR = 6.2
    const GAP = 6
    const CLEAR = 14
    const labelPx = (chars: number) => chars * CHAR + GAP + CLEAR

    it("reserves room on the negative side, where the axis labels are", () => {
      // "-38.5%" was printed straight through "Adelaide Hills School" because the bar ran
      // to the very edge of the plot and the label had nowhere else to go.
      const values = [0.191, 0.175, -0.256, -0.385]
      const [lo, hi] = labelDomain(values, 6, 543)!
      expect(lo).toBeLessThan(-0.385)
      expect(hi).toBeGreaterThan(0.191)
    })

    it("reserves the room it was asked for, not a fraction of it", () => {
      /*
        The bug in the first attempt: `pad = (labelPx / plotPx) * range` measures against
        the *unpadded* range, but adding the padding widens the domain — so the padding
        maps to fewer pixels than requested and the label overhangs by the difference.
      */
      const values = [0.191, -0.385]
      const width = 400
      const chars = 6
      const [lo, hi] = labelDomain(values, chars, width)!

      const plotPx = width - rowAxisWidth(width)
      const span = hi - lo
      const padPx = ((Math.min(...values) - lo) / span) * plotPx
      expect(padPx).toBeGreaterThanOrEqual(labelPx(chars) - 1)
    })

    it("does not pad an end that has no bars", () => {
      // Every value positive: the left edge is the zero line and nothing is drawn past it.
      const [lo] = labelDomain([0.2, 0.4], 5, 600)!
      expect(lo).toBe(0)
    })

    it("caps the reservation rather than squeezing the bars away", () => {
      // A very narrow plot with very long labels: honouring the request exactly would
      // leave the bars a sliver, which has stopped being a ranking.
      const [lo, hi] = labelDomain([0.2, -0.4], 14, 220)!
      const span = hi - lo
      expect(span).toBeLessThan(0.6 * 3)
    })

    it("has no opinion before the chart has been measured", () => {
      expect(labelDomain([0.2, -0.4], 6, 0)).toBeUndefined()
    })
  })
})
