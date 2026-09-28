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

import { useContainerSize } from "@/hooks/use-container-size"
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
 *
 * **And horizontal above it too, whenever the names will not fit.** Columns put every
 * label on one line under the axis, so "United Arab Emirates" and "United Kingdom" simply
 * overlapped each other. Rotating them is banned by §7 — it is the thing that made the
 * original dashboard unreadable — and truncating leaves two labels that both read
 * "United…". So the chart measures itself, and where the names do not fit it turns
 * horizontal regardless of variant. Substitution again, for the same reason as everywhere
 * else: the alternative is a chart that is drawn but cannot be read.
 */

/** Rough advance width per character at the axis font size, in CSS px. */
const CHAR_PX = 5.6
/** Breathing room between two adjacent category labels. */
const LABEL_GUTTER = 10
/**
 * How much width one column is worth.
 *
 * A column chart stretched over a width it does not need is mostly whitespace: three
 * countries across an 1100px card put three narrow bars at opposite ends of the page with
 * nothing between them, which reads as broken rather than as sparse. Columns take the room
 * they need and no more; twelve of them still fill the card.
 */
const COLUMN_PX = 150
const COLUMN_AXIS_PX = 60

/**
 * Should this chart lay its bars out as rows rather than columns?
 *
 * Exported and pure so the rule can be tested against real widths — the component
 * measures itself, and a test that cannot inject a width can only re-assert the
 * arithmetic back at itself.
 *
 * `width <= 0` means "not measured yet", and the variant alone decides.
 */
export function prefersRows(
  variant: Variant,
  labels: readonly string[],
  width: number
): boolean {
  if (isAtMost(variant, "standard")) return true
  if (width <= 0 || labels.length === 0) return false

  const capped = labels.length * COLUMN_PX + COLUMN_AXIS_PX
  const band = (Math.min(width, capped) - COLUMN_AXIS_PX) / labels.length
  const longest = labels.reduce(
    (most, label) => Math.max(most, label.length),
    0
  )
  return longest * CHAR_PX + LABEL_GUTTER > band
}

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
  const [sizeRef, box] = useContainerSize<HTMLDivElement>()

  const withValue = data.filter(
    (row): row is RankingDatum & { value: number } => row.value !== null
  )

  const cap =
    limit ?? (variant === "micro" ? 3 : variant === "compact" ? 5 : 12)
  const rows = foldToOther(withValue, cap)

  /*
    Would every category label fit under its own column?

    Until the first measurement `box.width` is 0, which reads as "assume they fit" and
    keeps the variant rule in charge — the same not-yet-measured convention the rest of the
    app uses. Both layouts are the same height, so correcting after measurement costs no
    layout shift.
  */
  const horizontal = prefersRows(
    variant,
    rows.map((row) => row.label),
    box.width
  )

  const fmt = (value: number | null) =>
    formatValue(value, { format, precision, currency, compact: true })

  const barSize = 18
  const computed = height ?? Math.max(rows.length * (barSize + 10) + 16, 80)

  // After the hooks, so the hook order cannot change between renders.
  if (withValue.length === 0) return null

  return (
    <div
      ref={sizeRef}
      role="img"
      aria-label={label}
      style={{ height: computed }}
      className="w-full"
    >
      {/*
        Left-aligned and no wider than the columns need. `maxWidth` rather than `width`, so
        a narrow card still shrinks it, and only in the vertical case — horizontal bars are
        rows and should always use the full width available for their value labels.
      */}
      <div
        className="h-full w-full"
        style={
          horizontal
            ? undefined
            : { maxWidth: rows.length * COLUMN_PX + COLUMN_AXIS_PX }
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={rows}
            layout={horizontal ? "vertical" : "horizontal"}
            /*
              Columns put their value label above the bar, and a 4px top margin clipped it
              off — the tallest bar's figure was cut in half. The gutter is on whichever
              side the labels actually sit.
            */
            margin={{
              top: horizontal ? 4 : 18,
              right: horizontal ? 48 : 8,
              bottom: 0,
              left: 0,
            }}
            // Keeps a two-category chart from stranding two thin bars at opposite ends of
            // a 1100px card: the bars grow into their bands, up to a sane cap.
            barCategoryGap="18%"
          >
            {horizontal ? (
              <>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={132}
                  tickLine={false}
                  axisLine={false}
                  // Truncated rather than wrapped or shrunk (PLAN §7). The full name is in
                  // the accessible table, which is the authority for this chart anyway.
                  tickFormatter={(value: string) =>
                    value.length > 22 ? `${value.slice(0, 21)}…` : value
                  }
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
              // Fixed height per row when horizontal, because rows stack and the chart's
              // height is computed from their count. When vertical the band decides, so
              // few categories give wide bars instead of thin marooned ones.
              {...(horizontal ? { barSize } : { maxBarSize: 64 })}
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
