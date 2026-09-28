import type { Metadata } from "next"

import { ContainerSizeProvider } from "@/components/dashboard/container-size"
import { WidgetRenderer } from "@/components/dashboard/widget-renderer"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadForWidget } from "@/lib/data/widget-data"
import { isValidAtLevel, WIDGETS } from "@/lib/registry/registry"
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
const SCHOOL_PATH = ["emea", "uae", "dubai", SCOPE_ID]

/**
 * Where to render a widget that is not meaningful at school level.
 *
 * A correlation needs a population to correlate *across*, and a school has no children —
 * rendered at `sch-dxb-01` the quadrant widget correctly reported "only 1 unit reports
 * both measures" at all four variants, which is true and tells a design reviewer nothing.
 * Those widgets are shown at the region instead.
 */
const REGION_PATH = ["emea"]

export default function KitchenSinkPage() {
  const scope = resolveScope(SCHOOL_PATH, fixtureLookup)!
  const regionScope = resolveScope(REGION_PATH, fixtureLookup)!

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
          const atSchool = isValidAtLevel(widget, "school")
          const where = atSchool ? scope : regionScope
          const whereId = where.at(-1)!.id
          const datum = loadForWidget(widget, whereId, period)
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
                  {atSchool ? "" : ` · at ${where.at(-1)!.label}`}
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
                            scope={where}
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
