import { describe, expect, it } from "vitest"

import {
  baselineLabel,
  baselineValue,
  computeVsBaseline,
  resolveBaseline,
} from "@/lib/baseline/resolve"
import type { Baseline } from "@/lib/data/envelope"

const priorPeriod = { kind: "academic-year", id: "ay-2024" } as const

describe("resolveBaseline", () => {
  it("prefers a target when one exists", () => {
    const baseline = resolveBaseline("target", {
      target: 0.92,
      priorValue: 0.88,
      priorPeriod,
    })
    expect(baseline).toEqual({ kind: "target", value: 0.92, band: undefined })
  })

  it("falls through to the prior period when there is no target", () => {
    // The realistic case: most KPIs have no agreed target (PLAN §8.4).
    const baseline = resolveBaseline("target", {
      priorValue: 0.88,
      priorPeriod,
    })
    expect(baseline).toEqual({
      kind: "prior-period",
      value: 0.88,
      period: priorPeriod,
    })
  })

  it("falls through to the peer median when there is neither", () => {
    const baseline = resolveBaseline("target", {
      peerValues: [0.8, 0.9, 0.7, null],
    })
    expect(baseline).toEqual({
      kind: "peer-median",
      value: 0.8,
      n: 3,
      band: undefined,
    })
  })

  it("ends at 'none' rather than inventing a comparison", () => {
    expect(resolveBaseline("target", {})).toEqual({ kind: "none" })
    expect(resolveBaseline("target", { peerValues: [null, null] })).toEqual({
      kind: "none",
    })
  })

  it("honours an explicitly requested weaker baseline", () => {
    // "Compare against: last year" must not silently upgrade itself to a target.
    const baseline = resolveBaseline("prior-period", {
      target: 0.92,
      priorValue: 0.88,
      priorPeriod,
    })
    expect(baseline.kind).toBe("prior-period")
  })

  it("keeps a prior-period baseline even when the prior reading is missing", () => {
    // A school that opened this year gets "new", not a peer comparison it never asked for.
    const baseline = resolveBaseline("prior-period", {
      priorPeriod,
      peerValues: [0.8, 0.9],
    })
    expect(baseline).toEqual({
      kind: "prior-period",
      value: null,
      period: priorPeriod,
    })
  })

  it("reports n, so a median of 3 can be labelled as one", () => {
    const baseline = resolveBaseline("peer-median", {
      peerValues: [0.8, 0.9, 0.7],
    })
    expect(baseline).toMatchObject({ n: 3 })
  })

  it("treats an unknown preference as the top of the chain", () => {
    expect(resolveBaseline("nonsense" as never, { target: 1 }).kind).toBe(
      "target"
    )
  })
})

describe("baselineValue", () => {
  it("extracts the comparison value, or null when there is none", () => {
    expect(baselineValue({ kind: "target", value: 0.9 })).toBe(0.9)
    expect(
      baselineValue({ kind: "prior-period", value: null, period: priorPeriod })
    ).toBeNull()
    expect(baselineValue({ kind: "none" })).toBeNull()
  })
})

describe("computeVsBaseline — direction handling", () => {
  const target = (
    value: number,
    band?: { min: number; max: number }
  ): Baseline => ({
    kind: "target",
    value,
    band,
  })

  it("scores above target as good when higher is better", () => {
    expect(
      computeVsBaseline(0.95, target(0.9), "higher-is-better", 0.05)
    ).toBeCloseTo(1, 6)
    expect(
      computeVsBaseline(0.85, target(0.9), "higher-is-better", 0.05)
    ).toBeCloseTo(-1, 6)
  })

  it("scores above target as BAD when lower is better", () => {
    // The single most likely bug in the matrix: colouring rising cost green.
    const cost = computeVsBaseline(
      11_000,
      target(10_000),
      "lower-is-better",
      1_000
    )
    expect(cost).toBeCloseTo(-1, 6)
    expect(
      computeVsBaseline(9_000, target(10_000), "lower-is-better", 1_000)
    ).toBeCloseTo(1, 6)
  })

  it("treats both sides of a band as bad", () => {
    const band = target(15, { min: 12, max: 18 })
    // Inside the band is neutral, not good — there is nothing to celebrate.
    expect(computeVsBaseline(15, band, "band")).toBe(0)
    expect(computeVsBaseline(12, band, "band")).toBe(0)
    expect(computeVsBaseline(18, band, "band")).toBe(0)
    // Understaffed and overstaffed both score negative.
    expect(computeVsBaseline(9, band, "band")).toBeLessThan(0)
    expect(computeVsBaseline(21, band, "band")).toBeLessThan(0)
  })

  it("refuses to judge a band KPI with no agreed band", () => {
    // Guessing "the ratio fell, that's good" tells a CFO understaffing is an improvement.
    expect(computeVsBaseline(9, target(15), "band")).toBeNull()
  })

  it("never judges a neutral KPI, though its delta is still shown elsewhere", () => {
    expect(computeVsBaseline(1200, target(1000), "neutral")).toBeNull()
  })

  it("returns null when there is nothing to compare against", () => {
    expect(
      computeVsBaseline(0.9, { kind: "none" }, "higher-is-better")
    ).toBeNull()
    expect(
      computeVsBaseline(
        0.9,
        { kind: "prior-period", value: null, period: priorPeriod },
        "higher-is-better"
      )
    ).toBeNull()
  })

  it("returns null for an unmeasured value rather than scoring it zero", () => {
    expect(computeVsBaseline(null, target(0.9), "higher-is-better")).toBeNull()
    expect(
      computeVsBaseline(Number.NaN, target(0.9), "higher-is-better")
    ).toBeNull()
  })

  it("clamps outliers so one bad row cannot flatten the matrix", () => {
    expect(computeVsBaseline(500, target(1), "higher-is-better")).toBe(1)
    expect(computeVsBaseline(-500, target(1), "higher-is-better")).toBe(-1)
  })

  it("uses a relative default tolerance when the KPI declares none", () => {
    // 10% of the baseline is "fully off" by default.
    expect(computeVsBaseline(110, target(100), "higher-is-better")).toBeCloseTo(
      1,
      6
    )
    expect(computeVsBaseline(105, target(100), "higher-is-better")).toBeCloseTo(
      0.5,
      6
    )
  })

  it("lets a rate KPI declare a tolerance, because relative deviation understates rates", () => {
    // 93% against a 95% attendance target is 2% relative — and very material.
    const withDefault = computeVsBaseline(
      0.93,
      target(0.95),
      "higher-is-better"
    )!
    const withTolerance = computeVsBaseline(
      0.93,
      target(0.95),
      "higher-is-better",
      0.05
    )!
    expect(Math.abs(withDefault)).toBeLessThan(0.25)
    expect(Math.abs(withTolerance)).toBeCloseTo(0.4, 6)
  })

  it("survives a zero baseline without producing Infinity", () => {
    expect(computeVsBaseline(5, target(0), "higher-is-better")).toBe(1)
  })
})

describe("baselineLabel", () => {
  it("always says what the number is measured against", () => {
    expect(baselineLabel({ kind: "target", value: 0.9 })).toBe("vs. target")
    expect(
      baselineLabel(
        { kind: "prior-period", value: 0.8, period: priorPeriod },
        "2024/25"
      )
    ).toBe("vs. 2024/25")
    expect(baselineLabel({ kind: "peer-median", value: 0.8, n: 22 })).toBe(
      "vs. peer median, n=22"
    )
    expect(baselineLabel({ kind: "none" })).toBe("no baseline")
  })

  it("falls back to the period id when no label is supplied", () => {
    expect(
      baselineLabel({ kind: "prior-period", value: 0.8, period: priorPeriod })
    ).toBe("vs. ay-2024")
  })
})
