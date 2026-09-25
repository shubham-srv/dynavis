import { describe, expect, it } from "vitest"

import { foldToOther, OTHER_ID, type SeriesRow } from "@/lib/viz/series"

const rows = (n: number): SeriesRow[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    label: `School ${i}`,
    value: 100 - i * 5,
  }))

describe("foldToOther", () => {
  it("orders rows strongest first", () => {
    const out = foldToOther(
      [
        { id: "a", label: "A", value: 5 },
        { id: "b", label: "B", value: 9 },
      ],
      10
    )
    expect(out.map((row) => row.id)).toEqual(["b", "a"])
  })

  it("leaves a series alone when it already fits", () => {
    expect(foldToOther(rows(4), 8)).toHaveLength(4)
  })

  it("folds the tail once more than one row would be hidden", () => {
    const out = foldToOther(rows(9), 3)
    expect(out).toHaveLength(4)
    expect(out.at(-1)).toMatchObject({ id: OTHER_ID, label: "Other (6)" })
  })

  it("never produces an Other of one — naming the thing is better", () => {
    const out = foldToOther(rows(4), 3)
    expect(out).toHaveLength(4)
    expect(out.some((row) => row.id === OTHER_ID)).toBe(false)
  })

  it("gives Other no baseline, because a mean of unlike things has none", () => {
    const out = foldToOther(rows(9), 3)
    expect(out.at(-1)!.vsBaseline).toBeNull()
  })

  it("averages the folded rows for magnitude context", () => {
    const out = foldToOther(
      [
        { id: "a", label: "A", value: 10 },
        { id: "b", label: "B", value: 6 },
        { id: "c", label: "C", value: 4 },
        { id: "d", label: "D", value: 2 },
      ],
      1
    )
    expect(out.at(-1)!.value).toBeCloseTo(4, 6)
  })

  it("drops unmeasured rows rather than folding them in as zero", () => {
    const out = foldToOther(
      [
        { id: "a", label: "A", value: 10 },
        { id: "b", label: "B", value: null },
      ],
      5
    )
    expect(out.map((row) => row.id)).toEqual(["a"])
  })

  it("handles a nonsensical cap without throwing", () => {
    expect(foldToOther(rows(3), 0)).toHaveLength(3)
    expect(foldToOther([], 5)).toEqual([])
  })
})
