"use client"

import { useMemo } from "react"

import {
  ContainerSizeProvider,
  useContainerWidth,
} from "@/components/dashboard/container-size"
import { WidgetRenderer } from "@/components/dashboard/widget-renderer"
import type { WidgetDatum } from "@/lib/data/widget-data"
import { pack } from "@/lib/layout/pack"
import { breakpointFor, GRID_COLUMNS, ROW_UNIT } from "@/lib/layout/tokens"
import { widgetById } from "@/lib/registry/registry"
import type { ScopeRef } from "@/lib/scope/types"
import { resolveVariant, type Variant } from "@/lib/viz/variants"

/**
 * The dashboard grid.
 *
 * Renders the solver's output **in its order**, so the DOM matches what is on screen
 * and tab order matches reading order (PLAN D4). `grid-auto-flow: dense` would do the
 * packing in CSS for free and break exactly that, which is why it is not used.
 */

export interface GridWidget {
  widgetId: string
  datum: WidgetDatum
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
  return (
    <ContainerSizeProvider className="min-w-0">
      <GridBody
        widgets={widgets}
        scope={scope}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={onRemove}
      />
    </ContainerSizeProvider>
  )
}

function GridBody({
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
  const { width, measured } = useContainerWidth()
  const breakpoint = breakpointFor(width)

  const packed = useMemo(
    () =>
      pack(
        widgets.map(({ widgetId }) => {
          const widget = widgetById(widgetId)
          return {
            id: widgetId,
            size: widget.size[breakpoint].token,
            rowSpan: widget.size[breakpoint].rowSpan,
          }
        }),
        breakpoint
      ),
    [widgets, breakpoint]
  )

  const byId = useMemo(
    () => new Map(widgets.map((entry) => [entry.widgetId, entry])),
    [widgets]
  )

  if (widgets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No widgets selected. Add one to get started.
      </p>
    )
  }

  // Before the first measurement, render nothing rather than laying a 12-column grid
  // into a phone for a frame.
  if (!measured) {
    return (
      <div className="h-64 animate-pulse rounded-lg bg-muted" aria-hidden />
    )
  }

  return (
    <ul
      className="grid list-none gap-3"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLUMNS[breakpoint]}, minmax(0, 1fr))`,
        gridAutoRows: `${ROW_UNIT}px`,
      }}
    >
      {packed.map((item, index) => {
        const entry = byId.get(item.id)
        if (!entry) return null
        const widget = widgetById(item.id)
        const variant = variantFor(
          item.colSpan,
          breakpoint,
          width,
          widget.variants
        )

        return (
          <li
            key={item.id}
            // minmax(0, 1fr) on the track plus min-w-0 here is load-bearing: without
            // both, chart SVGs and wide tables refuse to shrink and the page gains a
            // horizontal scrollbar (PLAN §9).
            className="min-w-0"
            style={{
              gridColumn: `${item.colStart} / span ${item.colSpan}`,
              gridRow: `span ${item.rowSpan}`,
            }}
          >
            <ContainerSizeProvider className="h-full min-w-0">
              <WidgetRenderer
                widgetId={item.id}
                datum={entry.datum}
                scope={scope}
                variant={variant}
                position={{ index, total: packed.length }}
                onMoveUp={
                  onMoveUp && index > 0 ? () => onMoveUp(item.id) : undefined
                }
                onMoveDown={
                  onMoveDown && index < packed.length - 1
                    ? () => onMoveDown(item.id)
                    : undefined
                }
                onRemove={onRemove ? () => onRemove(item.id) : undefined}
              />
            </ContainerSizeProvider>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The variant a cell will get, estimated from its column span.
 *
 * An estimate, because the widget's own provider measures the truth a frame later.
 * Estimating from the span rather than defaulting to `micro` avoids a visible flash of
 * the wrong form on first paint.
 */
function variantFor(
  span: number,
  breakpoint: ReturnType<typeof breakpointFor>,
  containerWidth: number,
  supported: readonly Variant[]
): Variant {
  const fraction = span / GRID_COLUMNS[breakpoint]
  return resolveVariant(Math.floor(containerWidth * fraction), supported)
}
