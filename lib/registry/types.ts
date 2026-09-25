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

  render: (props: WidgetRenderProps) => ReactNode

  /** Mandatory, not optional — this is what a screen reader actually gets. */
  a11y: {
    summary: (datum: WidgetDatum, kpi: KpiDefinition, scope: ScopeRef) => string
    table: (datum: WidgetDatum, kpi: KpiDefinition) => DataTable
  }
}
