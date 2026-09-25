/**
 * The chart palette, as code.
 *
 * The rules in PLAN §11 are only worth writing down if something enforces them, so
 * they live here as functions that throw rather than as comments that don't. The hex
 * values themselves live in `app/globals.css`; `npm run validate:palette` measures
 * those, and these helpers only ever reference them by token.
 */

/** Categorical slots available. A 9th series folds into "Other" or becomes small multiples. */
export const SERIES_SLOT_COUNT = 8

/**
 * Maximum series before identity stops being readable, by how the reader compares them.
 *
 * `adjacent` — a legend orders the series, so only neighbouring pairs must separate.
 * `all` — scatter and bubble have no adjacency: any two series can land side by side,
 *   so every pair must separate. Measured at 3 (4 fails on orange↔yellow). PLAN §11.2.
 */
export const SERIES_BUDGET = { adjacent: SERIES_SLOT_COUNT, all: 3 } as const
export type SeriesComparison = keyof typeof SERIES_BUDGET

/**
 * CSS variable for categorical slot `index` (0-based).
 *
 * Deliberately throws past the last slot instead of wrapping: a cycled palette gives
 * two series the same colour, which reads as "these are the same thing".
 */
export function seriesVar(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(
      `series index must be a non-negative integer, got ${index}`
    )
  }
  if (index >= SERIES_SLOT_COUNT) {
    throw new RangeError(
      `series index ${index} exceeds the ${SERIES_SLOT_COUNT} categorical slots. ` +
        `Fold the remainder into "Other" or use small multiples — do not cycle the palette.`
    )
  }
  return `var(--chart-${index + 1})`
}

/** Guard a chart's series count before render. Throws with the remedy, not just the rule. */
export function assertSeriesBudget(
  count: number,
  comparison: SeriesComparison
): void {
  const budget = SERIES_BUDGET[comparison]
  if (count > budget) {
    throw new RangeError(
      `${count} series exceeds the ${comparison}-comparison budget of ${budget}. ` +
        (comparison === "all"
          ? "Scatter and bubble compare every pair; facet into small multiples instead."
          : 'Fold the remainder into "Other".')
    )
  }
}

/**
 * Below this normalised distance from the baseline, a cell is not tinted at all.
 *
 * Not a style preference: a tint faint enough to keep text readable cannot also carry
 * an above/below distinction — the faintest level measured ΔE 8.7 against a floor of
 * 15. Rather than ship a colour that implies a signal it can't deliver, near-baseline
 * cells stay untinted and the signed delta carries the (small) story. PLAN §11.3.
 */
export const MATRIX_DEADBAND = 0.15

/** Distance at which a cell escalates from the first tint level to the second. */
export const MATRIX_LEVEL_2 = 0.5

export type MatrixTint = "pos-1" | "pos-2" | "neg-1" | "neg-2" | null

/**
 * Bucket a direction-aware, normalised distance-from-baseline into a tint.
 *
 * `vsBaseline` is expected in [-1, 1] and already direction-adjusted — positive always
 * means "good", whatever the KPI's direction. Out-of-range input is clamped rather than
 * rejected, because one outlier must not be allowed to crash a matrix.
 *
 * `null` in (not measured) is `null` out: absence of data is never a colour.
 */
export function matrixTint(vsBaseline: number | null): MatrixTint {
  if (vsBaseline === null || !Number.isFinite(vsBaseline)) return null
  const v = Math.max(-1, Math.min(1, vsBaseline))
  const magnitude = Math.abs(v)
  if (magnitude < MATRIX_DEADBAND) return null
  const level = magnitude >= MATRIX_LEVEL_2 ? 2 : 1
  return `${v > 0 ? "pos" : "neg"}-${level}` as MatrixTint
}

/** CSS variable for a tint, or `null` for "leave the cell on the card surface". */
export function matrixTintVar(tint: MatrixTint): string | null {
  return tint === null ? null : `var(--matrix-${tint})`
}

/**
 * The glyph that carries direction when colour cannot — CVD, print, forced-colors, and
 * every cell inside the deadband. Mandatory alongside the tint, never instead of it.
 */
export function directionGlyph(
  vsBaseline: number | null
): "▲" | "▼" | "●" | "—" {
  if (vsBaseline === null || !Number.isFinite(vsBaseline)) return "—"
  if (Math.abs(vsBaseline) < MATRIX_DEADBAND) return "●"
  return vsBaseline > 0 ? "▲" : "▼"
}
