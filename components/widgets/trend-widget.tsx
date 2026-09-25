"use client"

import { Sparkline } from "@/components/charts/sparkline"
import { TrendChart } from "@/components/charts/lazy"
import type { WidgetRenderProps } from "@/lib/registry/types"
import { baselineLabel } from "@/lib/baseline/resolve"
import { formatDelta, formatValue } from "@/lib/viz/format"

/**
 * A KPI over time, given room to breathe.
 *
 * At `micro` a chart is not attempted: the headline and its movement are the whole
 * story, and an illegible 4-point line adds nothing (PLAN §7).
 */
export function TrendWidget({ datum, kpi, variant }: WidgetRenderProps) {
  const headline = formatValue(datum.value, {
    format: kpi.format,
    precision: kpi.precision,
    currency: kpi.money ? "USD" : undefined,
    compact: true,
  })
  const delta = formatDelta(datum.delta, {
    deltaFormat: kpi.deltaFormat,
    precision: 1,
    valueFormat: kpi.format,
    currency: kpi.money ? "USD" : undefined,
    compact: true,
  })

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <output className="text-xl font-semibold tabular-nums">
          {headline}
        </output>
        {datum.delta === null ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {delta} {baselineLabel(datum.baseline)}
          </span>
        )}
      </div>

      {variant === "micro" ? null : variant === "compact" ? (
        <Sparkline
          points={datum.history}
          direction={kpi.direction}
          className="h-10 w-full"
        />
      ) : (
        <TrendChart
          points={datum.history}
          variant={variant}
          format={kpi.format}
          precision={kpi.precision}
          currency={kpi.money ? "USD" : undefined}
          target={kpi.target}
          height={variant === "expanded" ? 180 : 130}
          label={`${kpi.label} over time`}
        />
      )}
    </div>
  )
}
