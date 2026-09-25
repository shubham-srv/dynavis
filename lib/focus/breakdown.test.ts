import { describe, expect, it } from "vitest"

import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadWidgetDatum } from "@/lib/data/widget-data"
import {
  biggestMover,
  buildWaterfall,
  offeredBreakdowns,
  resolveBreakdown,
} from "@/lib/focus/breakdown"
import { kpiById } from "@/lib/kpi/catalog"

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const

describe("resolveBreakdown", () => {
  it("honours a requested axis the widget offers", () => {
    expect(resolveBreakdown("time", ["location", "time"])).toBe("time")
  })

  it("falls back to the default rather than erroring on a stale ?by=", () => {
    // A hand-edited or bookmarked URL should produce a useful view, not a broken one.
    expect(resolveBreakdown("component", ["location", "time"])).toBe("location")
    expect(resolveBreakdown("nonsense", ["time"])).toBe("time")
    expect(resolveBreakdown(undefined, ["location", "time"])).toBe("location")
  })
})

describe("offeredBreakdowns", () => {
  it("opens a composite on its component waterfall", () => {
    // A manager seeing margin drop wants the cost line that moved, and gets to the
    // school list second (PLAN §6.6).
    const kpi = kpiById("contributionMargin")
    const datum = loadWidgetDatum("emea", "contributionMargin", period)
    expect(offeredBreakdowns(kpi, datum)[0]).toBe("component")
  })

  it("offers no component axis for a simple metric", () => {
    const kpi = kpiById("attendanceRate")
    const datum = loadWidgetDatum("emea", "attendanceRate", period)
    expect(offeredBreakdowns(kpi, datum)).not.toContain("component")
    expect(offeredBreakdowns(kpi, datum)[0]).toBe("location")
  })

  it("drops the location axis at a leaf, where there is nothing below", () => {
    const kpi = kpiById("attendanceRate")
    const datum = loadWidgetDatum("sch-dxb-01", "attendanceRate", period)
    expect(offeredBreakdowns(kpi, datum)).toEqual(["time"])
  })

  it("always offers time, so there is never an empty focus view", () => {
    for (const id of [
      "attendanceRate",
      "contributionMargin",
      "costPerStudent",
    ]) {
      const datum = loadWidgetDatum("sch-dxb-01", id, period)
      expect(offeredBreakdowns(kpiById(id), datum)).toContain("time")
    }
  })
})

describe("buildWaterfall", () => {
  it("returns a running total across the components, in order", () => {
    const steps = buildWaterfall(kpiById("contributionMargin"), "emea", period)!
    expect(steps.map((step) => step.label)).toEqual([
      "Gross revenue",
      "Staff cost",
      "Facility cost",
      "Other cost",
    ])
    expect(steps[0].sign).toBe(1)
    expect(steps.slice(1).every((step) => step.sign === -1)).toBe(true)

    // The running total must actually accumulate.
    let running = 0
    for (const step of steps) {
      running += step.sign * step.value!
      expect(step.cumulative).toBeCloseTo(running, 6)
    }
  })

  it("ends below gross revenue, since the rest are costs", () => {
    const steps = buildWaterfall(kpiById("contributionMargin"), "uae", period)!
    expect(steps.at(-1)!.cumulative!).toBeLessThan(steps[0].value!)
    expect(steps.at(-1)!.cumulative!).toBeGreaterThan(0)
  })

  it("returns null for a KPI with no components", () => {
    expect(buildWaterfall(kpiById("attendanceRate"), "emea", period)).toBeNull()
  })

  it("returns null rather than omitting an unmeasured input", () => {
    // A waterfall missing a cost line reads as a complete picture and is not one
    // (PLAN §12.3). Better to show nothing and say why.
    const newSchool = buildWaterfall(
      kpiById("contributionMargin"),
      "sch-dxb-06",
      { kind: "academic-year", id: "ay-2023" }
    )
    expect(newSchool).toBeNull()
  })
})

describe("biggestMover", () => {
  it("names the largest cost line, which is what is being looked for", () => {
    const steps = buildWaterfall(kpiById("contributionMargin"), "emea", period)!
    const mover = biggestMover(steps)!
    const costs = steps.filter((step) => step.sign === -1)
    expect(mover.value).toBe(Math.max(...costs.map((step) => step.value!)))
  })

  it("ignores the positive line — revenue is not a mover", () => {
    const steps = buildWaterfall(kpiById("contributionMargin"), "emea", period)!
    expect(biggestMover(steps)!.sign).toBe(-1)
  })

  it("returns null when there are no cost lines", () => {
    expect(
      biggestMover([{ label: "Revenue", value: 10, sign: 1, cumulative: 10 }])
    ).toBeNull()
  })
})
