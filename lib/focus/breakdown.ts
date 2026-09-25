import type { PeriodRef } from "@/lib/calendar/types"
import { kpiValue } from "@/lib/data/fixtures/values"
import type { WidgetDatum } from "@/lib/data/widget-data"
import { kpiById } from "@/lib/kpi/catalog"
import type { KpiDefinition } from "@/lib/kpi/types"
import type { Breakdown } from "@/lib/registry/types"

/**
 * The focus view's three axes.
 *
 * "Drill into a complex KPI" has two meanings, and a composite metric usually wants the
 * second: a manager seeing margin drop wants the cost line that moved, and gets to the
 * school list afterwards (PLAN §6.6).
 *
 *   location   children of the current scope, ranked      — every KPI
 *   component  waterfall of the inputs that produce it    — composites only
 *   time       the trend at this scope                    — every KPI
 */

export const BREAKDOWN_LABELS: Record<Breakdown, string> = {
  location: "By location",
  component: "By component",
  time: "Over time",
}

/**
 * Which axis to show.
 *
 * Falls back to the widget's declared default rather than erroring, so a stale or
 * hand-edited `?by=` produces a useful view instead of a broken one.
 */
export function resolveBreakdown(
  requested: string | undefined,
  offered: readonly Breakdown[]
): Breakdown {
  if (requested && (offered as readonly string[]).includes(requested)) {
    return requested as Breakdown
  }
  return offered[0]
}

/** Which axes make sense here — `component` needs components AND children to be absent-proof. */
export function offeredBreakdowns(
  kpi: KpiDefinition,
  datum: WidgetDatum
): Breakdown[] {
  const offered: Breakdown[] = []
  if (kpi.components?.length) offered.push("component")
  if (datum.children.length > 0) offered.push("location")
  offered.push("time")
  return offered
}

export interface WaterfallStep {
  label: string
  /** Signed contribution in the component's own units. */
  value: number | null
  sign: 1 | -1
  /** Running total after this step. */
  cumulative: number | null
}

/**
 * Decompose a composite into its inputs, as a running total.
 *
 * Returns `null` when any input is unmeasured: a waterfall that silently omits a cost
 * line reads as a complete picture and is not one. Better to show nothing and say why
 * (PLAN §12.3).
 */
export function buildWaterfall(
  kpi: KpiDefinition,
  scopeId: string,
  period: PeriodRef
): WaterfallStep[] | null {
  if (!kpi.components?.length) return null

  const steps: WaterfallStep[] = []
  let running = 0

  for (const component of kpi.components) {
    const definition = kpiById(component.kpiId)
    const value = kpiValue(scopeId, component.kpiId, period.id, "constant")
    if (value === null) return null

    running += component.sign * value
    steps.push({
      label: component.label || definition.label,
      value,
      sign: component.sign,
      cumulative: running,
    })
  }

  return steps
}

/** The largest single mover, which is what a manager is actually looking for. */
export function biggestMover(
  steps: readonly WaterfallStep[]
): WaterfallStep | null {
  const costs = steps.filter((step) => step.sign === -1 && step.value !== null)
  if (costs.length === 0) return null
  return costs.reduce((worst, step) =>
    step.value! > worst.value! ? step : worst
  )
}
