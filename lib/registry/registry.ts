import { envelopeToTable, summariseSeries } from "@/lib/a11y/table"
import { baselineLabel } from "@/lib/baseline/resolve"
import type { DataEnvelope } from "@/lib/data/envelope"
import type { WidgetDatum } from "@/lib/data/widget-data"
import { KPIS, kpiById, selectableKpis } from "@/lib/kpi/catalog"
import type { KpiDefinition } from "@/lib/kpi/types"
import type { Breakpoint, SizeToken } from "@/lib/layout/tokens"
import type { ScopeRef } from "@/lib/scope/types"
import type { Variant } from "@/lib/viz/variants"
import {
  describeStrength,
  favourabilityOf,
  groupByQuadrant,
  outliers,
  pearson,
  quadrantSplit,
  QUADRANT_KEYS,
} from "@/lib/viz/quadrant"
import { KpiCard } from "@/components/widgets/kpi-card"
import { QuadrantWidget } from "@/components/widgets/quadrant-widget"
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

/**
 * The correlation widget — two KPIs against each other, with a third as mark size.
 *
 * Built by hand rather than through `chartWidget`, because everything about it differs
 * from a single-KPI widget: it declares a second and third KPI, its accessible table is a
 * unit-by-measure grid rather than a time series, and its summary states a *relationship*
 * instead of a value. Forcing it through the card factory would have meant adding three
 * optional branches there to serve one widget.
 */
/**
 * The quadrant widget's own footprint: full width, four rows.
 *
 * **Taller** because it is the only widget whose body is a real chart with axis labels and
 * a readout strip beneath it. At rowSpan 3 the card is 288px, the header takes ~60 of that,
 * and a 240px plot plus its axis row overflowed — the x ticks and the readout were clipped
 * off the bottom on desktop.
 *
 * **Full width** because this widget is the one whose form genuinely changes with the space
 * it is given, and a half-width card pins it to `standard` forever. At full width the real
 * dashboard shows three different objects across the three tested viewports: count tiles at
 * 375, a scatter at 768, bubbles with quadrant verdicts at 1440. A correlation across the
 * whole estate is also the widest question on the page, so it earns the row.
 *
 * Only `size.desktop` is read — the class set it names carries the mobile and tablet spans
 * with it (see `SPAN_CLASS`). The other two entries document intent and are not consulted.
 */
const QUADRANT_SIZE: Record<Breakpoint, { token: SizeToken; rowSpan: number }> =
  {
    mobile: { token: "xl", rowSpan: 4 },
    tablet: { token: "xl", rowSpan: 4 },
    desktop: { token: "xl", rowSpan: 4 },
  }

function quadrantWidget({
  id,
  xKpiId,
  yKpiId,
  weightKpiId,
  title,
  question,
}: {
  id: string
  xKpiId: string
  yKpiId: string
  weightKpiId?: string
  title: string
  question: string
}): WidgetDefinition {
  const xKpi = kpiById(xKpiId)
  const yKpi = kpiById(yKpiId)

  return {
    id,
    // The y measure is the subject: this is "attainment, against what it costs", so the
    // focus view and the picker group it with attainment rather than with cost.
    kpiId: yKpiId,
    pairKpiId: xKpiId,
    weightKpiId,
    title,
    question,
    pillar: yKpi.pillar,
    // Correlating across children needs children. At school level there is nothing below
    // to compare, and the widget says so rather than drawing one point.
    validAtLevels: ["group", "region", "country", "cluster"],
    size: QUADRANT_SIZE,
    variants: ALL_VARIANTS,
    breakdowns: ["location", "time"],
    render: QuadrantWidget,
    a11y: {
      /*
        The finding in words, and it must match what the chart shows — this is the only
        form a screen-reader user gets, and at `micro` it is the only form *anyone* gets.
        Built from the same functions the sentence in the widget is built from, so the two
        cannot drift.
      */
      summary: (datum, _definition, scope) => {
        const where = scope.at(-1)?.label ?? "the group"
        const points = datum.pair?.points ?? []
        if (points.length < 3) {
          return `${title} for ${where}. Too few schools report both ${xKpi.label} and ${yKpi.label} to compare them.`
        }
        const r = pearson(points)
        const strength = describeStrength(r)
        const split = quadrantSplit(points)
        const groups = split ? groupByQuadrant(points, split) : null

        const relationship =
          strength === "none"
            ? `${xKpi.label} and ${yKpi.label} move independently across ${points.length} schools`
            : `across ${points.length} schools there is a ${strength} relationship — higher ${xKpi.label} tracks ${(r ?? 0) > 0 ? "higher" : "lower"} ${yKpi.label}`

        const best = groups
          ? QUADRANT_KEYS.filter(
              (key) =>
                favourabilityOf(key, xKpi.direction, yKpi.direction) === "good"
            ).reduce((sum, key) => sum + groups[key].length, 0)
          : 0
        const worst = groups
          ? QUADRANT_KEYS.filter(
              (key) =>
                favourabilityOf(key, xKpi.direction, yKpi.direction) === "poor"
            ).reduce((sum, key) => sum + groups[key].length, 0)
          : 0

        const exceptions = outliers(points)
        const breaks =
          exceptions.length > 0
            ? ` Breaking the pattern: ${exceptions.map((point) => point.label).join(", ")}.`
            : ""

        return `${title} for ${where}. ${relationship}. ${best} best placed, ${worst} needing attention.${breaks}`
      },
      /*
        One row per unit, both measures side by side — the same join the chart plots. Not
        derived from `envelopeToTable`, which models one series over time and would have to
        pretend the x measure was a second series over the same axis.
      */
      table: (datum) => {
        const pair = datum.pair
        const points = pair?.points ?? []
        return {
          caption: `${yKpi.label} against ${xKpi.label}, by school`,
          columns: ["School", xKpi.label, yKpi.label],
          rows: [
            ...points.map((point) => [point.label, point.x, point.y]),
            // Schools missing either measure are listed with nulls rather than omitted: a
            // table that silently drops them tells a reader the estate is smaller than it
            // is (PLAN §12.3).
            ...(pair?.unmeasured ?? []).map((unit) => [unit.label, null, null]),
          ],
        }
      },
    },
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
  quadrantWidget({
    id: "quadrant.costVsAttainment",
    xKpiId: "costPerStudent",
    yKpiId: "attainmentRate",
    weightKpiId: "grossRevenue",
    title: "Cost vs attainment",
    question: "Are the schools we spend most on the ones that perform best?",
  }),
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

/**
 * The default dashboard for a role: two per pillar, north star first, and one chart that
 * relates two of them.
 *
 * The quadrant widget is last deliberately. The six cards answer "how are we doing"; it
 * answers "is the money working", which is the question someone asks *after* reading the
 * cards. It also drops out by itself on a principal's dashboard, where there are no
 * schools below to compare (`validAtLevels`).
 */
export const DEFAULT_WIDGET_IDS: readonly string[] = [
  "card.reEnrolmentRate",
  "card.seatUtilisation",
  "card.contributionMargin",
  "card.attainmentRate",
  "card.studentTeacherRatio",
  "card.attendanceRate",
  "quadrant.costVsAttainment",
]
