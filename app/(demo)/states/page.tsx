import type { Metadata } from "next"

import { ContainerSizeProvider } from "@/components/dashboard/container-size"
import { WidgetRenderer } from "@/components/dashboard/widget-renderer"
import { WidgetShell } from "@/components/dashboard/widget-shell"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadWidgetDatum } from "@/lib/data/widget-data"
import { resolveScope } from "@/lib/scope/resolve"

export const metadata: Metadata = { title: "States" }

/**
 * Every state a widget can be in, on one page.
 *
 * The client *will* click into these, and "we haven't designed that yet" is a bad answer
 * in a pitch. It is also the fastest way to check that an empty state reads differently
 * from an error, and that neither reads like a zero (PLAN Phase 9).
 *
 * The bottom row uses real fixture data chosen to be genuinely sparse, rather than
 * mocked emptiness — those are the cases the product will actually meet.
 */

const period = { kind: "academic-year" as const, id: CURRENT_ACADEMIC_YEAR }

const SYNTHETIC = [
  {
    state: "loading" as const,
    title: "Seat utilisation",
    note: "Sized like the content it replaces, so nothing shifts when data lands.",
  },
  {
    state: "empty" as const,
    title: "University placement",
    note: "“No data recorded” — a different claim from zero, and from an error.",
  },
  {
    state: "error" as const,
    title: "Contribution margin",
    note: "Announced as an alert, with a way out. One widget failing must not take the dashboard with it.",
  },
]

/** Real sparse cases from the fixtures, not mocked-up emptiness. */
const REAL = [
  {
    widgetId: "card.progressScore",
    scopeIds: ["emea", "eg"],
    note: "Egypt does not report a value-added score at all.",
  },
  {
    widgetId: "card.universityPlacement",
    scopeIds: ["emea", "uae", "dubai", "sch-dxb-04"],
    note: "A primary-only school structurally cannot have a placement rate.",
  },
  {
    widgetId: "card.attainmentRate",
    scopeIds: ["emea", "uae", "dubai", "sch-dxb-06"],
    note: "Opened this academic year, so there is no prior year to compare against.",
  },
]

export default function StatesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <header className="mb-6 flex max-w-prose flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Widget states</h1>
        <p className="text-sm text-muted-foreground">
          Loading, empty and error are distinct on purpose. So is “not
          measured”, which is a statement about the data rather than about the
          widget.
        </p>
      </header>

      <section aria-labelledby="synthetic-heading" className="mb-10">
        <h2 id="synthetic-heading" className="mb-3 text-sm font-medium">
          Shell states
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {SYNTHETIC.map(({ state, title, note }) => (
            <li key={state} className="flex flex-col gap-2">
              <div className="h-40">
                <WidgetShell
                  title={title}
                  state={state}
                  question="Illustrative only"
                  errorMessage={
                    state === "error" ? "Upstream request timed out" : undefined
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">{note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="real-heading">
        <h2 id="real-heading" className="mb-3 text-sm font-medium">
          Genuinely missing data
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {REAL.map(({ widgetId, scopeIds, note }) => {
            const scope = resolveScope(scopeIds, fixtureLookup)!
            const datum = loadWidgetDatum(
              scope.at(-1)!.id,
              widgetId.replace("card.", ""),
              period
            )
            return (
              <li
                key={widgetId + scopeIds.join()}
                className="flex flex-col gap-2"
              >
                <div className="h-40">
                  <ContainerSizeProvider width={360} className="h-full">
                    <WidgetRenderer
                      widgetId={widgetId}
                      datum={datum}
                      scope={scope}
                      variant="compact"
                    />
                  </ContainerSizeProvider>
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">
                    {scope.at(-1)!.label}.
                  </strong>{" "}
                  {note}
                </p>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
