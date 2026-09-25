"use client"

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"

import type { ValueFormat } from "@/lib/data/envelope"
import { formatValue } from "@/lib/viz/format"
import { matrixTintVar, matrixTint, seriesVar } from "@/lib/viz/palette"
import { foldToOther } from "@/lib/viz/series"
import { isAtMost, type Variant } from "@/lib/viz/variants"

/**
 * Ranked comparison across the children of a scope.
 *
 * **Horizontal below `expanded`.** Category names read as left-aligned text with no
 * rotation and no truncation, and the natural overflow direction becomes vertical
 * scroll, which phones already do (PLAN §7). Vertical bars are the exception here, not
 * the default.
 */

export interface RankingDatum {
  id: string
  label: string
  value: number | null
  /** Direction-aware score in [-1, 1]; tints the bar when material. */
  vsBaseline?: number | null
}

export function RankingBar({
  data,
  variant,
  format,
  precision,
  currency,
  label,
  limit,
  height,
}: {
  data: readonly RankingDatum[]
  variant: Variant
  format: ValueFormat
  precision: number
  currency?: string
  label: string
  limit?: number
  height?: number
}) {
  const measured = data.filter(
    (row): row is RankingDatum & { value: number } => row.value !== null
  )
  if (measured.length === 0) return null

  const horizontal = isAtMost(variant, "standard")
  const cap =
    limit ?? (variant === "micro" ? 3 : variant === "compact" ? 5 : 12)

  const rows = foldToOther(measured, cap)

  const fmt = (value: number | null) =>
    formatValue(value, { format, precision, currency, compact: true })

  const barSize = 18
  const computed = height ?? Math.max(rows.length * (barSize + 10) + 16, 80)

  return (
    <div
      role="img"
      aria-label={label}
      style={{ height: computed }}
      className="w-full"
    >
      <div aria-hidden className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 4, right: 44, bottom: 0, left: 0 }}
          >
            {horizontal ? (
              <>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(value: number) => fmt(value)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
              </>
            )}

            <Bar
              dataKey="value"
              barSize={barSize}
              // 4px rounded data-ends, anchored to the baseline (PLAN §11.4).
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell
                  key={row.id}
                  fill={
                    matrixTintVar(matrixTint(row.vsBaseline ?? null)) ??
                    seriesVar(0)
                  }
                />
              ))}
              {/* Direct labels: with values on the marks the legend is unnecessary. */}
              <LabelList
                dataKey="value"
                position={horizontal ? "right" : "top"}
                formatter={(value) =>
                  fmt(typeof value === "number" ? value : null)
                }
                style={{ fontSize: 11, fill: "var(--foreground)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
