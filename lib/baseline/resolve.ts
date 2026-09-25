import type { PeriodRef } from "@/lib/calendar/types"
import { medianIgnoringNulls } from "@/lib/data/aggregate"
import {
  type Baseline,
  type BaselineKind,
  BASELINE_FALLBACK,
  type Direction,
} from "@/lib/data/envelope"

/**
 * What a value is judged against.
 *
 * The client does not yet know whether per-KPI, per-school targets exist, and this is
 * the module that makes that not matter: everything downstream reads `vsBaseline` and
 * never branches on which kind produced it. "We have no targets" changes a default here
 * and nothing else in the product (PLAN §8.4, D21).
 */

export interface BaselineInputs {
  target?: number
  band?: { min: number; max: number }
  priorValue?: number | null
  priorPeriod?: PeriodRef
  /** Values for the peer set — the other children of the current scope, or a peer band. */
  peerValues?: readonly (number | null | undefined)[]
  peerBandLabel?: string
}

/**
 * Resolve the strongest available baseline at or below `preferred`.
 *
 * Falls through `target → prior-period → peer-median → none`. Columns in one matrix may
 * legitimately resolve differently — with partial targets, some read "vs. target" and
 * others "vs. last year" — which is why the resolved kind must be surfaced per column
 * rather than per matrix (PLAN §8.4).
 */
export function resolveBaseline(
  preferred: BaselineKind,
  inputs: BaselineInputs
): Baseline {
  const start = BASELINE_FALLBACK.indexOf(preferred)
  const chain = BASELINE_FALLBACK.slice(start === -1 ? 0 : start)

  for (const kind of chain) {
    if (
      kind === "target" &&
      inputs.target !== undefined &&
      Number.isFinite(inputs.target)
    ) {
      return { kind: "target", value: inputs.target, band: inputs.band }
    }

    if (kind === "prior-period" && inputs.priorPeriod) {
      // A prior period with no reading is still a prior-period baseline — it just has
      // nothing in it. That is how a school opened this year gets "new" rather than a
      // peer comparison it never asked for.
      return {
        kind: "prior-period",
        value: inputs.priorValue ?? null,
        period: inputs.priorPeriod,
      }
    }

    if (
      kind === "peer-median" &&
      inputs.peerValues &&
      inputs.peerValues.length > 0
    ) {
      const median = medianIgnoringNulls(inputs.peerValues)
      if (median.value !== null) {
        return {
          kind: "peer-median",
          value: median.value,
          n: median.n,
          band: inputs.peerBandLabel,
        }
      }
    }

    if (kind === "none") return { kind: "none" }
  }

  return { kind: "none" }
}

/** The value a baseline compares against, or `null` when it has none. */
export function baselineValue(baseline: Baseline): number | null {
  return baseline.kind === "none" ? null : (baseline.value ?? null)
}

/**
 * How far a value sits from its baseline, normalised to [-1, 1] and **direction-aware**.
 *
 * Positive always means good, whatever the KPI. That is what lets the matrix colour a
 * cell without knowing anything about the metric, and it is the guard against the most
 * likely bug in the component: colouring a rising cost per student green (PLAN §8.5).
 *
 * `tolerance` is the deviation that counts as fully good or fully bad. Relative
 * deviation alone understates rates — a 2pp miss on a 95% attendance target is 2%
 * relative and very material — so KPIs that care declare their own.
 */
export function computeVsBaseline(
  value: number | null | undefined,
  baseline: Baseline,
  direction: Direction,
  tolerance?: number
): number | null {
  if (value === null || value === undefined || !Number.isFinite(value))
    return null
  // No judgement without something to judge against, and none for a metric that has no
  // good direction — a headcount going up is not "better".
  if (baseline.kind === "none" || direction === "neutral") return null

  const base = baselineValue(baseline)
  if (base === null || !Number.isFinite(base)) return null

  if (direction === "band") {
    const band = baseline.kind === "target" ? baseline.band : undefined
    // A band KPI with no agreed band degrades to no judgement rather than guessing
    // which way is good. Understaffing is not an improvement (PLAN §8.5).
    if (!band) return null

    if (value >= band.min && value <= band.max) return 0
    const distance = value < band.min ? band.min - value : value - band.max
    const scale =
      tolerance ?? Math.max((band.max - band.min) / 2, Number.EPSILON)
    // Outside the band is bad in both directions.
    return -clamp(distance / scale)
  }

  const scale = tolerance ?? Math.max(Math.abs(base) * 0.1, Number.EPSILON)
  const signed = (value - base) / scale
  return clamp(direction === "lower-is-better" ? -signed : signed)
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(-1, Math.min(1, value))
}

/** Human-readable label for the active baseline — always shown beside the number. */
export function baselineLabel(
  baseline: Baseline,
  priorPeriodLabel?: string
): string {
  switch (baseline.kind) {
    case "target":
      return "vs. target"
    case "prior-period":
      return `vs. ${priorPeriodLabel ?? baseline.period.id}`
    case "peer-median":
      return `vs. peer median, n=${baseline.n}`
    case "none":
      return "no baseline"
  }
}
