/**
 * Largest-Triangle-Three-Buckets downsampling.
 *
 * Fewer points is both a performance win and a design win: it removes overplotting as
 * well as work. LTTB is used rather than naive every-nth sampling because naive sampling
 * drops spikes, and a dashboard that hides the one month revenue collapsed is worse than
 * no dashboard (PLAN §15).
 *
 * The server owns this in production, driven by a `maxPoints` hint from the client
 * (PLAN §16). It lives here so the client can do it to fixture data and so the algorithm
 * is unit-tested somewhere.
 */

export interface Point {
  x: number
  y: number | null
}

/**
 * Reduce `points` to at most `threshold`, preserving visual shape.
 *
 * Unmeasured points are preserved as bucket boundaries rather than interpolated over —
 * a gap in the data is information, and smoothing across it invents readings
 * (PLAN §12.3).
 */
export function lttb<T extends Point>(
  points: readonly T[],
  threshold: number
): T[] {
  if (threshold >= points.length || threshold < 3) return [...points]

  // Nulls break the triangle-area maths and must not be silently dropped, so they are
  // carried through and the measured runs are sampled between them.
  if (points.some((point) => point.y === null)) {
    return sampleAroundGaps(points, threshold)
  }

  const bucketSize = (points.length - 2) / (threshold - 2)
  const sampled: T[] = [points[0]]
  let previous = 0

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1
    const rangeEnd = Math.min(
      Math.floor((i + 2) * bucketSize) + 1,
      points.length
    )

    // Average of the *next* bucket forms the third triangle vertex.
    const nextStart = rangeEnd
    const nextEnd = Math.min(
      Math.floor((i + 3) * bucketSize) + 1,
      points.length
    )
    let avgX = 0
    let avgY = 0
    let count = 0
    for (let j = nextStart; j < nextEnd; j++) {
      avgX += points[j].x
      avgY += points[j].y as number
      count++
    }
    if (count === 0) {
      avgX = points[points.length - 1].x
      avgY = points[points.length - 1].y as number
      count = 1
    }
    avgX /= count
    avgY /= count

    const anchor = points[previous]
    let best = rangeStart
    let bestArea = -1
    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (anchor.x - avgX) * ((points[j].y as number) - (anchor.y as number)) -
          (anchor.x - points[j].x) * (avgY - (anchor.y as number))
      )
      if (area > bestArea) {
        bestArea = area
        best = j
      }
    }

    sampled.push(points[best])
    previous = best
  }

  sampled.push(points[points.length - 1])
  return sampled
}

/** Keep every gap, and sample the measured runs between them proportionally. */
function sampleAroundGaps<T extends Point>(
  points: readonly T[],
  threshold: number
): T[] {
  const runs: { start: number; end: number }[] = []
  let start: number | null = null

  points.forEach((point, index) => {
    if (point.y === null) {
      if (start !== null) runs.push({ start, end: index })
      start = null
    } else if (start === null) {
      start = index
    }
  })
  if (start !== null) runs.push({ start, end: points.length })

  const gaps = points.filter((point) => point.y === null).length
  const budget = Math.max(threshold - gaps, runs.length * 2)
  const measured = runs.reduce((sum, run) => sum + (run.end - run.start), 0)

  const kept = new Set<number>()
  points.forEach((point, index) => {
    if (point.y === null) kept.add(index)
  })

  for (const run of runs) {
    const length = run.end - run.start
    const share = Math.max(2, Math.round((length / measured) * budget))
    const slice = points.slice(run.start, run.end)
    for (const point of lttb(slice, share)) {
      kept.add(run.start + slice.indexOf(point))
    }
  }

  return [...kept].sort((a, b) => a - b).map((index) => points[index])
}
