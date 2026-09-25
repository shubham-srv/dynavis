"use client"

import { Check, Search, X } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"

import { PILLARS, type Pillar } from "@/lib/kpi/types"
import { isValidAtLevel, unavailableReason } from "@/lib/registry/registry"
import type { WidgetDefinition } from "@/lib/registry/types"
import { cn } from "@/lib/utils"

/**
 * Choosing what appears on the dashboard.
 *
 * Grouped by pillar and showing each widget's *question* rather than just its title,
 * because the question is what makes "do I need this?" answerable — and the pillar
 * grouping is the anti-clutter mechanism made visible (PLAN §1.1, §10).
 *
 * Widgets that are meaningless at the current scope are shown **disabled with a
 * reason**, not hidden: a widget that silently vanishes between levels reads as a bug.
 *
 * Built on the native `<dialog>` element, which brings a real focus trap, Escape to
 * close and inert background for free. A hand-rolled modal would be more code and worse.
 */

const SOFT_CAP = 8

export function WidgetPicker({
  open,
  onClose,
  widgets,
  selectedIds,
  level,
  onToggle,
}: {
  open: boolean
  onClose: () => void
  widgets: readonly WidgetDefinition[]
  selectedIds: readonly string[]
  level: string
  onToggle: (widgetId: string, next: boolean) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState("")
  const searchId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = widgets.filter(
      (widget) =>
        needle === "" ||
        widget.title.toLowerCase().includes(needle) ||
        widget.question.toLowerCase().includes(needle)
    )
    return (Object.keys(PILLARS) as Pillar[]).map((pillar) => ({
      pillar,
      items: matches.filter((widget) => widget.pillar === pillar),
    }))
  }, [widgets, query])

  const selected = selectedIds.length

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself, outside the panel) closes.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      aria-labelledby="picker-title"
      className="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground backdrop:bg-black/40"
    >
      <div className="flex max-h-[80vh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 id="picker-title" className="text-base font-medium">
              Choose your metrics
            </h2>
            {/* A soft cap nudges against rebuilding the clutter this project removes. */}
            <p
              className={cn(
                "mt-0.5 text-xs",
                selected > SOFT_CAP
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {selected} selected
              {selected > SOFT_CAP
                ? ` — more than ${SOFT_CAP} is usually a sign the dashboard is trying to answer too much at once.`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close metric picker"
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X aria-hidden className="size-4" />
          </button>
        </header>

        <div className="border-b border-border p-4">
          <label htmlFor={searchId} className="sr-only">
            Search metrics
          </label>
          <div className="flex items-center gap-2 rounded-md border border-border px-2">
            <Search
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or by the question it answers"
              className="min-h-11 w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {grouped.every((group) => group.items.length === 0) ? (
            <p className="text-sm text-muted-foreground">
              No metrics match “{query}”.
            </p>
          ) : null}

          {grouped.map(({ pillar, items }) =>
            items.length === 0 ? null : (
              <section key={pillar} className="mb-5 last:mb-0">
                <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {PILLARS[pillar].label}
                </h3>
                <ul className="flex flex-col">
                  {items.map((widget) => {
                    const checked = selectedIds.includes(widget.id)
                    const valid = isValidAtLevel(widget, level)
                    const reason = unavailableReason(widget, level)

                    return (
                      <li key={widget.id}>
                        <label
                          className={cn(
                            "flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-accent/50",
                            !valid && "cursor-not-allowed opacity-60"
                          )}
                        >
                          <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-border">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!valid}
                              onChange={(event) =>
                                onToggle(widget.id, event.target.checked)
                              }
                              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                            />
                            {checked ? (
                              <Check aria-hidden className="size-3.5" />
                            ) : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm">
                              {widget.title}
                            </span>
                            {/* The question, not a description — it is what makes
                                "do I need this?" answerable (PLAN §1.1). */}
                            <span className="block text-xs text-muted-foreground">
                              {reason ?? widget.question}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          )}
        </div>
      </div>
    </dialog>
  )
}
