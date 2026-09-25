"use client"

import { RankingBar } from "@/components/charts/lazy"
import type { WidgetRenderProps } from "@/lib/registry/types"
import { formatValue } from "@/lib/viz/format"

/**
 * The same KPI across the children of the current scope.
 *
 * Horizontal bars below `expanded`, so long school names read as left-aligned text with
 * no rotation (PLAN §7). At `micro` there is no room for a chart at all, so it degrades
 * to a labelled list of the top three — substitution, not shrinking.
 */
export function RankingWidget({ datum, kpi, variant }: WidgetRenderProps) {
  const rows = datum.children
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing below this level to compare.
      </p>
    )
  }

  const fmt = (value: number | null) =>
    formatValue(value, {
      format: kpi.format,
      precision: kpi.precision,
      currency: kpi.money ? "USD" : undefined,
      compact: true,
    })

  if (variant === "micro") {
    const top = [...rows]
      .filter((row) => row.value !== null)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 3)
    return (
      <ul className="flex flex-col gap-1 text-sm">
        {top.map((row) => (
          <li
            key={row.id}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 tabular-nums">{fmt(row.value)}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <RankingBar
      data={rows}
      variant={variant}
      format={kpi.format}
      precision={kpi.precision}
      currency={kpi.money ? "USD" : undefined}
      label={`${kpi.label} by child unit`}
    />
  )
}
