import { envelopeToTable, summariseSeries } from "@/lib/a11y/table"
import { baselineLabel } from "@/lib/baseline/resolve"
import type { DataEnvelope } from "@/lib/data/envelope"
import type { WidgetDatum } from "@/lib/data/widget-data"
import { KPIS, kpiById, selectableKpis } from "@/lib/kpi/catalog"
import type { KpiDefinition } from "@/lib/kpi/types"
import type { Breakpoint, SizeToken } from "@/lib/layout/tokens"
import type { ScopeRef } from "@/lib/scope/types"
import type { Variant } from "@/lib/viz/variants"
import { KpiCard } from "@/components/widgets/kpi-card"
import { RankingWidget } from "@/components/widgets/ranking-widget"
import { TrendWidget } from "@/components/widgets/trend-widget"

import type { Breakdown, WidgetDefinition } from "./types"

/**
 * The widget registry.
 *
 * Derived from the KPI catalog rather than hand-written, so adding a KPI adds a widget
 * and the contract test (`registry.test.ts`) picks it up automatically. Adding a widget
 * touches exactly one file, which was the Phase 3 exit criterion.
 */

const CARD_SIZE: Record<Breakpoint, { token: SizeToken; rowSpan: number }> = {
  mobile: { token: "sm", rowSpan: 2 },
  tablet: { token: "sm", rowSpan: 2 },
  desktop: { token: "sm", rowSpan: 2 },
}

const ALL_VARIANTS: readonly Variant[] = [
  "micro",
  "compact",
  "standard",
  "expanded",
]

/**
 * Where a KPI is meaningful.
 *
 * University placement needs senior years, so it only makes sense at a school; the rest
 * aggregate cleanly at every level. Declared honestly rather than defaulting everything
 * to "all", because the picker shows invalid widgets as disabled-with-a-reason and that
 * is only useful if the data is true (PLAN §10).
 */
function levelsFor(kpi: KpiDefinition): readonly string[] | "all" {
  if (kpi.requiresSeniorYears) return ["school"]
  return "all"
}

function breakdownsFor(kpi: KpiDefinition): readonly Breakdown[] {
  // Composites open on the waterfall: a manager seeing margin drop wants the cost line
  // that moved, and gets to the school list second (PLAN §6.6).
  if (kpi.components) return ["component", "location", "time"]
  return ["location", "time"]
}

/** The envelope form of a datum's history — what the table and summary are built from. */
function toEnvelope(datum: WidgetDatum, kpi: KpiDefinition): DataEnvelope {
  return {
    meta: {
      format: kpi.format,
      deltaFormat: kpi.deltaFormat,
      precision: kpi.precision,
      unit: kpi.unit,
      xType: "time",
      period: datum.period,
      asOf: "2026-03-31",
      currency: kpi.money
        ? { reporting: "USD", basis: "constant", fxAsOf: "ay-2025" }
        : undefined,
    },
    series: [
      {
        id: kpi.id,
        label: kpi.label,
        direction: kpi.direction,
        baseline: datum.baseline,
        points: datum.history.map((point) => ({ x: point.x, y: point.y })),
      },
    ],
  }
}

function cardWidget(kpi: KpiDefinition): WidgetDefinition {
  return {
    id: `card.${kpi.id}`,
    kpiId: kpi.id,
    title: kpi.label,
    question: kpi.question,
    pillar: kpi.pillar,
    validAtLevels: levelsFor(kpi),
    size: CARD_SIZE,
    variants: ALL_VARIANTS,
    breakdowns: breakdownsFor(kpi),
    render: KpiCard,
    a11y: {
      summary: (datum, definition, scope: ScopeRef) => {
        const where = scope.at(-1)?.label ?? "the group"
        const trend = summariseSeries(definition.label, datum.history, {
          format: definition.format,
          precision: definition.precision,
          currency: definition.money ? "USD" : undefined,
        })
        return `${definition.label} for ${where}. ${trend} Measured ${baselineLabel(datum.baseline)}.`
      },
      table: (datum, definition) =>
        envelopeToTable(
          toEnvelope(datum, definition),
          `${definition.label} by academic year`
        ),
    },
  }
}

const WIDE_SIZE: Record<Breakpoint, { token: SizeToken; rowSpan: number }> = {
  mobile: { token: "sm", rowSpan: 3 },
  tablet: { token: "md", rowSpan: 3 },
  desktop: { token: "md", rowSpan: 3 },
}

/**
 * Dedicated chart widgets, where the chart *is* the point.
 *
 * Deliberately few. One widget per KPI plus a handful of charts keeps the picker
 * honest; a trend and a ranking variant of all eighteen KPIs would recreate exactly
 * the clutter this project exists to remove (PLAN §1.1).
 */
function chartWidget(
  prefix: string,
  kpi: KpiDefinition,
  render: WidgetDefinition["render"],
  titleSuffix: string
): WidgetDefinition {
  const base = cardWidget(kpi)
  return {
    ...base,
    id: `${prefix}.${kpi.id}`,
    title: `${kpi.label} ${titleSuffix}`,
    size: WIDE_SIZE,
    render,
  }
}

export const WIDGETS: readonly WidgetDefinition[] = [
  ...selectableKpis().map(cardWidget),
  chartWidget("trend", kpiById("reEnrolmentRate"), TrendWidget, "over time"),
  chartWidget("ranking", kpiById("seatUtilisation"), RankingWidget, "by unit"),
  chartWidget(
    "ranking",
    kpiById("contributionMargin"),
    RankingWidget,
    "by unit"
  ),
]

const BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]))

export function widgetById(id: string): WidgetDefinition {
  const widget = BY_ID.get(id)
  if (!widget) throw new RangeError(`unknown widget: "${id}"`)
  return widget
}

/** Widgets that mean something at this scope level. */
export function widgetsForLevel(level: string): readonly WidgetDefinition[] {
  return WIDGETS.filter(
    (widget) =>
      widget.validAtLevels === "all" || widget.validAtLevels.includes(level)
  )
}

export function isValidAtLevel(
  widget: WidgetDefinition,
  level: string
): boolean {
  return widget.validAtLevels === "all" || widget.validAtLevels.includes(level)
}

/** Why a widget is unavailable here — shown in the picker instead of hiding it. */
export function unavailableReason(
  widget: WidgetDefinition,
  level: string
): string | null {
  if (isValidAtLevel(widget, level)) return null
  const kpi = KPIS.find((candidate) => candidate.id === widget.kpiId)
  if (kpi?.requiresSeniorYears)
    return "Only available for schools with senior years"
  return `Not available at ${level} level`
}

/** The default dashboard for a role: two per pillar, north star first. */
export const DEFAULT_WIDGET_IDS: readonly string[] = [
  "card.reEnrolmentRate",
  "card.seatUtilisation",
  "card.contributionMargin",
  "card.attainmentRate",
  "card.studentTeacherRatio",
  "card.attendanceRate",
]
