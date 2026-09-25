"use client"

import { useVariant } from "@/components/dashboard/container-size"
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
  variant: explicitVariant,
  position,
  onMoveUp,
  onMoveDown,
  onRemove,
  focusHref,
  domId,
}: {
  widgetId: string
  datum: WidgetDatum
  scope: ScopeRef
  /** Omit to let the widget measure its own cell (PLAN D2). */
  variant?: Variant
  position?: { index: number; total: number }
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void
  focusHref?: string
  /**
   * DOM id for fragment-return. Supplied by the caller rather than derived, because a
   * page may render the same widget more than once — the kitchen sink renders each one
   * at four variants, and deriving it there produced duplicate ids (WCAG 4.1.1).
   */
  domId?: string
}) {
  const widget = widgetById(widgetId)
  const kpi = kpiById(widget.kpiId)
  const measuredVariant = useVariant(widget.variants)
  const variant = explicitVariant ?? measuredVariant

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
      focusHref={focusHref}
      domId={domId}
    >
      {widget.render({ datum, kpi, scope, variant })}
    </WidgetShell>
  )
}
