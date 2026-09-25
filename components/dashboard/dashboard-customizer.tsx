"use client"

import { Pencil, RotateCcw, SlidersHorizontal } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

import { DashboardGrid } from "@/components/dashboard/dashboard-grid"
import { WidgetPicker } from "@/components/dashboard/widget-picker"
import { useDashboardPrefs } from "@/hooks/use-dashboard-prefs"
import type { WidgetDatum } from "@/lib/data/widget-data"
import type { PrefsRepository } from "@/lib/prefs/types"
import { WIDGETS, widgetById } from "@/lib/registry/registry"
import type { ScopeRef } from "@/lib/scope/types"

/**
 * The customisable dashboard.
 *
 * Owns preferences and wires them to the grid, the picker and the announcements.
 *
 * **Edit mode is a distinct mode**, not an always-on affordance. Move and remove
 * controls only exist while editing, which stops a mis-tap from rearranging someone's
 * dashboard — a real complaint about the board this replaces (PLAN §10).
 */

export function DashboardCustomizer({
  scope,
  level,
  role,
  defaults,
  data,
  repository,
}: {
  scope: ScopeRef
  level: string
  role: string
  defaults: readonly string[]
  /** Data for every widget valid here, so adding one needs no round trip. */
  data: Record<string, WidgetDatum>
  repository?: PrefsRepository
}) {
  const [editing, setEditing] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const titleOf = useCallback((widgetId: string) => {
    try {
      return widgetById(widgetId).title
    } catch {
      return widgetId
    }
  }, [])

  const widgetExists = useCallback(
    (widgetId: string) => Object.hasOwn(data, widgetId),
    [data]
  )

  const { prefs, dispatch, announcement, undo, dismissUndo } =
    useDashboardPrefs({
      role,
      defaults,
      titleOf,
      widgetExists,
      repository,
    })

  const widgets = useMemo(
    () =>
      prefs.widgets
        .filter((entry) => data[entry.id])
        .map((entry) => ({ widgetId: entry.id, datum: data[entry.id] })),
    [prefs.widgets, data]
  )

  const available = useMemo(
    () => WIDGETS.filter((widget) => Object.hasOwn(data, widget.id)),
    [data]
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          Choose metrics
        </button>

        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          aria-pressed={editing}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          <Pencil aria-hidden className="size-4" />
          {editing ? "Done arranging" : "Arrange"}
        </button>

        {editing ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "reset", defaults })}
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <RotateCcw aria-hidden className="size-4" />
            Reset to default
          </button>
        ) : null}
      </div>

      {/*
        Adding, removing and reordering all change the page without moving focus, so
        they are silent to a screen reader unless announced (WCAG 4.1.3, PLAN §10).
      */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {undo ? (
        <div
          role="status"
          className="flex min-h-11 flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <span>{undo.label}.</span>
          <button
            type="button"
            onClick={undo.run}
            className="rounded-md font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={dismissUndo}
            className="ml-auto text-muted-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <DashboardGrid
        widgets={widgets}
        scope={scope}
        onMoveUp={
          editing
            ? (widgetId) =>
                dispatch({ type: "move", widgetId, direction: "up" })
            : undefined
        }
        onMoveDown={
          editing
            ? (widgetId) =>
                dispatch({ type: "move", widgetId, direction: "down" })
            : undefined
        }
        onRemove={
          editing
            ? (widgetId) => dispatch({ type: "remove", widgetId })
            : undefined
        }
      />

      <WidgetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        widgets={available}
        selectedIds={prefs.widgets.map((entry) => entry.id)}
        level={level}
        onToggle={(widgetId, next) =>
          dispatch(
            next ? { type: "add", widgetId } : { type: "remove", widgetId }
          )
        }
      />
    </div>
  )
}
