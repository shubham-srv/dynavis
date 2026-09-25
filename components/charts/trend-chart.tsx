"use client"

import { useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"

import { ChartReadout } from "@/components/charts/readout"
import type { ValueFormat } from "@/lib/data/envelope"
import { lttb } from "@/lib/viz/downsample"
import { formatValue } from "@/lib/viz/format"
import { seriesVar } from "@/lib/viz/palette"
import { isAtMost, type Variant } from "@/lib/viz/variants"

/**
 * A trend over time.
 *
 * The only file in the widget path allowed to import a charting library — everything
 * upstream speaks the chart-neutral envelope, which is what keeps the Recharts decision
 * reversible (PLAN D7).
 *
 * Ink is budgeted by variant rather than shrunk: gridlines, axis titles and tick density
 * all drop away as the box narrows, and labels are never rotated (PLAN §7).
 */

export interface TrendPoint {
  x: string
  y: number | null
}

export interface TrendChartProps {
  points: readonly TrendPoint[]
  variant: Variant
  format: ValueFormat
  precision: number
  currency?: string
  /** Drawn as a dashed reference line when present. */
  target?: number
  height?: number
  /** Accessible name; the data table beside it carries the detail. */
  label: string
  /** Cap for large series — the server does this in production (PLAN §16). */
  maxPoints?: number
}

export function TrendChart({
  points,
  variant,
  format,
  precision,
  currency,
  target,
  height = 160,
  label,
  maxPoints = 180,
}: TrendChartProps) {
  const [active, setActive] = useState<TrendPoint | null>(null)

  const indexed = points.map((point, index) => ({ ...point, index }))
  const reduced =
    indexed.length > maxPoints
      ? lttb(
          indexed.map((point) => ({ ...point, x: point.index })),
          maxPoints
        ).map((point) => indexed[point.x])
      : indexed

  const data = reduced.map((point) => ({ ...point, y: point.y ?? null }))
  const dense = !isAtMost(variant, "compact")
  const fmt = (value: number | null) =>
    formatValue(value, { format, precision, currency, compact: !dense })

  if (data.every((point) => point.y === null)) return null

  return (
    <div className="flex flex-col gap-1">
      <div role="img" aria-label={label} style={{ height }} className="w-full">
        {/*
          aria-hidden on the plot: a screen reader reading several hundred <path>
          elements is worse than silence. The widget's summary and table carry the
          information instead (PLAN §5.3).
        */}
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              // Recharts 3 gives the active index rather than the payload, so the
              // readout is driven from our own data — which is what we want anyway:
              // the strip shows the value we formatted, not the library's.
              onMouseMove={(state) => {
                const index = state?.activeTooltipIndex
                setActive(
                  typeof index === "number" ? (data[index] ?? null) : null
                )
              }}
              onMouseLeave={() => setActive(null)}
            >
              {dense ? (
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="2 4"
                  vertical={false}
                />
              ) : null}

              <XAxis
                dataKey="x"
                tickLine={false}
                axisLine={false}
                // Never rotate: rotated labels are what made the original dashboard
                // unreadable. Thin instead.
                interval="preserveStartEnd"
                minTickGap={dense ? 24 : 9999}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              {dense ? (
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(value: number) => fmt(value)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
              ) : null}

              {target !== undefined ? (
                <ReferenceLine
                  y={target}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                />
              ) : null}

              <Line
                type="monotone"
                dataKey="y"
                stroke={seriesVar(0)}
                strokeWidth={2}
                // A gap is information; do not bridge it.
                connectNulls={false}
                dot={data.length <= 12 ? { r: 3 } : false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {dense ? (
        <ChartReadout
          label={active?.x ?? null}
          value={active ? fmt(active.y) : null}
        />
      ) : null}
    </div>
  )
}
