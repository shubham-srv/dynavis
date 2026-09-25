import type { ValueFormat } from "@/lib/data/envelope"
import type { WaterfallStep } from "@/lib/focus/breakdown"
import { formatValue } from "@/lib/viz/format"

/**
 * Where a composite number came from.
 *
 * Hand-built rather than a charting library: a waterfall of four rows needs no axes, no
 * legend and no hover layer, and Recharts has no waterfall primitive anyway — it would
 * have to be faked with transparent stacked bars. Four flex rows are clearer, lighter,
 * and keep the values as real text a screen reader reads without a parallel table.
 *
 * Revenue is a bar from the baseline; each cost is a bar hanging from the running total,
 * so the shape shows which line moved.
 */
export function Waterfall({
  steps,
  format,
  currency,
  label,
}: {
  steps: readonly WaterfallStep[]
  format: ValueFormat
  currency?: string
  label: string
}) {
  const measured = steps.filter(
    (step): step is WaterfallStep & { value: number; cumulative: number } =>
      step.value !== null && step.cumulative !== null
  )
  if (measured.length !== steps.length || measured.length === 0) return null

  // Scale against the largest absolute magnitude anywhere in the chart, so bar lengths
  // are comparable across steps.
  const peak = Math.max(
    ...measured.map((step) => Math.abs(step.value)),
    ...measured.map((step) => Math.abs(step.cumulative))
  )
  const width = (value: number) => `${Math.min((Math.abs(value) / peak) * 100, 100)}%`

  const fmt = (value: number) =>
    formatValue(value, { format, precision: 0, currency, compact: true })

  return (
    <figure aria-label={label} className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1">
        {measured.map((step, index) => {
          const isTotalDriver = step.sign === 1
          return (
            <li
              key={step.label}
              className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-sm"
            >
              <span className="truncate text-muted-foreground">{step.label}</span>

              <span className="relative h-5 overflow-hidden rounded bg-muted/50">
                <span
                  aria-hidden
                  className="absolute inset-y-0 rounded"
                  style={{
                    width: width(step.value),
                    // Offset each cost so it hangs off the running total, which is what
                    // makes the shape read as a waterfall rather than a bar chart.
                    left: isTotalDriver
                      ? 0
                      : width(measured[index - 1]?.cumulative ?? 0),
                    backgroundColor: isTotalDriver
                      ? "var(--chart-1)"
                      : "var(--chart-8)",
                  }}
                />
              </span>

              <span className="tabular-nums">
                <span aria-hidden>{step.sign === 1 ? "+" : "−"}</span>
                {fmt(step.value)}
                <span className="sr-only">
                  {step.sign === 1 ? " added" : " subtracted"}, running total{" "}
                  {fmt(step.cumulative)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <figcaption className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-1 text-sm font-medium">
        <span>Contribution</span>
        <span className="tabular-nums">
          {fmt(measured.at(-1)!.cumulative)}
        </span>
      </figcaption>
    </figure>
  )
}
