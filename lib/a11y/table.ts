import type { DataEnvelope } from "@/lib/data/envelope";
import { formatValue } from "@/lib/viz/format";

/**
 * The tabular form of a chart.
 *
 * Every widget ships one, and it is the highest-leverage decision in the accessibility
 * plan because it solves four problems at once (PLAN §5.3, D8):
 *
 *   1. screen reader access to canvas charts, which are otherwise a black hole
 *   2. the mobile fallback at the `micro` variant — already built
 *   3. the assertion surface for tests: assert on the table, not on SVG paths
 *   4. CSV export, essentially free
 */

export interface DataTable {
  caption: string;
  columns: readonly string[];
  /** `null` means not measured, and renders as "—" rather than "0" or blank. */
  rows: readonly (readonly (string | number | null)[])[];
}

export function envelopeToTable(envelope: DataEnvelope, caption: string): DataTable {
  const { series, meta } = envelope;

  // Every x value across every series, in first-seen order — series may be sparse, and
  // a missing point must become a null cell rather than shifting the column.
  const axis: (string | number)[] = [];
  const seen = new Set<string>();
  for (const one of series) {
    for (const point of one.points) {
      const key = String(point.x);
      if (!seen.has(key)) {
        seen.add(key);
        axis.push(point.x);
      }
    }
  }

  const bySeries = series.map((one) => {
    const lookup = new Map(one.points.map((point) => [String(point.x), point.y]));
    return { label: one.label, lookup };
  });

  return {
    caption,
    columns: [axisLabel(meta.xType), ...bySeries.map((one) => one.label)],
    rows: axis.map((x) => [
      String(x),
      ...bySeries.map(({ lookup }) => {
        const value = lookup.get(String(x));
        return value === undefined || value === null ? null : value;
      }),
    ]),
  };
}

function axisLabel(xType: DataEnvelope["meta"]["xType"]): string {
  return xType === "time" ? "Period" : xType === "category" ? "Category" : "Value";
}

/**
 * RFC 4180 CSV.
 *
 * Nulls become empty cells, not "—": a spreadsheet should see a blank it can treat as
 * missing, not a character it will read as text.
 */
export function tableToCsv(table: DataTable): string {
  const escape = (cell: string | number | null): string => {
    if (cell === null) return "";
    const text = String(cell);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  return [table.columns.map(escape).join(","), ...table.rows.map((row) => row.map(escape).join(","))].join(
    "\r\n",
  );
}

/**
 * A one-sentence summary of what the chart shows.
 *
 * This is what a screen reader hears instead of 400 path elements, and it is also the
 * chart's `aria-label`. It states the takeaway, not the geometry.
 */
export function summariseSeries(
  label: string,
  points: readonly { x: string | number; y: number | null }[],
  format: Parameters<typeof formatValue>[1],
): string {
  const measured = points.filter((point) => point.y !== null && Number.isFinite(point.y));
  if (measured.length === 0) return `${label}: no data recorded.`;
  if (measured.length === 1) {
    return `${label}: ${formatValue(measured[0].y, format)} at ${measured[0].x}.`;
  }

  const first = measured[0];
  const last = measured.at(-1)!;
  const direction = last.y! > first.y! ? "rose" : last.y! < first.y! ? "fell" : "was flat";
  const peak = measured.reduce((best, point) => (point.y! > best.y! ? point : best), measured[0]);

  const missing = points.length - measured.length;
  const caveat = missing > 0 ? ` ${missing} period${missing === 1 ? "" : "s"} not measured.` : "";

  return (
    `${label} ${direction} from ${formatValue(first.y, format)} at ${first.x} ` +
    `to ${formatValue(last.y, format)} at ${last.x}, peaking at ${formatValue(peak.y, format)} ` +
    `at ${peak.x}.${caveat}`
  );
}
