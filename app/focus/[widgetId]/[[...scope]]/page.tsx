import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/scope/breadcrumbs"
import { FocusView } from "@/components/focus/focus-view"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadWidgetDatum } from "@/lib/data/widget-data"
import {
  buildWaterfall,
  offeredBreakdowns,
  resolveBreakdown,
} from "@/lib/focus/breakdown"
import { kpiById } from "@/lib/kpi/catalog"
import { WIDGETS, widgetById } from "@/lib/registry/registry"
import { buildBreadcrumbs } from "@/lib/scope/breadcrumbs"
import { parseScopeSegments } from "@/lib/scope/path"
import { resolveScope } from "@/lib/scope/resolve"
import {
  DEFAULT_ROLE_ID,
  isAuthorisedScope,
  type Role,
  roleById,
} from "@/lib/scope/roles"

/**
 * One widget, full viewport.
 *
 * **Route shape note.** PLAN §4 sketched this as `dashboard/[[...scope]]/[widgetId]`,
 * which Next cannot express: an optional catch-all must be the final segment, so nothing
 * may nest beneath it. Inverting to `focus/[widgetId]/[[...scope]]` keeps both the widget
 * and the full scope path in the URL and stays deep-linkable, which was the actual
 * requirement (D14).
 */

type PageProps = {
  params: Promise<{ widgetId: string; scope?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const period = { kind: "academic-year" as const, id: CURRENT_ACADEMIC_YEAR }

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function resolveRole(raw: string | string[] | undefined): Role {
  try {
    return roleById(first(raw) ?? DEFAULT_ROLE_ID)
  } catch {
    return roleById(DEFAULT_ROLE_ID)
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { widgetId } = await params
  try {
    return { title: widgetById(widgetId).title }
  } catch {
    return { title: "Not found" }
  }
}

export default async function FocusPage({ params, searchParams }: PageProps) {
  const { widgetId, scope } = await params
  const query = await searchParams

  const widget = WIDGETS.find((candidate) => candidate.id === widgetId)
  if (!widget) notFound()

  const ids = parseScopeSegments(scope)
  if (ids === null) notFound()

  const resolved = resolveScope(ids, fixtureLookup)
  if (!resolved) notFound()

  const role = resolveRole(query.role)
  // The same server-side check the dashboard makes: a scope in a URL is a request, not
  // a grant, and the focus view is not a way around it (PLAN §1.4).
  if (!isAuthorisedScope(role, ids, fixtureLookup)) notFound()

  const current = resolved.at(-1)!
  const kpi = kpiById(widget.kpiId)
  const datum = loadWidgetDatum(current.id, widget.kpiId, period)

  const offered = offeredBreakdowns(kpi, datum)
  const breakdown = resolveBreakdown(first(query.by), offered)
  const waterfall = buildWaterfall(kpi, current.id, period)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <Breadcrumbs
        crumbs={buildBreadcrumbs(resolved, fixtureLookup)}
        className="mb-4"
      />
      <FocusView
        kpi={kpi}
        datum={datum}
        breakdown={breakdown}
        offered={offered}
        waterfall={waterfall}
        table={widget.a11y.table(datum, kpi)}
        summary={widget.a11y.summary(datum, kpi, resolved)}
        scopeLabel={current.label}
        widgetId={widget.id}
        scopePath={ids.join("/")}
        roleParam={first(query.role)}
      />
    </div>
  )
}
