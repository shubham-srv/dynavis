import type { Metadata } from "next"

import { ContainerSizeProvider } from "@/components/dashboard/container-size"
import { WidgetRenderer } from "@/components/dashboard/widget-renderer"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadWidgetDatum } from "@/lib/data/widget-data"
import { WIDGETS } from "@/lib/registry/registry"
import { resolveScope } from "@/lib/scope/resolve"
import { VARIANT_MIN_WIDTH, type Variant } from "@/lib/viz/variants"

export const metadata: Metadata = { title: "Kitchen sink" }

/**
 * Every widget, at every variant, on fixture data.
 *
 * One page doing four jobs (PLAN §14): the pa11y-ci target, the visual-regression
 * target, the design review surface, and the fastest way to see a responsive regression.
 * Because each frame has an explicitly injected width, the whole matrix is visible at
 * once without resizing anything.
 *
 * `app/(demo)` is throwaway — deleted at client kickoff (PLAN §0).
 */

const VARIANTS: readonly Variant[] = [
  "micro",
  "compact",
  "standard",
  "expanded",
]
const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const

/** A school, so KPIs needing senior years have real values rather than nulls. */
const SCOPE_ID = "sch-dxb-01"

export default function KitchenSinkPage() {
  const scope = resolveScope(["emea", "uae", "dubai", SCOPE_ID], fixtureLookup)!

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Kitchen sink</h1>
        <p className="text-sm text-muted-foreground">
          {WIDGETS.length} widgets × {VARIANTS.length} variants, at{" "}
          {scope.at(-1)!.label}. Widths are injected, not measured.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {WIDGETS.map((widget) => {
          const datum = loadWidgetDatum(SCOPE_ID, widget.kpiId, period)
          return (
            <section
              key={widget.id}
              aria-labelledby={`w-${widget.id}`}
              className="flex min-w-0 flex-col gap-3"
            >
              <h2 id={`w-${widget.id}`} className="text-sm font-medium">
                {widget.title}
                <span className="ml-2 font-normal text-muted-foreground">
                  {widget.pillar}
                </span>
              </h2>

              {/*
                Wide content scrolls inside its own container, never the page (PLAN §7).
                tabIndex makes the scroller keyboard-operable, which axe requires of any
                scrollable region.
              */}
              <div
                tabIndex={0}
                role="group"
                aria-label={`${widget.title} at each variant`}
                className="-mx-4 min-w-0 overflow-x-auto px-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex w-max items-start gap-4">
                  {VARIANTS.map((variant) => (
                    <figure key={variant} className="flex flex-col gap-1">
                      <figcaption className="text-xs text-muted-foreground">
                        {variant} · {frameWidth(variant)}px
                      </figcaption>
                      <div style={{ width: frameWidth(variant) }}>
                        <ContainerSizeProvider
                          width={VARIANT_MIN_WIDTH[variant]}
                        >
                          <WidgetRenderer
                            widgetId={widget.id}
                            datum={datum}
                            scope={scope}
                            variant={variant}
                          />
                        </ContainerSizeProvider>
                      </div>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** Frame a little above each threshold, so the variant is shown at a realistic size. */
function frameWidth(variant: Variant): number {
  return variant === "expanded"
    ? 900
    : Math.max(VARIANT_MIN_WIDTH[variant], 300) + 20
}
