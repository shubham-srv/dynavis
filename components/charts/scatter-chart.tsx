"use client"

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatter,
  XAxis,
  YAxis,
} from "recharts"

import type { ValueFormat } from "@/lib/data/envelope"
import { formatValue } from "@/lib/viz/format"
import { assertSeriesBudget, seriesVar } from "@/lib/viz/palette"

/**
 * Two measures against each other.
 *
 * Hard-capped at three series, and that is a measurement rather than a preference:
 * scatter has no legend adjacency, so every pair of series must separate. Four slots
 * fail the normal-vision floor in both modes (light ΔE 13.7, dark 10.6) — see
 * PLAN §11.2. The assertion is here so the cap cannot quietly drift.
 */

export interface ScatterSeries {
  id: string
  label: string
  points: readonly { x: number; y: number | null }[]
}

export function ScatterPlot({
  series,
  xLabel,
  yLabel,
  xFormat = "number",
  yFormat = "number",
  precision = 0,
  label,
  height = 240,
}: {
  series: readonly ScatterSeries[]
  xLabel: string
  yLabel: string
  xFormat?: ValueFormat
  yFormat?: ValueFormat
  precision?: number
  label: string
  height?: number
}) {
  // Throws with the remedy ("facet into small multiples"), not just the rule.
  assertSeriesBudget(series.length, "all")

  const data = series.map((one) => ({
    ...one,
    points: one.points.filter(
      (point): point is { x: number; y: number } => point.y !== null
    ),
  }))
  if (data.every((one) => one.points.length === 0)) return null

  return (
    <div role="img" aria-label={label} style={{ height }} className="w-full">
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsScatter margin={{ top: 8, right: 8, bottom: 16, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                formatValue(v, { format: xFormat, precision, compact: true })
              }
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              width={44}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                formatValue(v, { format: yFormat, precision, compact: true })
              }
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            {data.map((one, index) => (
              <Scatter
                key={one.id}
                name={one.label}
                data={[...one.points]}
                fill={seriesVar(index)}
                isAnimationActive={false}
                // >= 8px markers, with a surface ring so overlapping points stay
                // countable (PLAN §11.4).
                shape="circle"
              />
            ))}
          </RechartsScatter>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
