"use client"

import { useId, useMemo, useState } from "react"

import type { ValueFormat } from "@/lib/data/envelope"
import { formatValue } from "@/lib/viz/format"
import { assertSeriesBudget, seriesVar } from "@/lib/viz/palette"
import {
  favourabilityOf,
  type Favourability,
  type PairedPoint,
  type QuadrantSplit,
} from "@/lib/viz/quadrant"
import type { Direction } from "@/lib/data/envelope"
import type { Variant } from "@/lib/viz/variants"
import { ChartReadout } from "@/components/charts/readout"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

/**
 * Two measures against each other.
 *
 * Hard-capped at three series, and that is a measurement rather than a preference:
 * scatter has no legend adjacency, so every pair of series must separate. Four slots
 * fail the normal-vision floor in both modes (light ΔE 13.7, dark 10.6) — see
 * PLAN §11.2. The assertion is here so the cap cannot quietly drift.
 *
 * **Drawn by hand, not by Recharts.** This began as a `<RechartsScatter>` and three things
 * forced it out, all of them requirements rather than preferences:
 *
 *   1. The median crosshair and the four quadrant regions are the point of the chart, and
 *      a reference area that has to sit *under* the marks while its labels sit *over* them
 *      is not something a composed chart library will order for you.
 *   2. Hit-testing has to be nearest-neighbour in pixel space within ~24px (PLAN §7), not
 *      "the mouse is inside the circle". Recharts' scatter tooltip is the latter, and on a
 *      phone a 9px target is unhittable.
 *   3. Radius has to be droppable per variant, and the mark has to carry a surface ring so
 *      overlapping points stay countable (PLAN §11.4).
 *
 * The SVG is about ninety lines and has no bundle cost, which is a better trade than
 * fighting a library for all three.
 */

export interface ScatterSeries {
  id: string
  label: string
  points: readonly { x: number; y: number | null }[]
}

/** The plot area, inside the axis gutters. */
const PAD = { top: 12, right: 14, bottom: 30, left: 48 }
const NEAREST_RADIUS = 24

/**
 * Legacy multi-series entry point, kept because the series cap and its test are written
 * against it and because "two measures, a few series" is a real shape the registry may
 * still want. Quadrant work goes through `QuadrantPlot` below.
 */
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

  const cleaned = series.map((one, index) => ({
    ...one,
    index,
    points: one.points.filter(
      (point): point is { x: number; y: number } => point.y !== null
    ),
  }))
  if (cleaned.every((one) => one.points.length === 0)) return null

  const flat: PairedPoint[] = cleaned.flatMap((one) =>
    one.points.map((point, i) => ({
      id: `${one.id}-${i}`,
      label: one.label,
      x: point.x,
      y: point.y,
    }))
  )

  return (
    <QuadrantPlot
      points={flat}
      colourOf={(point) =>
        seriesVar(cleaned.find((one) => one.label === point.label)?.index ?? 0)
      }
      xLabel={xLabel}
      yLabel={yLabel}
      xFormat={xFormat}
      yFormat={yFormat}
      xPrecision={precision}
      yPrecision={precision}
      label={label}
      height={height}
      variant="standard"
      split={null}
    />
  )
}

/** Corner placement for each quadrant's label, in plot-area fractions. */
const CORNERS: Record<string, { fx: number; fy: number; anchor: "start" | "end" }> = {
  "low-high": { fx: 0.02, fy: 0.08, anchor: "start" },
  "high-high": { fx: 0.98, fy: 0.08, anchor: "end" },
  "low-low": { fx: 0.02, fy: 0.96, anchor: "start" },
  "high-low": { fx: 0.98, fy: 0.96, anchor: "end" },
}

const FAVOURABILITY_FILL: Record<Favourability, string | null> = {
  // Reuses the matrix tints, so a quadrant and a matrix cell can never disagree about
  // what "good" looks like. Mixed and unknown are deliberately uncoloured: a third hue
  // would imply a third judgement we are not making.
  good: "var(--matrix-pos-1)",
  poor: "var(--matrix-neg-1)",
  mixed: null,
  unknown: null,
}

export function QuadrantPlot({
  points,
  split,
  xLabel,
  yLabel,
  xFormat = "number",
  yFormat = "number",
  xPrecision = 0,
  yPrecision = 0,
  xCurrency,
  yCurrency,
  xDirection,
  yDirection,
  label,
  height = 260,
  variant,
  colourOf,
  weightLabel,
  labelledIds,
  plotWidth,
}: {
  points: readonly PairedPoint[]
  /** Median split. `null` draws a plain scatter with no quadrants. */
  split: QuadrantSplit | null
  xLabel: string
  yLabel: string
  xFormat?: ValueFormat
  yFormat?: ValueFormat
  xPrecision?: number
  yPrecision?: number
  xCurrency?: string
  yCurrency?: string
  xDirection?: Direction
  yDirection?: Direction
  label: string
  height?: number
  variant: Variant
  colourOf?: (point: PairedPoint) => string
  weightLabel?: string
  /** Ids to label directly at `expanded`. In practice the outliers. */
  labelledIds?: readonly string[]
  /**
   * The container's measured width, in CSS pixels.
   *
   * Needed because a viewBox has an aspect ratio and `preserveAspectRatio` defaults to
   * letterboxing: with a fixed height and `width="100%"`, a 480×300 viewBox rendered into
   * an 860px box drew the chart 480px wide and centred it, leaving a third of the widget
   * empty on each side. Setting the viewBox to the real width fills the box, and unlike
   * `preserveAspectRatio="none"` it keeps the marks circular.
   */
  plotWidth?: number
}) {
  const clipId = useId()
  const reduced = useReducedMotion()
  const [active, setActive] = useState<PairedPoint | null>(null)

  // Falls back to a sane aspect when nothing was measured — the kitchen sink injects a
  // width, and jsdom never measures at all.
  const W = plotWidth && plotWidth > 120 ? plotWidth : 480
  const H = height

  const bounds = useMemo(() => {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    // A 6% margin, so a point on the extreme is not half-clipped by the axis.
    const pad = (lo: number, hi: number) => {
      if (lo === hi)
        return {
          lo: lo - Math.abs(lo || 1) * 0.1,
          hi: hi + Math.abs(hi || 1) * 0.1,
          min: lo,
          max: hi,
        }
      const span = hi - lo
      // `min`/`max` are the real extremes, kept separately: the ticks label those rather
      // than the padded bounds. Labelling the padding produced "102.0%" on an attainment
      // axis — a number no school has and, for a rate, one no school could have.
      return { lo: lo - span * 0.06, hi: hi + span * 0.06, min: lo, max: hi }
    }
    return {
      x: pad(Math.min(...xs), Math.max(...xs)),
      y: pad(Math.min(...ys), Math.max(...ys)),
    }
  }, [points])

  if (points.length === 0) return null

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const sx = (value: number) =>
    PAD.left +
    ((value - bounds.x.lo) / (bounds.x.hi - bounds.x.lo || 1)) * plotW
  // Inverted, because SVG y grows downward and a chart's does not.
  const sy = (value: number) =>
    PAD.top +
    plotH -
    ((value - bounds.y.lo) / (bounds.y.hi - bounds.y.lo || 1)) * plotH

  const showWeight = variant === "expanded"
  const weights = points
    .map((point) => point.weight)
    .filter((weight): weight is number => typeof weight === "number")
  const maxWeight = weights.length > 0 ? Math.max(...weights) : null

  /**
   * Radius, area-proportional.
   *
   * sqrt, because a reader compares bubbles by area and mapping a value to the *radius*
   * overstates a large one by its square — the single most common bubble-chart lie. Below
   * `expanded` every mark is the same size instead: at 560px the whole range spans four
   * pixels, which encodes nothing and only makes the marks harder to count (PLAN §11.4).
   */
  const radiusOf = (point: PairedPoint) => {
    if (!showWeight || maxWeight === null || !point.weight) return 5
    return 4 + Math.sqrt(point.weight / maxWeight) * 7
  }

  const showQuadrants = split !== null && variant !== "micro"
  const labelCorners =
    variant === "expanded" && split !== null && xDirection && yDirection

  const fmtX = (value: number) =>
    formatValue(value, {
      format: xFormat,
      precision: xPrecision,
      currency: xCurrency,
      compact: true,
    })
  const fmtY = (value: number) =>
    formatValue(value, {
      format: yFormat,
      precision: yPrecision,
      currency: yCurrency,
      compact: true,
    })

  /**
   * Nearest mark to the pointer, in pixel space, within 24px.
   *
   * Pixel space and not data space: the two axes have wildly different units — dollars
   * against a percentage — so "nearest" computed on values would be dominated entirely by
   * whichever axis has the larger numbers, and the chart would feel like it was ignoring
   * vertical movement (PLAN §7).
   */
  const pick = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget
    const box = svg.getBoundingClientRect()
    // Client pixels back into viewBox units, so the threshold means the same thing at
    // every rendered width.
    const px = ((event.clientX - box.left) / box.width) * W
    const py = ((event.clientY - box.top) / box.height) * H

    let best: PairedPoint | null = null
    let bestDistance = Infinity
    for (const point of points) {
      const distance = Math.hypot(sx(point.x) - px, sy(point.y) - py)
      if (distance < bestDistance) {
        bestDistance = distance
        best = point
      }
    }
    setActive(bestDistance <= NEAREST_RADIUS ? best : null)
  }

  const colour = colourOf ?? (() => seriesVar(0))

  return (
    <div className="flex w-full flex-col gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={height}
        role="img"
        aria-label={label}
        className="touch-none overflow-visible"
        onPointerMove={pick}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* Quadrant washes first, so every mark and label sits above them. */}
        {showQuadrants ? (
          <g clipPath={`url(#${clipId})`}>
            {(
              [
                ["low-high", PAD.left, PAD.top],
                ["high-high", sx(split.x), PAD.top],
                ["low-low", PAD.left, sy(split.y)],
                ["high-low", sx(split.x), sy(split.y)],
              ] as const
            ).map(([key, x, y]) => {
              const fill =
                xDirection && yDirection
                  ? FAVOURABILITY_FILL[
                      favourabilityOf(key, xDirection, yDirection)
                    ]
                  : null
              if (!fill) return null
              return (
                <rect
                  key={key}
                  x={x}
                  y={y}
                  width={key.startsWith("low") ? sx(split.x) - PAD.left : PAD.left + plotW - sx(split.x)}
                  height={key.endsWith("high") ? sy(split.y) - PAD.top : PAD.top + plotH - sy(split.y)}
                  fill={fill}
                  // Decorative: the corner label and the readout carry the same meaning,
                  // so forced-colors dropping this loses nothing (PLAN §8.3).
                  data-matrix-tint=""
                  opacity={0.5}
                />
              )
            })}
          </g>
        ) : null}

        {/* Axis frame. No gridlines below `standard` (PLAN §7). */}
        <line
          x1={PAD.left}
          y1={PAD.top + plotH}
          x2={PAD.left + plotW}
          y2={PAD.top + plotH}
          stroke="var(--border)"
        />
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + plotH}
          stroke="var(--border)"
        />

        {/* The median crosshair — the thing that makes the quadrants legible. */}
        {showQuadrants ? (
          <g>
            <line
              x1={sx(split.x)}
              y1={PAD.top}
              x2={sx(split.x)}
              y2={PAD.top + plotH}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
            />
            <line
              x1={PAD.left}
              y1={sy(split.y)}
              x2={PAD.left + plotW}
              y2={sy(split.y)}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
            />
          </g>
        ) : null}

        {/*
          First / last ticks only, never rotated (PLAN §7), and placed at the real extremes
          rather than at the padded bounds — so every number on an axis is one a school
          actually reports.
        */}
        <text
          x={sx(bounds.x.min)}
          y={H - 8}
          fontSize={10}
          fill="var(--muted-foreground)"
        >
          {fmtX(bounds.x.min)}
        </text>
        <text
          x={sx(bounds.x.max)}
          y={H - 8}
          fontSize={10}
          textAnchor="end"
          fill="var(--muted-foreground)"
        >
          {fmtX(bounds.x.max)}
        </text>
        <text
          x={PAD.left - 6}
          y={sy(bounds.y.max) + 3}
          fontSize={10}
          textAnchor="end"
          fill="var(--muted-foreground)"
        >
          {fmtY(bounds.y.max)}
        </text>
        <text
          x={PAD.left - 6}
          y={sy(bounds.y.min) + 3}
          fontSize={10}
          textAnchor="end"
          fill="var(--muted-foreground)"
        >
          {fmtY(bounds.y.min)}
        </text>

        {/* Corner verdicts, at `expanded` only — they need room to not collide. */}
        {labelCorners
          ? (Object.keys(CORNERS) as (keyof typeof CORNERS)[]).map((key) => {
              const corner = CORNERS[key]
              const favour = favourabilityOf(
                key as never,
                xDirection,
                yDirection
              )
              if (favour === "mixed" || favour === "unknown") return null
              return (
                <text
                  key={key}
                  x={PAD.left + corner.fx * plotW}
                  y={PAD.top + corner.fy * plotH}
                  fontSize={10}
                  fontWeight={600}
                  textAnchor={corner.anchor}
                  fill="var(--muted-foreground)"
                >
                  {favour === "good" ? "Best placed" : "Needs attention"}
                </text>
              )
            })
          : null}

        <g clipPath={`url(#${clipId})`}>
          {points.map((point, index) => {
            const isActive = active?.id === point.id
            return (
              <circle
                key={point.id}
                cx={sx(point.x)}
                cy={sy(point.y)}
                r={radiusOf(point) + (isActive ? 2 : 0)}
                fill={colour(point)}
                // A surface-coloured ring, so two overlapping marks read as two marks
                // rather than one blob (PLAN §11.4).
                stroke={isActive ? "var(--foreground)" : "var(--card)"}
                strokeWidth={isActive ? 2 : 1.5}
                className={reduced ? undefined : "mark-in"}
                style={
                  reduced
                    ? undefined
                    : {
                        // Staggered, and capped: at 40 schools an uncapped 20ms step runs
                        // for most of a second and the chart feels slow to arrive.
                        animationDelay: `${Math.min(index * 16, 240)}ms`,
                      }
                }
              />
            )
          })}
        </g>

        {/*
          Direct labels, for the handful of marks worth naming, at `expanded` only.

          A label per mark is unreadable at any size, and a legend would be worse — this
          chart has no series to key, so a legend could only repeat the axis titles. The
          caller decides which points earn a name (in practice, the outliers), which keeps
          the decision with the code that knows what the finding is.
        */}
        {variant === "expanded" && labelledIds && labelledIds.length > 0
          ? points
              .filter((point) => labelledIds.includes(point.id))
              .map((point) => {
                // Flip to the left of the mark near the right edge, so a long school name
                // is not clipped by the plot area.
                const near = sx(point.x) > PAD.left + plotW * 0.7
                return (
                  <text
                    key={`label-${point.id}`}
                    x={sx(point.x) + (near ? -(radiusOf(point) + 4) : radiusOf(point) + 4)}
                    y={sy(point.y) + 3}
                    fontSize={10}
                    textAnchor={near ? "end" : "start"}
                    fill="var(--foreground)"
                  >
                    {point.label}
                  </text>
                )
              })
          : null}
      </svg>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-muted-foreground">
          {xLabel} <span aria-hidden>→</span> · {yLabel} <span aria-hidden>↑</span>
          {showWeight && weightLabel ? ` · size: ${weightLabel}` : ""}
        </p>
        <ChartReadout
          label={active?.label ?? null}
          value={active ? `${fmtY(active.y)} ${yLabel.toLowerCase()}` : null}
          secondary={active ? `${fmtX(active.x)} ${xLabel.toLowerCase()}` : null}
        />
      </div>
    </div>
  )
}
