import { describe, expect, it } from "vitest"

import {
  describeStrength,
  favourabilityOf,
  groupByQuadrant,
  highIsGood,
  median,
  outliers,
  pearson,
  quadrantOf,
  quadrantSplit,
  type PairedPoint,
} from "./quadrant"

const point = (id: string, x: number, y: number): PairedPoint => ({
  id,
  label: id,
  x,
  y,
})

describe("pearson", () => {
  it("finds a perfect positive relationship", () => {
    const r = pearson([point("a", 1, 2), point("b", 2, 4), point("c", 3, 6)])
    expect(r).toBeCloseTo(1, 10)
  })

  it("finds a perfect negative relationship", () => {
    const r = pearson([point("a", 1, 6), point("b", 2, 4), point("c", 3, 2)])
    expect(r).toBeCloseTo(-1, 10)
  })

  it("refuses to report a correlation for two points", () => {
    // Two points always fit a line perfectly. Reporting r = 1 for a region with two
    // schools would be the most confident wrong answer the product could give.
    expect(pearson([point("a", 1, 1), point("b", 2, 2)])).toBeNull()
  })

  it("returns null when an axis has no variance, rather than zero", () => {
    // Every school identical on cost makes the correlation undefined, not absent. Zero
    // would read as "we checked and there is no relationship".
    expect(
      pearson([point("a", 5, 1), point("b", 5, 2), point("c", 5, 3)])
    ).toBeNull()
  })

  it("stays within [-1, 1] despite floating-point error", () => {
    const r = pearson([
      point("a", 0.1, 0.3),
      point("b", 0.2, 0.6),
      point("c", 0.3, 0.9),
    ])
    expect(r).not.toBeNull()
    expect(Math.abs(r!)).toBeLessThanOrEqual(1)
  })
})

describe("describeStrength", () => {
  it("calls a weak correlation no relationship at all", () => {
    // The honesty rule: at this sample size r = 0.25 is indistinguishable from chance,
    // and the micro variant renders this word as a sentence a manager may act on.
    expect(describeStrength(0.25)).toBe("none")
    expect(describeStrength(-0.29)).toBe("none")
  })

  it("bands the rest symmetrically in both directions", () => {
    expect(describeStrength(0.35)).toBe("weak")
    expect(describeStrength(-0.35)).toBe("weak")
    expect(describeStrength(0.6)).toBe("moderate")
    expect(describeStrength(0.85)).toBe("strong")
  })

  it("treats an unavailable correlation as no relationship", () => {
    expect(describeStrength(null)).toBe("none")
  })
})

describe("median", () => {
  it("averages the middle pair for an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it("takes the middle for an odd count, unsorted input included", () => {
    expect(median([9, 1, 5])).toBe(5)
  })

  it("has no answer for nothing", () => {
    expect(median([])).toBeNull()
  })
})

describe("quadrantSplit and quadrantOf", () => {
  const points = [
    point("a", 1, 1),
    point("b", 2, 2),
    point("c", 3, 3),
    point("d", 4, 4),
  ]

  it("splits on the median of each axis", () => {
    expect(quadrantSplit(points)).toEqual({ x: 2.5, y: 2.5 })
  })

  it("puts a point exactly on a median into the high side", () => {
    // Documented, so it is not re-litigated: the counts must sum to the population, and
    // an "on the line" bucket would be true and useless.
    const split = { x: 2, y: 2 }
    expect(quadrantOf(point("on", 2, 2), split)).toBe("high-high")
    expect(quadrantOf(point("under", 1.99, 1.99), split)).toBe("low-low")
  })

  it("assigns every point to exactly one quadrant", () => {
    const split = quadrantSplit(points)!
    const groups = groupByQuadrant(points, split)
    const total = Object.values(groups).reduce(
      (sum, group) => sum + group.length,
      0
    )
    expect(total).toBe(points.length)
  })

  it("resists a single extreme value, which a mean split would not", () => {
    // The reason for a median split. One school four times the size of the rest would
    // drag a mean past every other school, leaving 3/1/0/0 and no comparison to make.
    const skewed = [
      point("a", 1, 1),
      point("b", 2, 2),
      point("c", 3, 3),
      point("whale", 400, 400),
    ]
    const split = quadrantSplit(skewed)!
    const groups = groupByQuadrant(skewed, split)
    expect(groups["low-low"]).toHaveLength(2)
    expect(groups["high-high"]).toHaveLength(2)
  })
})

describe("direction handling", () => {
  it("knows which way each kind of KPI points", () => {
    expect(highIsGood("higher-is-better")).toBe(true)
    expect(highIsGood("lower-is-better")).toBe(false)
    // A band KPI has no good side — too high and too low are both wrong.
    expect(highIsGood("band")).toBeNull()
  })

  it("reads a quadrant through both axes, not through geometry", () => {
    // Cost (lower better) against attainment (higher better): the good corner is low
    // cost with high attainment, which is geometrically the *bottom-right* of nothing in
    // particular. Getting this from position alone is the classic direction bug.
    const favour = (key: Parameters<typeof favourabilityOf>[0]) =>
      favourabilityOf(key, "lower-is-better", "higher-is-better")

    expect(favour("low-high")).toBe("good")
    expect(favour("high-low")).toBe("poor")
    expect(favour("high-high")).toBe("mixed")
    expect(favour("low-low")).toBe("mixed")
  })

  it("passes no verdict when either axis is a band", () => {
    // Better to say nothing than to label an overcrowded classroom "best placed".
    expect(favourabilityOf("high-high", "band", "higher-is-better")).toBe(
      "unknown"
    )
    expect(favourabilityOf("low-low", "lower-is-better", "band")).toBe(
      "unknown"
    )
  })
})

describe("outliers", () => {
  it("names the point that defies the trend, not the most extreme one", () => {
    // Nine schools on a rising line plus one that spends the most and attains the least.
    // A naive "furthest from the centre" would return the top-right school, which fits
    // the pattern perfectly and is nobody's problem.
    const online = Array.from({ length: 9 }, (_, i) =>
      point(`s${i}`, i + 1, i + 1)
    )
    const defiant = point("defiant", 9, 1)
    const found = outliers([...online, defiant])
    expect(found.map((one) => one.id)).toContain("defiant")
    expect(found.map((one) => one.id)).not.toContain("s8")
  })

  it("names nobody when there is no linear trend to defy", () => {
    /*
      A symmetric V: r is exactly 0, though the points are obviously structured. That is
      the honest case for this function — there is a pattern, it is not a linear one, and
      "these two schools break the trend" would be a claim about a line that does not
      exist. Without a relationship every point is equally unexplained.
    */
    const vShaped = [
      point("a", 1, 5),
      point("b", 2, 3),
      point("c", 3, 1),
      point("d", 4, 1),
      point("e", 5, 3),
      point("f", 6, 5),
    ]
    expect(pearson(vShaped)).toBeCloseTo(0, 10)
    expect(outliers(vShaped)).toEqual([])
  })

  it("names nobody when every point is on the line", () => {
    const perfect = Array.from({ length: 6 }, (_, i) =>
      point(`s${i}`, i + 1, (i + 1) * 2)
    )
    expect(outliers(perfect)).toEqual([])
  })

  it("stays silent below four points", () => {
    expect(outliers([point("a", 1, 1), point("b", 2, 9)])).toEqual([])
  })

  it("returns at most the requested count", () => {
    const online = Array.from({ length: 8 }, (_, i) =>
      point(`s${i}`, i + 1, i + 1)
    )
    const found = outliers(
      [...online, point("x", 8, 1), point("y", 1, 8), point("z", 7, 2)],
      2
    )
    expect(found.length).toBeLessThanOrEqual(2)
  })
})
