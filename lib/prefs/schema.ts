import type { BaselineKind } from "@/lib/data/envelope"
import type { SizeToken } from "@/lib/layout/tokens"

import type { DashboardPrefs } from "./types"

/**
 * Validating what comes back from storage.
 *
 * Saved preferences are the one piece of state that outlives a deploy, so they are the
 * one piece that will eventually be the wrong shape: an older schema, a widget that no
 * longer exists, or something a user edited by hand in devtools. All three must degrade
 * to a usable dashboard rather than a crash (PLAN §5.5).
 *
 * **Hand-written rather than zod, and measured.** This parsing runs in the browser, so
 * the validator ships to every user: zod v4 put 141KB into the client bundle for a
 * four-field schema, against a 220KB budget for the whole page (PLAN §15). That is a bad
 * trade for validation this small, and the behaviour below is pinned by the same tests
 * the zod version passed. If the shape ever grows to justify a library, the tests make
 * the swap safe.
 */

const SIZE_TOKENS: readonly string[] = ["sm", "md", "lg", "xl"]
const BASELINE_KINDS: readonly string[] = [
  "target",
  "prior-period",
  "peer-median",
  "none",
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function parseWidgets(value: unknown): DashboardPrefs["widgets"] | null {
  if (!Array.isArray(value)) return null
  const widgets: DashboardPrefs["widgets"] = []

  for (const entry of value) {
    if (!isRecord(entry) || !nonEmptyString(entry.id)) return null

    const override = entry.sizeOverride
    if (override !== undefined && !SIZE_TOKENS.includes(override as string)) {
      return null
    }
    widgets.push(
      override === undefined
        ? { id: entry.id }
        : { id: entry.id, sizeOverride: override as SizeToken }
    )
  }
  return widgets
}

type MatrixResult =
  { ok: true; value: DashboardPrefs["matrix"] } | { ok: false }

function parseMatrix(value: unknown): MatrixResult {
  if (value === undefined) return { ok: true, value: undefined }
  if (!isRecord(value)) return { ok: false }

  const { visibleKpis, baselineMode } = value

  if (visibleKpis !== undefined) {
    if (!Array.isArray(visibleKpis) || !visibleKpis.every(nonEmptyString)) {
      return { ok: false }
    }
  }
  if (
    baselineMode !== undefined &&
    !BASELINE_KINDS.includes(baselineMode as string)
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    value: {
      ...(visibleKpis === undefined
        ? {}
        : { visibleKpis: visibleKpis as string[] }),
      ...(baselineMode === undefined
        ? {}
        : { baselineMode: baselineMode as BaselineKind }),
    },
  }
}

/**
 * Parse and migrate stored preferences.
 *
 * Returns `null` for anything unrecoverable, which callers turn into "fall back to the
 * role's defaults". Never throws: a corrupt localStorage entry must not be able to make
 * the dashboard un-loadable, and there is no way for the user to clear it if it does.
 */
export function parsePrefs(raw: unknown, role: string): DashboardPrefs | null {
  if (!isRecord(raw)) return null

  // v1 predates role-scoped dashboards: it stored a bare array of widget ids and no
  // role at all, so the current role is adopted.
  if (raw.version === 1) {
    if (!Array.isArray(raw.widgets) || !raw.widgets.every(nonEmptyString)) {
      return null
    }
    return {
      version: 2,
      role,
      widgets: (raw.widgets as string[]).map((id) => ({ id })),
    }
  }

  if (raw.version !== 2) return null
  if (!nonEmptyString(raw.role)) return null

  const widgets = parseWidgets(raw.widgets)
  if (widgets === null) return null

  const matrix = parseMatrix(raw.matrix)
  if (!matrix.ok) return null

  return {
    version: 2,
    role: raw.role,
    widgets,
    ...(matrix.value === undefined ? {} : { matrix: matrix.value }),
  }
}

/**
 * Drop widgets that no longer exist in the registry.
 *
 * A widget can be renamed or retired between deploys, and a saved id pointing at nothing
 * would throw on the next render. Silently dropping is right here: the alternative is an
 * error page for a dashboard the user can no longer reach to fix.
 */
export function pruneUnknownWidgets(
  prefs: DashboardPrefs,
  exists: (widgetId: string) => boolean
): DashboardPrefs {
  const widgets = prefs.widgets.filter((widget) => exists(widget.id))
  return widgets.length === prefs.widgets.length ? prefs : { ...prefs, widgets }
}
