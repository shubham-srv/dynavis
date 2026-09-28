import type { ReactNode } from "react"

import type { DataTable } from "@/lib/a11y/table"
import type { WidgetDatum } from "@/lib/data/widget-data"
import type { KpiDefinition, Pillar } from "@/lib/kpi/types"
import type { Breakpoint, SizeToken } from "@/lib/layout/tokens"
import type { ScopeRef } from "@/lib/scope/types"
import type { Variant } from "@/lib/viz/variants"

/**
 * The widget contract.
 *
 * The spine of the whole app (PLAN §5.3): the picker, the layout solver, the data
 * fetcher, the kitchen-sink route and the contract test all iterate over the registry.
 * A widget that does not compile against this type does not ship, and the registry is
 * the only way to add one.
 */

/** Which axis the focus view opens on (PLAN §6.6). */
export type Breakdown = "location" | "component" | "time"

export interface WidgetRenderProps {
  datum: WidgetDatum
  kpi: KpiDefinition
  scope: ScopeRef
  variant: Variant
  onDrill?: (childId: string) => void
  onFocus?: () => void
}

export interface WidgetDefinition {
  id: string
  kpiId: string
  /**
   * A second KPI, plotted against `kpiId`. Set only by correlation widgets.
   *
   * Its presence is what tells the page loader to do the paired join, so a widget opts
   * into the extra query by declaring what it needs rather than by the loader guessing
   * from the widget's id.
   */
  pairKpiId?: string
  /** A third KPI, encoded as mark size where there is room to read one. */
  weightKpiId?: string
  title: string
  /** The single question it answers. If you cannot write one, cut the widget. */
  question: string
  pillar: Pillar

  /**
   * Scope levels where this widget is meaningful. "Revenue by region" is nonsense at
   * class level, and a university placement rate is nonsense for a primary school.
   */
  validAtLevels: readonly string[] | "all"

  /** Declared footprint. The layout solver reads only this. */
  size: Record<Breakpoint, { token: SizeToken; rowSpan: number }>

  /** Variants this widget implements, narrowest first. */
  variants: readonly Variant[]

  /** Focus-view axes. First entry is the default (PLAN §6.6). */
  breakdowns: readonly Breakdown[]

  /**
   * The widget body. **A React component, and it must be rendered as one.**
   *
   * The signature is a component's signature, but for a long time every call site invoked
   * it as a plain function — `{widget.render(props)}`. That works right up until a widget
   * uses a hook, at which point React throws "Invalid hook call" from inside whichever
   * component happened to be rendering, and the stack points nowhere near the registry.
   * Call sites now do `const Body = widget.render` and render `<Body {...props} />`, which
   * gives every widget its own component instance, its own hooks, and its own place in the
   * React tree.
   */
  render: (props: WidgetRenderProps) => ReactNode

  /** Mandatory, not optional — this is what a screen reader actually gets. */
  a11y: {
    summary: (datum: WidgetDatum, kpi: KpiDefinition, scope: ScopeRef) => string
    table: (datum: WidgetDatum, kpi: KpiDefinition) => DataTable
  }
}
