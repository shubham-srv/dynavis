import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { ContainerSizeProvider } from "@/components/dashboard/container-size"
import { QuadrantWidget } from "@/components/widgets/quadrant-widget"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { loadForWidget } from "@/lib/data/widget-data"
import { kpiById } from "@/lib/kpi/catalog"
import { widgetById } from "@/lib/registry/registry"
import { resolveScope } from "@/lib/scope/resolve"
import { VARIANT_MIN_WIDTH, type Variant } from "@/lib/viz/variants"

/**
 * The substitution ladder, asserted rung by rung.
 *
 * "Renders responsively" is unarguable at review time, so these tests name the form each
 * width must produce. The assertions are deliberately about *kind* — a sentence, four
 * counts, an SVG — because that is the claim the product makes (PLAN D1): at no width is
 * this the same chart with less in it.
 *
 * Widths are injected through `ContainerSizeProvider`, so nothing here depends on jsdom
 * having a layout engine — the usual reason chart suites get abandoned (PLAN §14).
 */

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const
const widget = widgetById("quadrant.costVsAttainment")
const kpi = kpiById(widget.kpiId)
const scope = resolveScope(["emea"], fixtureLookup)!
const datum = loadForWidget(widget, "emea", period)

function renderAt(variant: Variant, override?: typeof datum) {
  return render(
    <ContainerSizeProvider width={VARIANT_MIN_WIDTH[variant]}>
      <QuadrantWidget
        datum={override ?? datum}
        kpi={kpi}
        scope={scope}
        variant={variant}
      />
    </ContainerSizeProvider>
  )
}

describe("the fixture this is asserted against", () => {
  it("has enough schools to correlate, or the ladder below proves nothing", () => {
    expect(datum.pair).toBeDefined()
    expect(datum.pair!.points.length).toBeGreaterThanOrEqual(3)
  })
})

describe("micro", () => {
  it("states the finding as a sentence", () => {
    renderAt("micro")
    // The relationship in words, naming how many schools it is drawn from.
    expect(
      screen.getByText(new RegExp(`across ${datum.pair!.points.length} schools`, "i"))
    ).toBeInTheDocument()
  })

  it("draws no chart at all", () => {
    /*
      The load-bearing assertion of the whole design. Rendering a chart and hiding it with
      CSS would still cost the layout, the accessibility tree and the paint — and it would
      mean the narrow form was a shrunken chart after all, which is the thing this product
      exists to not do.
    */
    const { container } = renderAt("micro")
    expect(container.querySelector("svg")).toBeNull()
    expect(screen.queryByRole("img")).toBeNull()
  })
})

describe("compact", () => {
  it("substitutes quadrant counts for the scatter", () => {
    const { container } = renderAt("compact")
    // Still no chart: the insight without the geometry.
    expect(container.querySelector("svg")).toBeNull()

    const tiles = screen.getAllByRole("listitem")
    expect(tiles).toHaveLength(4)
  })

  it("accounts for every plotted school across the four tiles", () => {
    // A count that does not sum to the population is worse than no count: a reader who
    // adds up the tiles and gets the wrong estate size stops believing the rest.
    renderAt("compact")
    const total = screen
      .getAllByRole("listitem")
      .map((tile) => Number(tile.getAttribute("data-count")))
      .reduce((sum, count) => sum + count, 0)
    expect(total).toBe(datum.pair!.points.length)
  })

  it("leads with the best-placed group rather than with geometry", () => {
    // Ordered low-low, high-low… would bury "needs attention" in the middle of the card.
    renderAt("compact")
    const first = screen.getAllByRole("listitem")[0]
    expect(first.textContent?.toLowerCase()).toContain("low cost per student")
  })
})

describe("standard", () => {
  it("draws the real scatter", () => {
    const { container } = renderAt("standard")
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg!.querySelectorAll("circle").length).toBe(
      datum.pair!.points.length
    )
  })

  it("labels the chart with what it plots and how many schools", () => {
    renderAt("standard")
    expect(
      screen.getByRole("img", { name: /attainment.*against.*cost per student/i })
    ).toBeInTheDocument()
  })

  it("drops the size channel, rather than scaling it down", () => {
    /*
      At this width the whole enrolment range spans about four pixels, which encodes
      nothing and makes overlapping marks harder to count. Every mark is therefore the
      same size — a dropped encoding, not a shrunken one (PLAN §11.4).
    */
    const { container } = renderAt("standard")
    const radii = Array.from(container.querySelectorAll("circle")).map(
      (circle) => circle.getAttribute("r")
    )
    expect(new Set(radii).size).toBe(1)
  })
})

describe("expanded", () => {
  it("adds the size channel once there is room to read it", () => {
    const { container } = renderAt("expanded")
    const radii = Array.from(container.querySelectorAll("circle")).map(
      (circle) => circle.getAttribute("r")
    )
    expect(new Set(radii).size).toBeGreaterThan(1)
  })

  it("keeps every mark above the minimum hit size", () => {
    const { container } = renderAt("expanded")
    for (const circle of container.querySelectorAll("circle")) {
      expect(Number(circle.getAttribute("r"))).toBeGreaterThanOrEqual(4)
    }
  })
})

describe("honesty", () => {
  it("says so when too few schools report both measures", () => {
    const thin = {
      ...datum,
      pair: { ...datum.pair!, points: datum.pair!.points.slice(0, 2) },
    }
    renderAt("standard", thin)
    expect(screen.getByText(/too few to compare/i)).toBeInTheDocument()
  })

  it("reports how many schools are missing rather than hiding them", () => {
    // A scatter that quietly loses a quarter of the estate is how people stop trusting a
    // dashboard (PLAN §12.3).
    const withGaps = {
      ...datum,
      pair: {
        ...datum.pair!,
        unmeasured: [{ id: "sch-eg-01", label: "New Cairo International" }],
      },
    }
    renderAt("micro", withGaps)
    const plotted = datum.pair!.points.length
    expect(
      screen.getByText(
        new RegExp(`${plotted} of ${plotted + 1} schools report both`, "i")
      )
    ).toBeInTheDocument()
  })

  it("renders an explanation, not a crash, when no pair was loaded", () => {
    const unpaired = { ...datum, pair: undefined }
    renderAt("standard", unpaired)
    expect(screen.getByText(/needs a paired KPI/i)).toBeInTheDocument()
  })
})

describe("compact — asking which schools", () => {
  it("names the schools in a group when its tile is chosen", async () => {
    /*
      A count answers "how many"; the next question is always "which ones". At this width
      there is nowhere else to ask it — the scatter that would show you is precisely what
      this rung replaced — so the tile has to answer it.
    */
    const user = userEvent.setup()
    renderAt("compact")

    expect(screen.getByText(/select a group/i)).toBeInTheDocument()

    const tile = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("Low cost per student"))!
    await user.click(tile)

    const panel = screen.getByRole("group", { name: /schools with/i })
    const named = within(panel).getAllByRole("listitem")
    expect(named.length).toBe(Number(tile.closest("li")!.dataset.count))
  })

  it("is a real button, so the answer is reachable without a pointer", async () => {
    // A tinted div with a click handler would leave keyboard and screen-reader users with
    // a count and no way to ask about it.
    const user = userEvent.setup()
    renderAt("compact")

    const tile = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("Low cost per student"))!
    expect(tile).toHaveAttribute("aria-expanded", "false")

    tile.focus()
    await user.keyboard("{Enter}")
    expect(tile).toHaveAttribute("aria-expanded", "true")
  })

  it("closes when the open tile is chosen again", async () => {
    const user = userEvent.setup()
    renderAt("compact")
    const tile = screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("Low cost per student"))!

    await user.click(tile)
    expect(tile).toHaveAttribute("aria-expanded", "true")
    await user.click(tile)
    expect(tile).toHaveAttribute("aria-expanded", "false")
  })

  it("does not offer to open an empty group", () => {
    // Nothing to show, so the affordance is not there to be tried.
    const single = {
      ...datum,
      pair: { ...datum.pair!, points: datum.pair!.points.slice(0, 4) },
    }
    renderAt("compact", single)
    const empty = screen
      .getAllByRole("button")
      .filter((button) => button.closest("li")?.dataset.count === "0")
    for (const button of empty) expect(button).toBeDisabled()
  })
})

describe("standard — driving the readout", () => {
  it("selects the nearest mark on a tap, not only on a hover", async () => {
    /*
      The bug this covers: the chart listened only for pointermove, and a tap emits
      pointerdown and pointerup with no move between them. On a phone or tablet nothing
      ever happened.
    */
    const { container } = renderAt("standard")
    const svg = container.querySelector("svg")!
    const circle = svg.querySelector("circle")!

    const cx = Number(circle.getAttribute("cx"))
    const cy = Number(circle.getAttribute("cy"))
    // jsdom reports a zero-sized box, which makes the viewBox mapping identity — so the
    // viewBox coordinates are the client coordinates here.
    fireEvent.pointerDown(svg, { clientX: cx, clientY: cy, pointerType: "touch" })

    expect(screen.queryByText(/tap a point/i)).not.toBeInTheDocument()
  })

  it("keeps the readout after a finger lifts", () => {
    // pointerleave fires when a finger is raised. Clearing on it wiped the value the tap
    // had just produced, before anyone could read it.
    const { container } = renderAt("standard")
    const svg = container.querySelector("svg")!
    const circle = svg.querySelector("circle")!

    fireEvent.pointerDown(svg, {
      clientX: Number(circle.getAttribute("cx")),
      clientY: Number(circle.getAttribute("cy")),
      pointerType: "touch",
    })
    fireEvent.pointerLeave(svg, { pointerType: "touch" })

    expect(screen.queryByText(/tap a point/i)).not.toBeInTheDocument()
  })

  it("walks the marks with the arrow keys", async () => {
    // One tab stop for the chart, then arrows — twenty-three tab stops would be worse than
    // no access at all (PLAN §7).
    const user = userEvent.setup()
    const { container } = renderAt("standard")
    const svg = container.querySelector("svg")!

    expect(svg).toHaveAttribute("tabindex", "0")
    svg.focus()
    await user.keyboard("{ArrowRight}")
    expect(screen.queryByText(/tap a point/i)).not.toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.getByText(/tap a point/i)).toBeInTheDocument()
  })

  it("lets the page scroll past it on touch", () => {
    // `touch-action: none` swallowed the page scroll wherever the chart filled the screen.
    const { container } = renderAt("standard")
    const svg = container.querySelector("svg")! as unknown as SVGElement
    expect((svg as unknown as HTMLElement).style.touchAction).toBe("pan-y")
  })
})
