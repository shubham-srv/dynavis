import { describe, expect, it } from "vitest"

import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { buildMatrix } from "@/lib/matrix/build"
import {
  ariaSortFor,
  DEFAULT_SORT,
  nextSortState,
  sortedRowOrder,
  sortFromParam,
  sortToParam,
  topAndBottom,
} from "@/lib/matrix/sort"

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const
const KPIS = ["seatUtilisation", "attainmentRate", "costPerStudent"] as const

const atRegion = () =>
  buildMatrix({ scopeId: "emea", kpiIds: [...KPIS], period })

describe("buildMatrix — rows are the children of the scope", () => {
  it("lists regions at the group and countries at a region", () => {
    // The decision that bounds row count at every level (PLAN D15).
    const group = buildMatrix({ scopeId: "group", kpiIds: [...KPIS], period })
    expect(group.rows.map((row) => row.id)).toEqual(["emea", "apac", "amer"])
    expect(group.rowLevel).toBe("region")

    const region = atRegion()
    expect(region.rows.map((row) => row.id)).toEqual(["uae", "uk", "eg"])
    expect(region.rowLevel).toBe("country")
  })

  it("handles the country with no cluster tier", () => {
    const egypt = buildMatrix({ scopeId: "eg", kpiIds: [...KPIS], period })
    expect(egypt.rowLevel).toBe("school")
    expect(egypt.rows.length).toBeGreaterThan(0)
  })

  it("reports a leaf as having no rows to render", () => {
    const school = buildMatrix({
      scopeId: "sch-dxb-01",
      kpiIds: [...KPIS],
      period,
    })
    expect(school.rows).toEqual([])
    expect(school.rowLevel).toBeNull()
  })

  it("marks which rows can be drilled into", () => {
    const region = atRegion()
    expect(region.rows.every((row) => row.canDrill)).toBe(true)
    const dubai = buildMatrix({ scopeId: "dubai", kpiIds: [...KPIS], period })
    expect(dubai.rows.every((row) => row.canDrill)).toBe(false)
  })

  it("throws on an unknown scope", () => {
    expect(() =>
      buildMatrix({ scopeId: "nowhere", kpiIds: [...KPIS], period })
    ).toThrow(RangeError)
  })

  it("keeps cells aligned to rows and columns", () => {
    const region = atRegion()
    expect(region.cells).toHaveLength(region.rows.length)
    for (const row of region.cells) expect(row).toHaveLength(KPIS.length)
  })
})

describe("buildMatrix — baselines per column", () => {
  it("labels each column with the baseline it actually resolved to", () => {
    const region = atRegion()
    const seats = region.columns.find((c) => c.kpiId === "seatUtilisation")!
    const cost = region.columns.find((c) => c.kpiId === "costPerStudent")!

    // Seat utilisation has an agreed target; cost per student does not, so the same
    // matrix legitimately mixes baselines and must say so per column (PLAN §8.4).
    expect(seats.baselineKind).toBe("target")
    expect(seats.baselineLabel).toBe("vs. target")
    expect(cost.baselineKind).not.toBe("target")
    expect(cost.baselineLabel).not.toBe("vs. target")
  })

  it("switches every column when the baseline mode changes", () => {
    const priorMode = buildMatrix({
      scopeId: "emea",
      kpiIds: [...KPIS],
      period,
      baselineMode: "prior-period",
    })
    expect(
      priorMode.columns.every(
        (column) => column.baselineKind === "prior-period"
      )
    ).toBe(true)
  })

  it("uses the column itself as the peer set", () => {
    const peerMode = buildMatrix({
      scopeId: "emea",
      kpiIds: ["costPerStudent"],
      period,
      baselineMode: "peer-median",
    })
    const baseline = peerMode.cells[0][0].baseline
    expect(baseline.kind).toBe("peer-median")
    if (baseline.kind === "peer-median") expect(baseline.n).toBe(3)
  })
})

describe("buildMatrix — direction and missing data", () => {
  it("scores a rising cost as bad, not good", () => {
    // The single most likely bug in this component (PLAN §8.5).
    const matrix = buildMatrix({
      scopeId: "emea",
      kpiIds: ["costPerStudent"],
      period,
      baselineMode: "peer-median",
    })
    const column = 0
    const values = matrix.cells.map((row) => row[column])
    const median = (
      values.find((cell) => cell.baseline.kind === "peer-median")!.baseline as {
        value: number
      }
    ).value

    for (const cell of values) {
      if (cell.value === null || cell.vsBaseline === null) continue
      if (cell.value > median) expect(cell.vsBaseline).toBeLessThanOrEqual(0)
      if (cell.value < median) expect(cell.vsBaseline).toBeGreaterThanOrEqual(0)
    }
  })

  it("leaves a band KPI with no agreed band unjudged", () => {
    const matrix = buildMatrix({
      scopeId: "emea",
      kpiIds: ["classFillRate"],
      period,
    })
    expect(matrix.cells.every((row) => row[0].vsBaseline === null)).toBe(true)
    // ...but the value itself is still shown.
    expect(matrix.cells.some((row) => row[0].value !== null)).toBe(true)
  })

  it("says why a cell is empty rather than leaving a bare dash", () => {
    const egypt = buildMatrix({
      scopeId: "eg",
      kpiIds: ["progressScore"],
      period,
    })
    expect(egypt.cells[0][0].value).toBeNull()
    expect(egypt.cells[0][0].note).toMatch(/not reported/i)

    const dubai = buildMatrix({
      scopeId: "dubai",
      kpiIds: ["universityPlacement"],
      period,
    })
    const primaryOnly = dubai.rows.findIndex((row) => row.id === "sch-dxb-04")
    expect(dubai.cells[primaryOnly][0].note).toMatch(/senior year/i)
  })

  it("flags a school that opened this year instead of scoring it badly", () => {
    const dubai = buildMatrix({
      scopeId: "dubai",
      kpiIds: ["attainmentRate"],
      period,
      baselineMode: "prior-period",
    })
    const index = dubai.rows.findIndex((row) => row.id === "sch-dxb-06")
    expect(dubai.rows[index].isNew).toBe(true)
    // No prior reading means no judgement — not a bad one.
    expect(dubai.cells[index][0].vsBaseline).toBeNull()
    expect(dubai.cells[index][0].delta).toBeNull()
  })
})

describe("sorting", () => {
  it("orders by row label when no column is chosen", () => {
    const matrix = atRegion()
    const order = sortedRowOrder(matrix, DEFAULT_SORT)
    const labels = order.map((index) => matrix.rows[index].label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
  })

  it("sorts by a column in both directions", () => {
    const matrix = atRegion()
    const descending = sortedRowOrder(matrix, {
      kpiId: "seatUtilisation",
      direction: "desc",
    })
    const ascending = sortedRowOrder(matrix, {
      kpiId: "seatUtilisation",
      direction: "asc",
    })
    expect(descending).toEqual([...ascending].reverse())
  })

  it("keeps missing values at the bottom in BOTH directions", () => {
    // A sparse school is not a failing school (PLAN §12.3).
    const matrix = buildMatrix({
      scopeId: "eg",
      kpiIds: ["progressScore", "attainmentRate"],
      period,
    })
    for (const direction of ["asc", "desc"] as const) {
      const order = sortedRowOrder(matrix, {
        kpiId: "progressScore",
        direction,
      })
      const values = order.map((index) => matrix.cells[index][0].value)
      const firstNull = values.indexOf(null)
      if (firstNull === -1) continue
      expect(values.slice(firstNull).every((value) => value === null)).toBe(
        true
      )
    }
  })

  it("is stable for ties, falling back to the label", () => {
    const matrix = atRegion()
    const first = sortedRowOrder(matrix, {
      kpiId: "attainmentRate",
      direction: "desc",
    })
    const second = sortedRowOrder(matrix, {
      kpiId: "attainmentRate",
      direction: "desc",
    })
    expect(first).toEqual(second)
  })

  it("ignores a column that is not in the matrix", () => {
    const matrix = atRegion()
    expect(sortedRowOrder(matrix, { kpiId: "nope", direction: "asc" })).toEqual(
      matrix.rows.map((_, index) => index)
    )
  })
})

describe("sort state", () => {
  it("cycles desc → asc → none on repeated clicks", () => {
    let state = DEFAULT_SORT
    state = nextSortState(state, "seatUtilisation")
    expect(state).toEqual({ kpiId: "seatUtilisation", direction: "desc" })
    state = nextSortState(state, "seatUtilisation")
    expect(state).toEqual({ kpiId: "seatUtilisation", direction: "asc" })
    state = nextSortState(state, "seatUtilisation")
    expect(state).toEqual(DEFAULT_SORT)
  })

  it("starts a newly clicked column descending", () => {
    const state = nextSortState(
      { kpiId: "attainmentRate", direction: "asc" },
      "seatUtilisation"
    )
    expect(state).toEqual({ kpiId: "seatUtilisation", direction: "desc" })
  })

  it("exposes aria-sort only on the active column", () => {
    const sort = { kpiId: "seatUtilisation", direction: "desc" } as const
    expect(ariaSortFor(sort, "seatUtilisation")).toBe("descending")
    expect(ariaSortFor(sort, "attainmentRate")).toBe("none")
    expect(ariaSortFor({ ...sort, direction: "asc" }, "seatUtilisation")).toBe(
      "ascending"
    )
  })

  it("round-trips through the query string, so a sorted view is shareable", () => {
    const sort = { kpiId: "seatUtilisation", direction: "asc" } as const
    expect(sortFromParam(sortToParam(sort))).toEqual(sort)
    expect(sortToParam(DEFAULT_SORT)).toBeNull()
    expect(sortFromParam(null)).toEqual(DEFAULT_SORT)
    expect(sortFromParam("garbage")).toEqual({
      kpiId: "garbage",
      direction: "desc",
    })
  })
})

describe("topAndBottom — the micro variant", () => {
  it("puts genuinely best first for a higher-is-better KPI", () => {
    const matrix = buildMatrix({
      scopeId: "dubai",
      kpiIds: ["attainmentRate"],
      period,
    })
    const { top, bottom } = topAndBottom(matrix, "attainmentRate", 2)
    expect(matrix.cells[top[0]][0].value!).toBeGreaterThan(
      matrix.cells[bottom[0]][0].value!
    )
  })

  it("flips for a lower-is-better KPI, so 'top' always means best", () => {
    const matrix = buildMatrix({
      scopeId: "dubai",
      kpiIds: ["costPerStudent"],
      period,
    })
    const { top, bottom } = topAndBottom(matrix, "costPerStudent", 2)
    expect(matrix.cells[top[0]][0].value!).toBeLessThan(
      matrix.cells[bottom[0]][0].value!
    )
  })

  it("excludes unmeasured rows from both ends", () => {
    const matrix = buildMatrix({
      scopeId: "dubai",
      kpiIds: ["universityPlacement"],
      period,
    })
    const { top, bottom } = topAndBottom(matrix, "universityPlacement", 10)
    for (const index of [...top, ...bottom]) {
      expect(matrix.cells[index][0].value).not.toBeNull()
    }
  })
})
