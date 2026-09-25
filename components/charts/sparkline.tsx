import type { Direction } from "@/lib/data/envelope"
import { cn } from "@/lib/utils"

/**
 * A trend, at a glance.
 *
 * Deliberately hand-drawn SVG rather than a charting library: a sparkline has no axes,
 * no legend and no tooltip, so pulling in ~100KB for it would be pure cost. It is also
 * `aria-hidden` — the widget's summary and data table already carry this information in
 * a form a screen reader can use (PLAN §5.3).
 */
export function Sparkline({
  points,
  direction,
  className,
}: {
  points: readonly { x: string; y: number | null }[]
  direction?: Direction
  className?: string
}) {
  const measured = points
    .map((point, index) => ({ index, y: point.y }))
    .filter(
      (point): point is { index: number; y: number } =>
        point.y !== null && Number.isFinite(point.y)
    )

  if (measured.length < 2) return null

  const values = measured.map((point) => point.y)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 100
  const height = 28

  const coords = measured.map((point) => {
    const x = (point.index / Math.max(points.length - 1, 1)) * width
    const y = height - ((point.y - min) / span) * (height - 4) - 2
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const rising = values.at(-1)! > values[0]
  // Colour follows the KPI's direction, not the slope: a falling cost line is good.
  const good = direction === "lower-is-better" ? !rising : rising
  const stroke =
    direction === "neutral" || direction === "band"
      ? "var(--muted-foreground)"
      : good
        ? "var(--chart-1)"
        : "var(--chart-8)"

  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
