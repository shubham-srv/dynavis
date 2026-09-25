/**
 * Series budgeting.
 *
 * "A ninth series is never a generated hue" is a data rule, not a drawing rule
 * (PLAN §11.4), so it lives here where it can be tested directly. Recharts renders
 * nothing in jsdom — no layout means no size means no marks — so asserting this through
 * the DOM would assert on an empty string.
 */

export interface SeriesRow {
  id: string
  label: string
  value: number | null
  vsBaseline?: number | null
}

export const OTHER_ID = "__other"

/**
 * Keep the top `cap` rows and fold the rest into a single "Other".
 *
 * Only folds when at least two rows would be collapsed: an "Other (1)" is strictly
 * worse than naming the one thing it hides.
 *
 * "Other" carries no `vsBaseline`, because a mean of unlike things has no defensible
 * comparison — it is there for magnitude context, not judgement.
 */
export function foldToOther(
  rows: readonly SeriesRow[],
  cap: number
): SeriesRow[] {
  const measured = rows.filter(
    (row): row is SeriesRow & { value: number } => row.value !== null
  )
  const sorted = [...measured].sort((a, b) => b.value - a.value)

  if (cap <= 0 || sorted.length <= cap + 1) return sorted

  const shown = sorted.slice(0, cap)
  const rest = sorted.slice(cap)

  return [
    ...shown,
    {
      id: OTHER_ID,
      label: `Other (${rest.length})`,
      value: rest.reduce((sum, row) => sum + row.value, 0) / rest.length,
      vsBaseline: null,
    },
  ]
}
