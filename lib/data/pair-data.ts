import type { PeriodRef } from "@/lib/calendar/types"
import { findNode, schoolsUnder } from "@/lib/data/fixtures/org"
import { kpiValue } from "@/lib/data/fixtures/values"
import { kpiById } from "@/lib/kpi/catalog"
import type { FxBasis } from "@/lib/money/fx"
import type { PairedPoint } from "@/lib/viz/quadrant"

/**
 * Two KPIs for the same set of children, joined — what a scatter needs and `WidgetDatum`
 * cannot express.
 *
 * `WidgetDatum.children` carries one KPI across the children of a scope, which is exactly
 * right for a ranking and useless for a correlation. Rather than widen that type for every
 * widget, a paired load is its own shape and only the widgets that need it ask for one.
 * The real product batches this alongside everything else (PLAN §16); the join lives on
 * the server either way, because joining on the client means shipping two full series to
 * discard most of both.
 */

export interface PairedData {
  xKpiId: string
  yKpiId: string
  weightKpiId?: string
  scopeId: string
  period: PeriodRef
  points: readonly PairedPoint[]
  /**
   * Children that exist but could not be plotted, and why.
   *
   * Surfaced rather than silently dropped: "12 of 14 schools" with the missing two named
   * is honest, and a scatter that quietly loses a quarter of the estate is how people stop
   * trusting a dashboard (PLAN §12.3).
   */
  unmeasured: readonly { id: string; label: string }[]
}

export interface PairOptions {
  basis?: FxBasis
  /** A third measure for radius. Points missing it are still plotted, just unweighted. */
  weightKpiId?: string
}

export function loadPairedChildren(
  scopeId: string,
  xKpiId: string,
  yKpiId: string,
  period: PeriodRef,
  options: PairOptions = {}
): PairedData {
  const { basis = "constant", weightKpiId } = options

  // Throws on an unknown id rather than returning an empty chart, which would look like
  // "no data" and send someone hunting through fixtures.
  kpiById(xKpiId)
  kpiById(yKpiId)

  const node = findNode(scopeId)
  if (!node) throw new RangeError(`unknown org node: "${scopeId}"`)

  /*
    Schools, always — not the immediate children.

    Every other widget compares a scope to its direct children, because that is what
    drilling means. A correlation is different: cost per student and attainment are facts
    about a school, and averaging them up to a region first destroys exactly the variation
    the chart exists to show. At group level the immediate children are three regions, and
    "three points, r = 0.9" is a statistic about nothing.

    Plotting schools also makes the comparison stable as you drill — the marks thin out
    rather than changing meaning, and the sentence at `micro` says "across N schools" at
    every level.
  */
  const units = schoolsUnder(scopeId).map((school) => ({
    id: school.id,
    label: school.label,
  }))

  const points: PairedPoint[] = []
  const unmeasured: { id: string; label: string }[] = []

  for (const unit of units) {
    const x = kpiValue(unit.id, xKpiId, period.id, basis)
    const y = kpiValue(unit.id, yKpiId, period.id, basis)

    // Both axes or neither. A point plotted at x with y imputed to zero is not a gap in
    // the data, it is a false claim about a school — and on a scatter it lands in the
    // wrong quadrant and gets counted there (PLAN §12.3).
    if (x === null || y === null) {
      unmeasured.push(unit)
      continue
    }

    const weight =
      weightKpiId === undefined
        ? undefined
        : (kpiValue(unit.id, weightKpiId, period.id, basis) ?? undefined)

    points.push({ id: unit.id, label: unit.label, x, y, weight })
  }

  return {
    xKpiId,
    yKpiId,
    weightKpiId,
    scopeId,
    period,
    points,
    unmeasured,
  }
}
