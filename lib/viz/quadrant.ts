import type { Direction } from "@/lib/data/envelope"

/**
 * The statistics behind the quadrant chart, separated from anything that draws.
 *
 * All of it is here rather than in the component for one reason: the `micro` variant does
 * not render a chart at all — it renders a *sentence* built from these numbers. If the
 * correlation lived inside the scatter component, the narrow form could not state the
 * finding, and the whole substitution ladder would collapse back into "a smaller chart"
 * (PLAN §7, D1).
 */

export interface PairedPoint {
  id: string
  label: string
  x: number
  y: number
  /** Third measure, drawn as radius only where it can be read (`expanded`). */
  weight?: number
}

/** x first, y second. "low-high" is low on x, high on y. */
export type QuadrantKey = "low-low" | "high-low" | "low-high" | "high-high"

export const QUADRANT_KEYS: readonly QuadrantKey[] = [
  "low-low",
  "high-low",
  "low-high",
  "high-high",
]

/**
 * Pearson's r.
 *
 * `null` rather than a number in three cases, and each is a real situation in this data
 * rather than defensive padding:
 *
 *   - fewer than three points — two points always correlate perfectly, which is not a
 *     finding, and a region with two schools would otherwise report r = 1.0
 *   - zero variance on either axis — every school identical on one measure makes r
 *     undefined, not zero
 *   - a non-finite intermediate, which a large squared currency figure can produce
 *
 * Reporting "no correlation" (r = 0) for any of these would be a claim we cannot support.
 */
export function pearson(points: readonly PairedPoint[]): number | null {
  if (points.length < 3) return null

  const n = points.length
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n

  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const point of points) {
    const dx = point.x - meanX
    const dy = point.y - meanY
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }

  if (sxx === 0 || syy === 0) return null
  const r = sxy / Math.sqrt(sxx * syy)
  if (!Number.isFinite(r)) return null
  // Floating-point error can push a perfect correlation just past 1.
  return Math.max(-1, Math.min(1, r))
}

/**
 * How to describe a correlation in words.
 *
 * Bands, not a raw coefficient, because "r = 0.21" invites a reader to treat noise as a
 * finding. Under 0.3 is called out as *no* relationship rather than a weak one — across
 * fourteen schools r = 0.25 is indistinguishable from chance, and the sentence the
 * `micro` variant renders must not imply otherwise.
 */
export function describeStrength(
  r: number | null
): "none" | "weak" | "moderate" | "strong" {
  if (r === null) return "none"
  const magnitude = Math.abs(r)
  if (magnitude < 0.3) return "none"
  if (magnitude < 0.5) return "weak"
  if (magnitude < 0.7) return "moderate"
  return "strong"
}

/** The median of a set of values. Splits the quadrants. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

export interface QuadrantSplit {
  x: number
  y: number
}

/**
 * Median split rather than mean.
 *
 * One international school with four times the fee income drags a mean far enough that
 * two thirds of schools land on one side of it, and four quadrants holding 9/2/2/1 tell
 * a reader nothing. The median keeps the groups comparable, which is the entire point of
 * showing counts at `compact`.
 */
export function quadrantSplit(
  points: readonly PairedPoint[]
): QuadrantSplit | null {
  const x = median(points.map((point) => point.x))
  const y = median(points.map((point) => point.y))
  if (x === null || y === null) return null
  return { x, y }
}

/**
 * Which quadrant a point falls in.
 *
 * A point sitting exactly on a median counts as "high". Arbitrary, and documented so it
 * is not re-litigated later: some rule is needed, and the counts must sum to the
 * population — a fifth "on the line" bucket would be true and useless.
 */
export function quadrantOf(
  point: PairedPoint,
  split: QuadrantSplit
): QuadrantKey {
  const x = point.x >= split.x ? "high" : "low"
  const y = point.y >= split.y ? "high" : "low"
  return `${x}-${y}` as QuadrantKey
}

export function groupByQuadrant(
  points: readonly PairedPoint[],
  split: QuadrantSplit
): Record<QuadrantKey, PairedPoint[]> {
  const groups: Record<QuadrantKey, PairedPoint[]> = {
    "low-low": [],
    "high-low": [],
    "low-high": [],
    "high-high": [],
  }
  for (const point of points) groups[quadrantOf(point, split)].push(point)
  return groups
}

/**
 * Is being on the high side of this axis good?
 *
 * `band` KPIs — student:teacher ratio, class fill rate — have no good side, since too high
 * and too low are both wrong. They return null and the quadrant is then described without
 * a verdict. Treating a band KPI as higher-is-better is the direction bug this codebase
 * already guards against elsewhere (PLAN §8.5), and it would be worse here: a quadrant
 * labelled "strong" that is actually overcrowded.
 */
export function highIsGood(direction: Direction): boolean | null {
  if (direction === "higher-is-better") return true
  if (direction === "lower-is-better") return false
  return null
}

export type Favourability = "good" | "mixed" | "poor" | "unknown"

/**
 * How a quadrant reads once each axis's direction is applied.
 *
 * This is why the chart cannot simply be drawn: "high cost, high attainment" is one good
 * axis and one bad one, and only the KPI definitions know which is which. Without this
 * the corner labels would carry geometry rather than meaning.
 */
export function favourabilityOf(
  key: QuadrantKey,
  xDirection: Direction,
  yDirection: Direction
): Favourability {
  const xGood = highIsGood(xDirection)
  const yGood = highIsGood(yDirection)
  if (xGood === null || yGood === null) return "unknown"

  const [xSide, ySide] = key.split("-") as ["low" | "high", "low" | "high"]
  const xIsGood = (xSide === "high") === xGood
  const yIsGood = (ySide === "high") === yGood

  if (xIsGood && yIsGood) return "good"
  if (!xIsGood && !yIsGood) return "poor"
  return "mixed"
}

/**
 * The points that least fit the trend — the ones named in the `micro` sentence.
 *
 * Standardised residuals from the least-squares line, so "breaks the pattern" means "far
 * from where the relationship predicts" rather than merely "extreme". A school with the
 * highest cost *and* the highest attainment is not an exception to a positive
 * relationship; one with the highest cost and the lowest attainment is, and that is the
 * school worth a manager's attention.
 *
 * Returns nothing when there is no trend to deviate from, which is the honest answer:
 * with no relationship, every point is equally unexplained and naming two would invent a
 * finding.
 */
export function outliers(
  points: readonly PairedPoint[],
  count = 2
): PairedPoint[] {
  if (points.length < 4) return []
  const r = pearson(points)
  if (r === null || describeStrength(r) === "none") return []

  const n = points.length
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n

  let sxy = 0
  let sxx = 0
  for (const point of points) {
    sxy += (point.x - meanX) * (point.y - meanY)
    sxx += (point.x - meanX) ** 2
  }
  if (sxx === 0) return []

  const slope = sxy / sxx
  const intercept = meanY - slope * meanX

  const residuals = points.map((point) => ({
    point,
    residual: Math.abs(point.y - (slope * point.x + intercept)),
  }))
  const spread = Math.sqrt(
    residuals.reduce((sum, one) => sum + one.residual ** 2, 0) / n
  )
  if (spread === 0) return []

  // 1.5 standard deviations of residual. Low enough to find the two or three schools a
  // manager should ask about, high enough that an ordinary spread names nobody.
  return residuals
    .filter((one) => one.residual / spread >= 1.5)
    .sort((a, b) => b.residual - a.residual)
    .slice(0, count)
    .map((one) => one.point)
}
