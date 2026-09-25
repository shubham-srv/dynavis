"use client"

import dynamic from "next/dynamic"

/**
 * Charting libraries, loaded on demand.
 *
 * Recharts is ~100KB and only a minority of widget variants draw with it — a KPI card
 * below `expanded` needs none of it. Static imports pushed first-load script to 263KB
 * against the 220KB budget in PLAN §15; these keep it out of the initial bundle.
 *
 * `ssr: false` is deliberate rather than convenient: the chart is `aria-hidden`
 * decoration, and the accessible content — the summary and the data table — is rendered
 * on the server regardless (PLAN §5.3). Nothing a crawler or a screen reader needs is
 * behind this boundary.
 */

export const TrendChart = dynamic(
  () => import("./trend-chart").then((m) => m.TrendChart),
  { ssr: false }
)

export const RankingBar = dynamic(
  () => import("./ranking-bar").then((m) => m.RankingBar),
  { ssr: false }
)

export const ScatterPlot = dynamic(
  () => import("./scatter-chart").then((m) => m.ScatterPlot),
  { ssr: false }
)
