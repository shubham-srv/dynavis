import type { PeriodRef } from "@/lib/calendar/types"

/**
 * The chart-neutral data contract.
 *
 * Nothing here is shaped for Recharts, Chart.js or any other library — that is what lets
 * the charting decision be reversed without touching a widget (PLAN D7). The future .NET
 * API returns exactly these shapes (PLAN §16).
 */

export type ValueFormat =
  "number" | "currency" | "percent" | "duration" | "ratio"

/**
 * A property of the KPI itself, not of its target — so it is required even when no
 * target exists. Rising cost per student is bad whether or not anyone set a number for
 * it (PLAN §8.5).
 */
export type Direction =
  "higher-is-better" | "lower-is-better" | "band" | "neutral"

/**
 * What a value is judged against.
 *
 * Polymorphic because the client may not have targets. The matrix and every delta read
 * the derived `vsBaseline`; they never branch on which kind produced it, so "we have no
 * targets" changes a default rather than a design (PLAN §8.4, D21).
 */
export type Baseline =
  | { kind: "target"; value: number; band?: { min: number; max: number } }
  | { kind: "prior-period"; value: number | null; period: PeriodRef }
  | { kind: "peer-median"; value: number | null; n: number; band?: string }
  | { kind: "none" }

export type BaselineKind = Baseline["kind"]

/** The order a resolver falls through when a preferred baseline is unavailable. */
export const BASELINE_FALLBACK: readonly BaselineKind[] = [
  "target",
  "prior-period",
  "peer-median",
  "none",
]

/** `y: null` means NOT MEASURED. Never coerce to 0, never include in an average. */
export interface DataPoint {
  x: number | string
  y: number | null
  meta?: Record<string, unknown>
}

export interface Series {
  id: string
  label: string
  points: readonly DataPoint[]
  direction: Direction
  baseline?: Baseline
}

export interface EnvelopeMeta {
  unit?: string
  format: ValueFormat
  /**
   * A pass rate moving 80 → 85 is +5 PERCENTAGE POINTS, not +5 percent. Both framings
   * are defensible; mixing them in one column is not (PLAN §8.6).
   */
  deltaFormat: "absolute" | "percent" | "percentage-points"
  precision: number
  xType: "time" | "category" | "linear"
  /** Money only. Absent means nominal, which the UI must then label. */
  currency?: {
    reporting: string
    basis: "constant" | "nominal"
    fxAsOf?: string
  }
  period: PeriodRef
  comparison?: { period: PeriodRef; label: string }
  /** Set when the server downsampled; drives a "showing N of M" note. */
  sampled?: { from: number; to: number }
  asOf: string
}

export interface DataEnvelope {
  series: readonly Series[]
  meta: EnvelopeMeta
}
