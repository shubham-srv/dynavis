/**
 * The grid a dashboard is laid out on.
 *
 * Widgets declare a *size token*, never pixel coordinates. That is what keeps saved
 * preferences to an ordered list of ids and makes the layout solver a pure function
 * (PLAN D3, §9).
 */

export const BREAKPOINTS = { mobile: 0, tablet: 768, desktop: 1280 } as const
export type Breakpoint = keyof typeof BREAKPOINTS

export const ORDERED_BREAKPOINTS: readonly Breakpoint[] = [
  "mobile",
  "tablet",
  "desktop",
]

/** Mobile is one column on purpose: it kills a whole class of chart-squishing. */
export const GRID_COLUMNS: Record<Breakpoint, number> = {
  mobile: 1,
  tablet: 6,
  desktop: 12,
}

export type SizeToken = "sm" | "md" | "lg" | "xl"

export const COL_SPAN: Record<Breakpoint, Record<SizeToken, number>> = {
  mobile: { sm: 1, md: 1, lg: 1, xl: 1 },
  tablet: { sm: 2, md: 3, lg: 6, xl: 6 },
  desktop: { sm: 3, md: 6, lg: 8, xl: 12 },
}

/** Row height unit in px. A widget declares how many rows it spans. */
export const ROW_UNIT = 88

export function breakpointFor(viewportWidth: number): Breakpoint {
  if (viewportWidth >= BREAKPOINTS.desktop) return "desktop"
  if (viewportWidth >= BREAKPOINTS.tablet) return "tablet"
  return "mobile"
}

export function colSpan(token: SizeToken, breakpoint: Breakpoint): number {
  return COL_SPAN[breakpoint][token]
}
