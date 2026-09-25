"use client"

import { Download, Table2, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { DataTableView } from "@/components/dashboard/data-table"
import { RankingBar, TrendChart } from "@/components/charts/lazy"
import { Waterfall } from "@/components/charts/waterfall"
import { baselineLabel } from "@/lib/baseline/resolve"
import type { WidgetDatum } from "@/lib/data/widget-data"
import {
  BREAKDOWN_LABELS,
  biggestMover,
  type WaterfallStep,
} from "@/lib/focus/breakdown"
import type { KpiDefinition } from "@/lib/kpi/types"
import type { Breakdown } from "@/lib/registry/types"
import { tableToCsv, type DataTable } from "@/lib/a11y/table"
import { cn } from "@/lib/utils"
import { formatDelta, formatValue } from "@/lib/viz/format"

/**
 * One KPI, given the whole viewport.
 *
 * The escape hatch that makes the responsive strategy work (PLAN §7): a dense chart is
 * never asked to be legible in a phone-sized card — the card shows the headline and
 * offers this instead.
 *
 * The three axes are the two meanings of "drill into a complex KPI" plus time
 * (PLAN §6.6). The axis lives in the query string, so a particular view is shareable.
 */
export function FocusView({
  kpi,
  datum,
  breakdown,
  offered,
  waterfall,
  table,
  summary,
  scopeLabel,
  widgetId,
  scopePath,
  roleParam,
}: {
  kpi: KpiDefinition
  datum: WidgetDatum
  breakdown: Breakdown
  offered: readonly Breakdown[]
  waterfall: WaterfallStep[] | null
  table: DataTable
  summary: string
  scopeLabel: string
  widgetId: string
  /** Scope ids joined by "/", empty at the root. */
  scopePath: string
  roleParam?: string
}) {
  /*
   * Hrefs are assembled here from plain strings rather than passed in as functions:
   * a function cannot cross the server/client boundary, and passing one produced a 500
   * rather than a type error.
   */
  const suffix = scopePath ? `/${scopePath}` : ""
  const role = roleParam ? `&role=${encodeURIComponent(roleParam)}` : ""
  const closeHref = `/dashboard${suffix}${
    roleParam ? `?role=${encodeURIComponent(roleParam)}` : ""
  }#w-${widgetId}`
  const hrefForBreakdown = (axis: Breakdown) =>
    `/focus/${widgetId}${suffix}?by=${axis}${role}`
  const hrefForChild = (childId: string) =>
    `/focus/${widgetId}${suffix}/${childId}?by=${breakdown}${role}`

  const router = useRouter()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [showTable, setShowTable] = useState(false)

  // Focus the heading on arrival: a route change alone leaves focus on <body>, so a
  // keyboard or screen reader user would have to tab in from the top of the document.
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // Escape leaves, matching the close button and the back button (PLAN §6.5).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(closeHref)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [router, closeHref])

  const downloadCsv = useCallback(() => {
    const blob = new Blob([tableToCsv(table)], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${kpi.id}-${datum.scopeId}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [table, kpi.id, datum.scopeId])

  const currency = kpi.money ? "USD" : undefined
  const headline = formatValue(datum.value, {
    format: kpi.format,
    precision: kpi.precision,
    currency,
  })
  const delta = formatDelta(datum.delta, {
    deltaFormat: kpi.deltaFormat,
    precision: 1,
    valueFormat: kpi.format,
    currency,
    compact: true,
  })
  const mover = waterfall ? biggestMover(waterfall) : null

  return (
    <div className="flex min-h-svh flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none"
          >
            {kpi.label}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {scopeLabel} · {kpi.question}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            aria-pressed={showTable}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            <Table2 aria-hidden className="size-4" />
            {showTable ? "Hide table" : "View as table"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Download aria-hidden className="size-4" />
            CSV
          </button>
          <Link
            href={closeHref}
            aria-label="Close and return to the dashboard"
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X aria-hidden className="size-4" />
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-baseline gap-3">
        <output className="text-4xl font-semibold tabular-nums">
          {headline}
        </output>
        {datum.delta === null ? null : (
          <span className="text-sm text-muted-foreground tabular-nums">
            {delta} {baselineLabel(datum.baseline)}
          </span>
        )}
      </div>

      {/* The plain-language takeaway, which is also what a screen reader hears. */}
      <p className="max-w-prose text-sm text-muted-foreground">{summary}</p>

      {offered.length > 1 ? (
        <nav aria-label="Breakdown" className="flex flex-wrap gap-1">
          {offered.map((axis) => (
            <Link
              key={axis}
              href={hrefForBreakdown(axis)}
              aria-current={axis === breakdown ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                axis === breakdown
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
            >
              {BREAKDOWN_LABELS[axis]}
            </Link>
          ))}
        </nav>
      ) : null}

      <section
        aria-label={BREAKDOWN_LABELS[breakdown]}
        className="min-w-0 flex-1"
      >
        {breakdown === "component" && waterfall ? (
          <div className="flex flex-col gap-3">
            <Waterfall
              steps={waterfall}
              format="currency"
              currency="USD"
              label={`${kpi.label} by component`}
            />
            {mover ? (
              <p className="text-sm text-muted-foreground">
                Largest cost line:{" "}
                <strong className="text-foreground">{mover.label}</strong>.
              </p>
            ) : null}
          </div>
        ) : null}

        {breakdown === "component" && !waterfall ? (
          <p className="text-sm text-muted-foreground">
            {/* Omitting an unmeasured input would make an incomplete picture look
                complete (PLAN §12.3). */}
            One or more inputs were not measured for this period, so the
            breakdown cannot be shown.
          </p>
        ) : null}

        {breakdown === "location" ? (
          <div className="flex flex-col gap-3">
            <RankingBar
              data={datum.children}
              variant="expanded"
              format={kpi.format}
              precision={kpi.precision}
              currency={currency}
              label={`${kpi.label} by unit`}
            />
            <ul className="flex flex-wrap gap-2">
              {datum.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={hrefForChild(child.id)}
                    className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {child.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {breakdown === "time" ? (
          <TrendChart
            points={datum.history}
            variant="expanded"
            format={kpi.format}
            precision={kpi.precision}
            currency={currency}
            target={kpi.target}
            height={320}
            label={`${kpi.label} over time`}
          />
        ) : null}
      </section>

      {showTable ? (
        <section aria-label="Data table" className="min-w-0">
          <DataTableView table={table} />
        </section>
      ) : null}
    </div>
  )
}
