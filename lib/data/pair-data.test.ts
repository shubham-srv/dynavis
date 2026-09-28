import { describe, expect, it } from "vitest"

import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadPairedChildren } from "./pair-data"

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const

describe("loadPairedChildren", () => {
  it("joins two KPIs across the children of a scope", () => {
    const pair = loadPairedChildren(
      "emea",
      "costPerStudent",
      "attainmentRate",
      period
    )

    expect(pair.points.length).toBeGreaterThan(2)
    for (const point of pair.points) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
      expect(point.label.trim().length).toBeGreaterThan(0)
    }
  })

  it("gives every point a distinct id, so marks cannot collide", () => {
    const pair = loadPairedChildren(
      "group",
      "costPerStudent",
      "attainmentRate",
      period
    )
    const ids = pair.points.map((point) => point.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("drops a unit missing either measure instead of imputing zero", () => {
    /*
      The rule that matters most here (PLAN §12.3). A point plotted at its real cost with
      attainment imputed to zero is not a gap in the data — it is a false claim about a
      school, and on a quadrant chart it lands in "needs attention" and gets counted there.
    */
    // Egypt is the fixture's deliberately sparse reporter — no value-added score is
    // collected there at all — and `unreportedKpis` cascades to its schools, which are
    // what this loader plots.
    const pair = loadPairedChildren(
      "emea",
      "costPerStudent",
      "progressScore",
      period
    )

    expect(pair.unmeasured.map((one) => one.label)).toContain(
      "New Cairo International"
    )
    for (const point of pair.points) {
      expect(point.y).not.toBe(0)
    }
  })

  it("accounts for every child — plotted plus unmeasured, none lost", () => {
    const pair = loadPairedChildren(
      "emea",
      "costPerStudent",
      "progressScore",
      period
    )
    const all = loadPairedChildren(
      "emea",
      "costPerStudent",
      "costPerStudent",
      period
    )
    expect(pair.points.length + pair.unmeasured.length).toBe(
      all.points.length + all.unmeasured.length
    )
  })

  it("attaches a weight when asked, and copes with it being absent", () => {
    const pair = loadPairedChildren(
      "emea",
      "costPerStudent",
      "attainmentRate",
      period,
      { weightKpiId: "grossRevenue" }
    )
    expect(pair.weightKpiId).toBe("grossRevenue")
    expect(
      pair.points.some((point) => typeof point.weight === "number")
    ).toBe(true)

    // A unit missing only the weight is still plotted: the position is the finding, and
    // the radius is an extra channel that is allowed to be absent.
    const unweighted = loadPairedChildren(
      "emea",
      "costPerStudent",
      "attainmentRate",
      period
    )
    expect(unweighted.points.length).toBe(pair.points.length)
  })

  it("falls back to the schools beneath a scope with no children", () => {
    // A school has nothing below it, but "cost against attainment" is still a fair
    // question there — answered by its peers rather than by itself.
    const pair = loadPairedChildren(
      "sch-dxb-01",
      "costPerStudent",
      "attainmentRate",
      period
    )
    expect(pair.points.length + pair.unmeasured.length).toBeGreaterThan(0)
  })

  it("throws on an unknown KPI rather than rendering an empty chart", () => {
    // An empty chart looks like "no data" and sends someone hunting through fixtures.
    expect(() =>
      loadPairedChildren("emea", "notAKpi", "attainmentRate", period)
    ).toThrow(RangeError)
  })

  it("throws on an unknown scope", () => {
    expect(() =>
      loadPairedChildren("atlantis", "costPerStudent", "attainmentRate", period)
    ).toThrow(RangeError)
  })
})
