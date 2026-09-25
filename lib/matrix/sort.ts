import type { MatrixEnvelope } from "./build"

/**
 * Matrix ordering.
 *
 * The rule that matters: **a missing value is never the worst value**. Sorting nulls to
 * the bottom regardless of direction stops a sparse school from looking like a failing
 * one, which is the most likely way this component would quietly mislead someone
 * (PLAN §12.3).
 */

export type SortDirection = "asc" | "desc"

export interface SortState {
  /** KPI id, or `null` to order by row label. */
  kpiId: string | null
  direction: SortDirection
}

export const DEFAULT_SORT: SortState = { kpiId: null, direction: "asc" }

/** Row indices in display order. Indices, not rows, so cells stay aligned. */
export function sortedRowOrder(
  matrix: MatrixEnvelope,
  sort: SortState
): number[] {
  const indices = matrix.rows.map((_, index) => index)
  if (!sort.kpiId) {
    return indices.sort((a, b) =>
      matrix.rows[a].label.localeCompare(matrix.rows[b].label, "en", {
        sensitivity: "base",
      })
    )
  }

  const column = matrix.columns.findIndex(
    (candidate) => candidate.kpiId === sort.kpiId
  )
  if (column === -1) return indices

  const sign = sort.direction === "asc" ? 1 : -1

  return indices.sort((a, b) => {
    const left = matrix.cells[a][column].value
    const right = matrix.cells[b][column].value

    // Nulls hold a stable position at the bottom in BOTH directions. Letting them sort
    // as -Infinity would rank "we didn't measure this" alongside "this is failing".
    if (left === null && right === null) {
      return matrix.rows[a].label.localeCompare(matrix.rows[b].label)
    }
    if (left === null) return 1
    if (right === null) return -1

    if (left === right) {
      return matrix.rows[a].label.localeCompare(matrix.rows[b].label)
    }
    return (left - right) * sign
  })
}

/** Clicking a sorted column flips it; clicking a new one starts descending. */
export function nextSortState(current: SortState, kpiId: string): SortState {
  if (current.kpiId !== kpiId) return { kpiId, direction: "desc" }
  if (current.direction === "desc") return { kpiId, direction: "asc" }
  return DEFAULT_SORT
}

/** `aria-sort` for a column header (WCAG 4.1.2). */
export function ariaSortFor(
  sort: SortState,
  kpiId: string
): "ascending" | "descending" | "none" {
  if (sort.kpiId !== kpiId) return "none"
  return sort.direction === "asc" ? "ascending" : "descending"
}

/** Serialise sort into the query string, so a sorted view is shareable (PLAN §8.2). */
export function sortToParam(sort: SortState): string | null {
  return sort.kpiId ? `${sort.kpiId}:${sort.direction}` : null
}

export function sortFromParam(raw: string | null | undefined): SortState {
  if (!raw) return DEFAULT_SORT
  const [kpiId, direction] = raw.split(":")
  if (!kpiId) return DEFAULT_SORT
  return { kpiId, direction: direction === "asc" ? "asc" : "desc" }
}

/**
 * Top and bottom N by a column — the `micro` variant of the matrix (PLAN §8.7).
 *
 * Returns display indices, already ordered best-first then worst-first.
 */
export function topAndBottom(
  matrix: MatrixEnvelope,
  kpiId: string,
  count = 5
): { top: number[]; bottom: number[] } {
  const order = sortedRowOrder(matrix, { kpiId, direction: "desc" })
  const measured = order.filter((index) => {
    const column = matrix.columns.findIndex((c) => c.kpiId === kpiId)
    return column !== -1 && matrix.cells[index][column].value !== null
  })

  const column = matrix.columns.findIndex((c) => c.kpiId === kpiId)
  const lowerIsBetter =
    column !== -1 && matrix.columns[column].direction === "lower-is-better"
  const best = lowerIsBetter ? [...measured].reverse() : measured
  const worst = lowerIsBetter ? measured : [...measured].reverse()

  return {
    top: best.slice(0, count),
    bottom: worst.slice(0, count),
  }
}
