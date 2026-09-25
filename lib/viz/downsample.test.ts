import { describe, expect, it } from "vitest"

import { lttb, type Point } from "@/lib/viz/downsample"

const series = (n: number, f: (i: number) => number | null): Point[] =>
  Array.from({ length: n }, (_, i) => ({ x: i, y: f(i) }))

describe("lttb", () => {
  it("leaves a series alone when it already fits", () => {
    const points = series(10, (i) => i)
    expect(lttb(points, 10)).toEqual(points)
    expect(lttb(points, 50)).toEqual(points)
  })

  it("refuses to reduce below three points", () => {
    const points = series(100, (i) => i)
    expect(lttb(points, 2)).toHaveLength(100)
  })

  it("reduces to roughly the requested budget", () => {
    const out = lttb(
      series(1000, (i) => Math.sin(i / 20) * 100),
      50
    )
    expect(out.length).toBeLessThanOrEqual(50)
    expect(out.length).toBeGreaterThan(40)
  })

  it("always keeps the first and last points", () => {
    const points = series(500, (i) => i * 2)
    const out = lttb(points, 20)
    expect(out[0]).toEqual(points[0])
    expect(out.at(-1)).toEqual(points.at(-1))
  })

  it("preserves a spike that naive every-nth sampling would drop", () => {
    // The whole reason for LTTB: hiding the one month revenue collapsed is worse
    // than not drawing the chart.
    const points = series(400, (i) => (i === 137 ? 10_000 : 10))
    const out = lttb(points, 30)
    expect(out.some((point) => point.y === 10_000)).toBe(true)

    const naive = points.filter((_, i) => i % Math.ceil(400 / 30) === 0)
    expect(naive.some((point) => point.y === 10_000)).toBe(false)
  })

  it("keeps x ordering", () => {
    const out = lttb(
      series(300, (i) => Math.cos(i / 10)),
      40
    )
    const xs = out.map((point) => point.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })

  it("never interpolates across a gap", () => {
    // A gap is information. Smoothing over it invents readings (PLAN §12.3).
    const points = series(200, (i) => (i >= 80 && i < 120 ? null : i))
    const out = lttb(points, 40)
    const gaps = out.filter((point) => point.y === null)
    expect(gaps.length).toBe(40)
    expect(out[0].y).not.toBeNull()
    expect(out.at(-1)!.y).not.toBeNull()
  })

  it("is deterministic", () => {
    const points = series(600, (i) => Math.sin(i / 7) * i)
    expect(lttb(points, 60)).toEqual(lttb(points, 60))
  })
})
