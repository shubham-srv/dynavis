import { describe, expect, it } from "vitest"

import {
  meanIgnoringNulls,
  medianIgnoringNulls,
  rankWithin,
  sumIgnoringNulls,
} from "@/lib/data/aggregate"

describe("meanIgnoringNulls", () => {
  it("averages only what was measured", () => {
    expect(meanIgnoringNulls([80, 90, 100])).toEqual({
      value: 90,
      n: 3,
      missing: 0,
    })
  })

  it("does not let a missing value drag the average towards zero", () => {
    // The bug: treating null as 0 would give 45 here and quietly punish whichever
    // region reports least.
    expect(meanIgnoringNulls([80, null, 100])).toEqual({
      value: 90,
      n: 2,
      missing: 1,
    })
  })

  it("returns null, not zero, when nothing was measured", () => {
    expect(meanIgnoringNulls([null, undefined])).toEqual({
      value: null,
      n: 0,
      missing: 2,
    })
    expect(meanIgnoringNulls([])).toEqual({ value: null, n: 0, missing: 0 })
  })

  it("treats NaN and Infinity as missing rather than poisoning the result", () => {
    expect(meanIgnoringNulls([10, Number.NaN, 20])).toEqual({
      value: 15,
      n: 2,
      missing: 1,
    })
    expect(meanIgnoringNulls([10, Number.POSITIVE_INFINITY])).toEqual({
      value: 10,
      n: 1,
      missing: 1,
    })
  })

  it("counts genuine zeros as measured", () => {
    expect(meanIgnoringNulls([0, 10])).toEqual({ value: 5, n: 2, missing: 0 })
  })
})

describe("sumIgnoringNulls", () => {
  it("sums the measured values and reports the gaps", () => {
    expect(sumIgnoringNulls([1, null, 2, 3])).toEqual({
      value: 6,
      n: 3,
      missing: 1,
    })
    expect(sumIgnoringNulls([null])).toEqual({ value: null, n: 0, missing: 1 })
  })
})

describe("medianIgnoringNulls", () => {
  it("takes the middle of an odd population", () => {
    expect(medianIgnoringNulls([5, 1, 3])).toEqual({
      value: 3,
      n: 3,
      missing: 0,
    })
  })

  it("averages the two middles of an even population", () => {
    expect(medianIgnoringNulls([1, 2, 3, 4])).toEqual({
      value: 2.5,
      n: 4,
      missing: 0,
    })
  })

  it("does not mutate its input", () => {
    const input = [3, 1, 2]
    medianIgnoringNulls(input)
    expect(input).toEqual([3, 1, 2])
  })

  it("reports n so the UI can refuse to call a median of 3 a median", () => {
    expect(medianIgnoringNulls([80, null, null, 90, 100]).n).toBe(3)
    expect(medianIgnoringNulls([null, null]).value).toBeNull()
  })
})

describe("rankWithin", () => {
  const passRates = [91, 87, 78, 62, null]

  it("ranks 1 as best when higher is better", () => {
    expect(rankWithin(91, passRates)).toEqual({ rank: 1, n: 4 })
    expect(rankWithin(78, passRates)).toEqual({ rank: 3, n: 4 })
  })

  it("still ranks 1 as best when lower is better", () => {
    const costPerStudent = [8200, 9100, 10400]
    expect(rankWithin(8200, costPerStudent, false)).toEqual({ rank: 1, n: 3 })
    expect(rankWithin(10400, costPerStudent, false)).toEqual({ rank: 3, n: 3 })
  })

  it("gives tied values the same rank", () => {
    expect(rankWithin(87, [91, 87, 87, 62])).toEqual({ rank: 2, n: 4 })
  })

  it("excludes unmeasured peers from the population count", () => {
    expect(rankWithin(87, passRates)!.n).toBe(4)
  })

  it("returns null when the subject itself was never measured", () => {
    expect(rankWithin(null, passRates)).toBeNull()
    expect(rankWithin(87, [null, null])).toBeNull()
  })
})
