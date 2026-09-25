"use client"

import { WidgetShell } from "@/components/dashboard/widget-shell"
import type { WidgetDatum } from "@/lib/data/widget-data"
import { kpiById } from "@/lib/kpi/catalog"
import { widgetById } from "@/lib/registry/registry"
import type { ScopeRef } from "@/lib/scope/types"
import type { Variant } from "@/lib/viz/variants"

/**
 * Renders a registry widget by id.
 *
 * The client boundary lives here rather than in the registry so a server component can
 * load data and hand over plain, serialisable objects. Calling a client component as a
 * plain function from the server would bypass the boundary entirely.
 */
export function WidgetRenderer({
  widgetId,
  datum,
  scope,
  variant,
  position,
  onMoveUp,
  onMoveDown,
  onRemove,
  onExpand,
}: {
  widgetId: string
  datum: WidgetDatum
  scope: ScopeRef
  variant: Variant
  position?: { index: number; total: number }
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void
  onExpand?: () => void
}) {
  const widget = widgetById(widgetId)
  const kpi = kpiById(widget.kpiId)

  return (
    <WidgetShell
      title={widget.title}
      question={variant === "micro" ? undefined : widget.question}
      summary={widget.a11y.summary(datum, kpi, scope)}
      table={widget.a11y.table(datum, kpi)}
      position={position}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onRemove={onRemove}
      onExpand={onExpand}
    >
      {widget.render({ datum, kpi, scope, variant })}
    </WidgetShell>
  )
}
