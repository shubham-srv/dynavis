"use client"

import { directionGlyph, matrixTint, matrixTintVar } from "@/lib/viz/palette"
import type { WidgetRenderProps } from "@/lib/registry/types"
import { baselineLabel } from "@/lib/baseline/resolve"
import { cn } from "@/lib/utils"
import {
  formatDelta,
  formatValue,
  isDeltaMeaningful,
  NOT_MEASURED,
} from "@/lib/viz/format"
import { Sparkline } from "@/components/charts/sparkline"
import { TrendChart } from "@/components/charts/lazy"

/**
 * A single KPI, at the current scope.
 *
 * The variant ladder in miniature (PLAN §7): the number is always there, and everything
 * else — sparkline, baseline label, period — appears as the box earns the room. Nothing
 * shrinks; things are added or dropped.
 */
export function KpiCard({ datum, kpi, variant }: WidgetRenderProps) {
  const { value, delta, vsBaseline, baseline, history, n } = datum

  const valueText = formatValue(value, {
    format: kpi.format,
    precision: kpi.precision,
    currency: kpi.format === "currency" ? "USD" : undefined,
    compact: kpi.format === "currency" || kpi.format === "number",
  })

  const meaningful = isDeltaMeaningful(n) || n === 1
  const deltaText = formatDelta(delta, {
    deltaFormat: kpi.deltaFormat,
    precision: kpi.precision === 0 ? 0 : 1,
    valueFormat: kpi.format,
    currency: kpi.format === "currency" ? "USD" : undefined,
    compact: true,
  })

  const measured = history.some((point) => point.y !== null)
  // The variant ladder: a sparkline earns its place from `compact`, a real trend with
  // axes and a target line only once the box is wide enough to read one (PLAN §7).
  const showSparkline = variant === "compact" || variant === "standard"
  const showTrend = variant === "expanded" && measured
  // Reuse the matrix buckets rather than re-deriving them, so a card and a matrix cell
  // can never disagree about whether a value is worth colouring.
  const tint = matrixTintVar(matrixTint(vsBaseline))

  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div className="flex items-baseline gap-2">
        <output className="text-2xl font-semibold tracking-tight tabular-nums">
          {valueText}
        </output>

        {delta === null ? null : (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs tabular-nums",
              // Colour is secondary: the glyph and the signed number carry the signal,
              // which is what makes this readable in forced-colors and to CVD viewers.
              !meaningful && "text-muted-foreground"
            )}
            style={tint && meaningful ? { backgroundColor: tint } : undefined}
          >
            <span aria-hidden>{directionGlyph(vsBaseline)}</span>
            {deltaText}
          </span>
        )}
      </div>

      {showSparkline && measured ? (
        <Sparkline
          points={history}
          direction={kpi.direction}
          className="h-8 w-full"
        />
      ) : null}

      {showTrend ? (
        <TrendChart
          points={history}
          variant={variant}
          format={kpi.format}
          precision={kpi.precision}
          currency={kpi.money ? "USD" : undefined}
          target={kpi.target}
          height={120}
          label={`${kpi.label} over time`}
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        {value === null ? (
          <span>Not measured this period</span>
        ) : (
          <>
            {baselineLabel(baseline)}
            {!meaningful && n > 0 ? (
              <span> · n={n}, treat with care</span>
            ) : null}
          </>
        )}
      </p>
    </div>
  )
}

export { NOT_MEASURED }
