"use client"

import { useVariant } from "@/components/dashboard/container-size"
import { useVariantTransition } from "@/hooks/use-variant-transition"
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
  // Rendered as a component, not called as a function, so a widget may use hooks. The
  // registry is a module constant, so this identity is stable and nothing remounts.
  const Body = widget.render
  const measuredVariant = useVariant(widget.variants)
  const variant = explicitVariant ?? measuredVariant
  const transitionRef = useVariantTransition<HTMLDivElement>(variant)

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
      {/*
        Keyed on the variant so React swaps the form outright instead of reconciling one
        into the other — the transition has to play on the new form, not on a half-patched
        mixture of both. The hook adds its class only on a real threshold crossing, never
        on a mount, so navigating and drilling stay still (PLAN §7).
      */}
      <div key={variant} ref={transitionRef}>
        <Body datum={datum} kpi={kpi} scope={scope} variant={variant} />
      </div>
    </WidgetShell>
  )
}
