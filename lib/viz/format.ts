import type { ValueFormat } from "@/lib/data/envelope"
import type { DeltaFormat } from "@/lib/kpi/types"

/**
 * Turning numbers into text people will act on.
 *
 * The delta rules here are the ones a numerate client checks in the first five minutes
 * of a demo (PLAN §8.6): a pass rate moving 80% → 85% is **+5 percentage points**, not
 * +5%, and a 3-student school going 2/3 → 3/3 is not a "+33pp improvement".
 */

/** What an unmeasured value looks like. Never "0", never blank (PLAN §12.3). */
export const NOT_MEASURED = "—"

export interface FormatOptions {
  format: ValueFormat
  precision?: number
  unit?: string
  /** ISO currency code; required when `format` is "currency". */
  currency?: string
  locale?: string
  /** Abbreviate large magnitudes: 1.2M, 847K. Used below the `standard` variant. */
  compact?: boolean
}

export function formatValue(
  value: number | null | undefined,
  options: FormatOptions
): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return NOT_MEASURED

  const {
    format,
    precision = 0,
    currency,
    locale = "en",
    compact = false,
  } = options

  switch (format) {
    case "percent":
      // Stored as a fraction. Intl's "percent" style does the ×100 itself.
      return new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(value)

    case "currency":
      if (!currency)
        throw new TypeError(
          'formatValue: "currency" format requires a currency code'
        )
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        notation: compact ? "compact" : "standard",
        minimumFractionDigits: compact ? 0 : precision,
        maximumFractionDigits: compact ? 1 : precision,
      }).format(value)

    case "ratio":
      return `${round(value, precision)}:1`

    case "duration":
      return `${round(value, precision)}${options.unit ?? "d"}`

    case "number":
    default:
      return new Intl.NumberFormat(locale, {
        notation: compact ? "compact" : "standard",
        minimumFractionDigits: compact ? 0 : precision,
        maximumFractionDigits: compact ? 1 : precision,
      }).format(value)
  }
}

function round(value: number, precision: number): string {
  return value.toFixed(precision)
}

/**
 * The change between a value and its baseline, in *display* units.
 *
 * Returning display units rather than raw difference is what keeps the percentage-point
 * bug out of every call site: the ×100 happens once, here, driven by the KPI's declared
 * `deltaFormat`.
 *
 * Returns `null` when either side is unmeasured, or when a relative change is being
 * asked for against a zero baseline — "infinitely better than nothing" is not a fact.
 */
export function computeDelta(
  current: number | null | undefined,
  baseline: number | null | undefined,
  deltaFormat: DeltaFormat
): number | null {
  if (current === null || current === undefined || !Number.isFinite(current))
    return null
  if (baseline === null || baseline === undefined || !Number.isFinite(baseline))
    return null

  const difference = current - baseline
  switch (deltaFormat) {
    case "absolute":
      return difference
    case "percentage-points":
      return difference * 100
    case "percent":
      if (baseline === 0) return null
      return (difference / Math.abs(baseline)) * 100
    default: {
      const exhaustive: never = deltaFormat
      throw new TypeError(`unknown delta format: ${String(exhaustive)}`)
    }
  }
}

export interface DeltaFormatOptions {
  deltaFormat: DeltaFormat
  precision?: number
  locale?: string
  /** For `absolute` deltas on money or counts. */
  valueFormat?: ValueFormat
  currency?: string
  compact?: boolean
}

/** Render a delta with an explicit sign and the right unit. */
export function formatDelta(
  delta: number | null,
  options: DeltaFormatOptions
): string {
  if (delta === null || !Number.isFinite(delta)) return NOT_MEASURED

  const { deltaFormat, precision = 1, locale = "en" } = options
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±"
  const magnitude = Math.abs(delta)

  if (deltaFormat === "percentage-points")
    return `${sign}${magnitude.toFixed(precision)}pp`
  if (deltaFormat === "percent")
    return `${sign}${magnitude.toFixed(precision)}%`

  return `${sign}${formatValue(magnitude, {
    format: options.valueFormat ?? "number",
    precision: options.valueFormat === "currency" ? 0 : precision,
    currency: options.currency,
    locale,
    compact: options.compact,
  })}`
}

/**
 * Is this delta worth showing at full strength?
 *
 * A three-student cohort moving from 2 to 3 is "+33pp" and means nothing. Below the
 * floor the UI greys the delta and shows `n` rather than hiding it — hiding looks like
 * missing data, which is a different claim (PLAN §8.6).
 */
export function isDeltaMeaningful(
  n: number | null | undefined,
  minSampleSize = 10
): boolean {
  return n !== null && n !== undefined && n >= minSampleSize
}

/**
 * Thin a tick series to the points that carry the shape: first, last and the extreme.
 *
 * Below the `standard` variant there is no room for a full axis, and rotating labels to
 * make them fit is the thing that produced the original dashboard's unreadable charts
 * (PLAN §7).
 */
export function thinTicks<T>(
  values: readonly T[],
  valueOf: (item: T) => number | null
): T[] {
  if (values.length <= 3) return [...values]

  let peakIndex = -1
  let peak = Number.NEGATIVE_INFINITY
  values.forEach((item, index) => {
    const value = valueOf(item)
    if (value !== null && Number.isFinite(value) && value > peak) {
      peak = value
      peakIndex = index
    }
  })

  const keep = new Set([0, values.length - 1])
  if (peakIndex > 0 && peakIndex < values.length - 1) keep.add(peakIndex)

  return [...keep].sort((a, b) => a - b).map((index) => values[index])
}
