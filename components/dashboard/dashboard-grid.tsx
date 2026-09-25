"use client"

import { ContainerSizeProvider } from "@/components/dashboard/container-size"
import { WidgetRenderer } from "@/components/dashboard/widget-renderer"
import type { WidgetDatum } from "@/lib/data/widget-data"
import type { SizeToken } from "@/lib/layout/tokens"
import { widgetById } from "@/lib/registry/registry"
import type { ScopeRef } from "@/lib/scope/types"

/**
 * The dashboard grid.
 *
 * **Layout is pure CSS; JavaScript only picks each widget's variant.**
 *
 * It began as a JS-measured layout driven by `pack()`, and that cost 0.1238 CLS against
 * a 0.05 budget: measuring before you can place anything means rendering a placeholder
 * and then swapping it, and no amount of reserving space or measuring earlier removes
 * the swap. Grid columns are a *viewport* concern, and CSS already knows the viewport
 * before the first paint — so the layout is correct with no measurement, no skeleton and
 * no shift.
 *
 * What was given up: `pack()`'s gap-filling lookahead. CSS auto-placement is exactly
 * equivalent to `pack(..., { lookahead: 0 })` — items flow in document order, so
 * occasional gaps appear where a wide widget follows a narrow one. That is a fair trade
 * for zero CLS, and it makes DOM order equal visual order equal the user's saved order
 * at *every* breakpoint, which the JS version could only guarantee at one (PLAN D4).
 *
 * `pack()` is retained and tested for the banded layout in PLAN §9, which needs real
 * lookahead within a band. Auto-placement is deliberately NOT `dense`: dense reorders
 * visually without reordering the DOM, which is the accessibility failure this whole
 * design exists to avoid.
 */

export interface GridWidget {
  widgetId: string
  datum: WidgetDatum
}

/**
 * Column spans per size token, as static class strings.
 *
 * These mirror `COL_SPAN` in lib/layout/tokens.ts and must stay in step with it —
 * asserted in dashboard-grid.test.tsx. Tailwind needs literal strings, so they cannot
 * be generated from the token table at runtime.
 *
 * Tailwind's `md` (768px) and `xl` (1280px) match BREAKPOINTS.tablet and .desktop.
 */
const SPAN_CLASS: Record<SizeToken, string> = {
  sm: "col-span-1 md:col-span-2 xl:col-span-3",
  md: "col-span-1 md:col-span-3 xl:col-span-6",
  lg: "col-span-1 md:col-span-6 xl:col-span-8",
  xl: "col-span-1 md:col-span-6 xl:col-span-12",
}

const ROW_CLASS: Record<number, string> = {
  1: "row-span-1",
  2: "row-span-2",
  3: "row-span-3",
  4: "row-span-4",
}

export function DashboardGrid({
  widgets,
  scope,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  widgets: readonly GridWidget[]
  scope: ScopeRef
  onMoveUp?: (widgetId: string) => void
  onMoveDown?: (widgetId: string) => void
  onRemove?: (widgetId: string) => void
}) {
  if (widgets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No widgets selected. Add one to get started.
      </p>
    )
  }

  return (
    <ul className="grid list-none auto-rows-[88px] grid-cols-1 gap-3 md:grid-cols-6 xl:grid-cols-12">
      {widgets.map(({ widgetId, datum }, index) => {
        const widget = widgetById(widgetId)
        // The desktop token drives the class set; the class set itself carries the
        // mobile and tablet spans.
        const { token, rowSpan } = widget.size.desktop

        return (
          <li
            key={widgetId}
            // min-w-0 here plus minmax(0, 1fr) from grid-cols-* is load-bearing:
            // without both, chart SVGs and wide tables refuse to shrink and the page
            // gains a horizontal scrollbar (PLAN §9).
            className={`min-w-0 ${SPAN_CLASS[token]} ${ROW_CLASS[rowSpan] ?? "row-span-2"}`}
          >
            {/* Each widget measures its own cell to choose its variant (PLAN D2). */}
            <ContainerSizeProvider className="h-full min-w-0">
              <WidgetRenderer
                widgetId={widgetId}
                datum={datum}
                scope={scope}
                position={{ index, total: widgets.length }}
                onMoveUp={
                  onMoveUp && index > 0 ? () => onMoveUp(widgetId) : undefined
                }
                onMoveDown={
                  onMoveDown && index < widgets.length - 1
                    ? () => onMoveDown(widgetId)
                    : undefined
                }
                onRemove={onRemove ? () => onRemove(widgetId) : undefined}
              />
            </ContainerSizeProvider>
          </li>
        )
      })}
    </ul>
  )
}

export { SPAN_CLASS }
