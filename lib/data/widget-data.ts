import { comparablePriorPeriod } from "@/lib/calendar/academic"
import type { PeriodRef } from "@/lib/calendar/types"
import { computeVsBaseline, resolveBaseline } from "@/lib/baseline/resolve"
import type { Baseline, BaselineKind } from "@/lib/data/envelope"
import { ACADEMIC_YEARS } from "@/lib/data/fixtures/fx"
import { findNode, schoolsUnder } from "@/lib/data/fixtures/org"
import { kpiValue } from "@/lib/data/fixtures/values"
import { kpiById } from "@/lib/kpi/catalog"
import { buildMatrix } from "@/lib/matrix/build"
import type { FxBasis } from "@/lib/money/fx"
import { loadPairedChildren, type PairedData } from "@/lib/data/pair-data"
import { computeDelta } from "@/lib/viz/format"

/**
 * One KPI, at one scope, for one period — everything a widget needs to render.
 *
 * Stands in for the batched `POST /dashboard/data` call (PLAN §16). It deliberately
 * produces the same shape the .NET endpoint will, so swapping it is a base-URL change
 * rather than a rewrite of every widget.
 */

export interface WidgetDatum {
  kpiId: string
  scopeId: string
  period: PeriodRef
  value: number | null
  baseline: Baseline
  /** Raw change in the KPI's display units — percentage points for rates (PLAN §8.6). */
  delta: number | null
  /** Direction-aware, normalised to [-1, 1]. The colour input. */
  vsBaseline: number | null
  /** History for sparklines and the time breakdown, oldest first. */
  history: readonly { x: string; y: number | null }[]
  /** How many children were actually measured — drives the small-denominator floor. */
  n: number
  /**
   * The same KPI across the children of this scope — what the ranking form and the
   * focus view's "By location" axis draw (PLAN §6.6).
   */
  children: readonly {
    id: string
    label: string
    value: number | null
    vsBaseline: number | null
  }[]
  /**
   * A second KPI joined to the first, per child — only for widgets that declare a
   * `pairKpiId`.
   *
   * Optional rather than part of every datum: a correlation needs two measures, and every
   * other widget needs exactly one. Loading a pair for all of them would double the work
   * on a dashboard where one widget in twenty wants it.
   */
  pair?: PairedData
}

export interface LoadOptions {
  preferredBaseline?: BaselineKind
  basis?: FxBasis
}

export function loadWidgetDatum(
  scopeId: string,
  kpiId: string,
  period: PeriodRef,
  options: LoadOptions = {}
): WidgetDatum {
  const { preferredBaseline = "target", basis = "constant" } = options
  const kpi = kpiById(kpiId)
  const node = findNode(scopeId)
  if (!node) throw new RangeError(`unknown org node: "${scopeId}"`)

  const value = kpiValue(scopeId, kpiId, period.id, basis)
  const prior = comparablePriorPeriod(period)
  const priorValue = ACADEMIC_YEARS.includes(
    prior.id as (typeof ACADEMIC_YEARS)[number]
  )
    ? kpiValue(scopeId, kpiId, prior.id, basis)
    : null

  // Peers are the siblings of this node — the comparison set the matrix already shows.
  const peers = peerValuesFor(scopeId, kpiId, period.id, basis)

  const baseline = resolveBaseline(preferredBaseline, {
    target: kpi.target,
    band: kpi.band,
    priorValue,
    priorPeriod: prior,
    peerValues: peers,
    peerBandLabel: node.meta?.peerBand,
  })

  const baseValue = baseline.kind === "none" ? null : (baseline.value ?? null)

  return {
    kpiId,
    scopeId,
    period,
    value,
    baseline,
    delta: computeDelta(value, baseValue, kpi.deltaFormat),
    vsBaseline: computeVsBaseline(
      value,
      baseline,
      kpi.direction,
      toleranceFor(kpiId)
    ),
    history: ACADEMIC_YEARS.map((ay) => ({
      x: ay,
      y: kpiValue(scopeId, kpiId, ay, basis),
    })),
    n: node.level === "school" ? 1 : schoolsUnder(scopeId).length,
    children: childSeries(scopeId, kpiId, period, basis, preferredBaseline),
  }
}

/**
 * Load a datum for a widget, honouring whatever extra measures it declares.
 *
 * Structurally typed rather than taking a `WidgetDefinition`, so `lib/data` does not have
 * to import the registry — the registry already imports data, and closing that loop is
 * how a module graph becomes untestable.
 *
 * Every caller that renders a widget goes through this. Calling `loadWidgetDatum`
 * directly is what left the quadrant widget's pair undefined on the kitchen-sink page,
 * where it rendered its "needs a paired KPI" message instead of a chart.
 */
export function loadForWidget(
  widget: {
    kpiId: string
    pairKpiId?: string
    weightKpiId?: string
  },
  scopeId: string,
  period: PeriodRef,
  options: LoadOptions = {}
): WidgetDatum {
  const datum = loadWidgetDatum(scopeId, widget.kpiId, period, options)
  if (!widget.pairKpiId) return datum

  return {
    ...datum,
    pair: loadPairedChildren(
      scopeId,
      widget.pairKpiId,
      widget.kpiId,
      period,
      { basis: options.basis, weightKpiId: widget.weightKpiId }
    ),
  }
}

/** Reuses the matrix builder, so a card and the matrix can never disagree. */
function childSeries(
  scopeId: string,
  kpiId: string,
  period: PeriodRef,
  basis: FxBasis,
  baselineMode: BaselineKind
) {
  const matrix = buildMatrix({
    scopeId,
    kpiIds: [kpiId],
    period,
    baselineMode,
    basis,
  })
  return matrix.rows.map((row, index) => ({
    id: row.id,
    label: row.label,
    value: matrix.cells[index][0].value,
    vsBaseline: matrix.cells[index][0].vsBaseline,
  }))
}

function peerValuesFor(
  scopeId: string,
  kpiId: string,
  periodId: string,
  basis: FxBasis
) {
  const node = findNode(scopeId)
  if (!node) return []
  // Siblings, via the parent. At the root there are no peers, which correctly makes the
  // peer-median baseline unavailable there.
  const parent = findParentOf(scopeId)
  if (!parent) return []
  return parent.children.map((child) =>
    kpiValue(child.id, kpiId, periodId, basis)
  )
}

function findParentOf(id: string) {
  const walk = (
    node: ReturnType<typeof findNode>
  ): ReturnType<typeof findNode> => {
    if (!node) return undefined
    if (node.children.some((child) => child.id === id)) return node
    for (const child of node.children) {
      const found = walk(child)
      if (found) return found
    }
    return undefined
  }
  return walk(findNode("group"))
}

/**
 * How far from baseline counts as "fully off", in the KPI's own units.
 *
 * Rates need this: 93% against a 95% attendance target is 2% in relative terms and very
 * material in practice, so relative deviation alone under-reacts (PLAN §8.5).
 */
const TOLERANCES: Record<string, number> = {
  seatUtilisation: 0.08,
  feeCollectionRate: 0.04,
  attendanceRate: 0.04,
  attainmentRate: 0.08,
  reEnrolmentRate: 0.06,
  staffTurnover: 0.06,
  discountLeakage: 0.05,
  contributionMargin: 0.06,
  classFillRate: 0.1,
  facilityUtilisation: 0.1,
  teacherAbsenceRate: 0.03,
  universityPlacement: 0.1,
}

export function toleranceFor(kpiId: string): number | undefined {
  return TOLERANCES[kpiId]
}
