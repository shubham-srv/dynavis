/**
 * Which form a widget takes at a given size.
 *
 * The core bet of the whole product (PLAN D1): shrinking a chart is unwinnable, so a
 * widget *substitutes* a different form instead. A scatter plot at 320px becomes a
 * sentence and a button, not an illegible scatter plot.
 *
 * The input is the widget's own container width, never the viewport — a widget that is
 * one third of a desktop and full width on a phone is the same number of pixels in both
 * (PLAN D2).
 */

export type Variant = "micro" | "compact" | "standard" | "expanded"

/** Narrowest first. The thresholds the §7 responsive table is written against. */
export const VARIANTS: readonly Variant[] = [
  "micro",
  "compact",
  "standard",
  "expanded",
]

/**
 * Every threshold is a multiple of `WIDTH_QUANTUM`, and that is load-bearing rather
 * than tidy: measured widths are quantised before they reach this table, so a threshold
 * that fell mid-bucket would move. At 340 a container measuring exactly 340px quantised
 * to 336 and resolved one variant too narrow.
 */
export const VARIANT_MIN_WIDTH: Record<Variant, number> = {
  micro: 0,
  compact: 336,
  standard: 560,
  expanded: 896,
}

/**
 * Pick the richest variant that fits, restricted to those the widget implements.
 *
 * When nothing fits — a widget that only implements `expanded`, rendered at 320px — the
 * narrowest *supported* variant is returned rather than throwing. A widget that is too
 * cramped is a layout bug to see and fix; a crash is a blank dashboard.
 */
export function resolveVariant(
  width: number,
  supported: readonly Variant[]
): Variant {
  if (supported.length === 0) {
    throw new RangeError("a widget must support at least one variant")
  }

  const allowed = VARIANTS.filter((variant) => supported.includes(variant))
  if (allowed.length === 0) {
    throw new RangeError(`no known variants in [${supported.join(", ")}]`)
  }

  // A non-finite width means "we have not measured yet" — start at the narrowest and
  // let the first real measurement widen it. Never guess large: guessing large renders
  // an expanded chart into a phone for one frame.
  const effective = Number.isFinite(width) && width > 0 ? width : 0

  let chosen = allowed[0]
  for (const variant of allowed) {
    if (effective >= VARIANT_MIN_WIDTH[variant]) chosen = variant
  }
  return chosen
}

/** Is this variant at or below `limit` in richness? Useful for "compact or narrower" branches. */
export function isAtMost(variant: Variant, limit: Variant): boolean {
  return VARIANTS.indexOf(variant) <= VARIANTS.indexOf(limit)
}

/**
 * Quantise a measured width before it reaches variant resolution.
 *
 * A window drag emits hundreds of ResizeObserver callbacks; without bucketing, every one
 * of them re-renders every chart and INP dies. This is the single biggest performance
 * risk in the architecture (PLAN §15).
 */
export const WIDTH_QUANTUM = 8

export function quantiseWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 0
  return Math.floor(width / WIDTH_QUANTUM) * WIDTH_QUANTUM
}
