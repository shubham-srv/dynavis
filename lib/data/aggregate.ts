/**
 * Aggregation that refuses to lie about missing data.
 *
 * A school opened this year has no prior-year figure; some countries do not report some
 * KPIs. `null` means *not measured* and must never be counted as zero — averaging a
 * sparse column with zeros understates it, and the understatement lands on whichever
 * region happens to report least (PLAN §12.3).
 *
 * Every aggregate carries `n`, because "82%" from 3 schools and from 30 are different
 * claims and the UI has to be able to say which it is.
 */

export interface Aggregate {
  /** `null` when nothing was measured — not 0, which would read as a real result. */
  value: number | null;
  /** How many inputs were actually measured. */
  n: number;
  /** How many were missing. `n + missing` is the population size. */
  missing: number;
}

function partition(values: readonly (number | null | undefined)[]): {
  measured: number[];
  missing: number;
} {
  const measured: number[] = [];
  let missing = 0;
  for (const value of values) {
    if (value === null || value === undefined || !Number.isFinite(value)) missing++;
    else measured.push(value);
  }
  return { measured, missing };
}

export function meanIgnoringNulls(values: readonly (number | null | undefined)[]): Aggregate {
  const { measured, missing } = partition(values);
  if (measured.length === 0) return { value: null, n: 0, missing };
  const total = measured.reduce((sum, value) => sum + value, 0);
  return { value: total / measured.length, n: measured.length, missing };
}

export function sumIgnoringNulls(values: readonly (number | null | undefined)[]): Aggregate {
  const { measured, missing } = partition(values);
  if (measured.length === 0) return { value: null, n: 0, missing };
  return { value: measured.reduce((sum, value) => sum + value, 0), n: measured.length, missing };
}

/**
 * Median of the measured values — the peer-median baseline (PLAN §8.4).
 *
 * `n` matters more here than anywhere else: a median of 3 is not a median, and the UI
 * is expected to show the count beside it.
 */
export function medianIgnoringNulls(values: readonly (number | null | undefined)[]): Aggregate {
  const { measured, missing } = partition(values);
  if (measured.length === 0) return { value: null, n: 0, missing };
  const sorted = [...measured].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { value, n: sorted.length, missing };
}

/**
 * Rank of `value` within `population`, ignoring nulls.
 *
 * `higherIsBetter: false` flips the ordering so rank 1 always means "best", whatever the
 * KPI's direction — a principal reading "3rd of 22" on cost per student must not have to
 * remember which way round that metric runs.
 *
 * Returns `null` when the value itself was never measured.
 */
export function rankWithin(
  value: number | null,
  population: readonly (number | null | undefined)[],
  higherIsBetter = true,
): { rank: number; n: number } | null {
  if (value === null || !Number.isFinite(value)) return null;
  const { measured } = partition(population);
  if (measured.length === 0) return null;
  const better = measured.filter((other) => (higherIsBetter ? other > value : other < value)).length;
  return { rank: better + 1, n: measured.length };
}
