import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Before and after" }

/**
 * The pitch page.
 *
 * **The "before" panel is an illustrative reconstruction, not the client's board.**
 * Nobody on this project has seen their actual dashboard; presenting an invented screen
 * as theirs would be a fabricated artefact in the one place it would be most persuasive
 * and most wrong. It is labelled as an illustration on screen, and the presenter should
 * say so out loud. Swap it for a real screenshot before the pitch if one is available.
 *
 * The clutter panel is `aria-hidden` with a text description beside it: it exists to
 * demonstrate a visual problem, and shipping genuinely inaccessible markup to make that
 * point would be its own defect.
 *
 * `app/(demo)` is throwaway — deleted at client kickoff (PLAN §0).
 */

const CHANGES = [
  {
    before: "Sixty-plus tiles, everything visible at once",
    after: "Six metrics by default, chosen per role",
    why: "The board is not cluttered because the tool was bad. It is cluttered because nobody said no. Every metric now has to ladder to one of the three strategy pillars, which is a rule the client already owns.",
  },
  {
    before: "Charts shrink until the labels collide",
    after: "Charts change form as the box narrows",
    why: "Shrinking is the wrong operation. A scatter plot becomes a headline and a button; a bar chart turns horizontal so school names read as text; a twelve-column matrix becomes a ranked list. Nothing is squeezed.",
  },
  {
    before: "Dual-axis charts comparing unlike measures",
    after: "One axis, or two charts",
    why: "A second y-scale lets any two lines be made to cross wherever you like. It is the single most common way a dashboard misleads its own authors.",
  },
  {
    before: "Colour is decoration; status is guesswork",
    after: "Colour encodes distance from a baseline, direction-aware",
    why: "Rising cost per student is bad; rising pass rate is good. The palette is measured, not chosen — including a hard cap of three series on scatter, because a fourth is indistinguishable to colour-blind readers.",
  },
  {
    before: "Numbers with no stated comparison",
    after: "Every number says what it is measured against",
    why: "vs. target, vs. last year, or vs. peer median — switchable, and labelled per column. A number whose baseline is unstated is not a fact.",
  },
  {
    before: "Blanks where data is missing",
    after: "“Not measured”, with the reason",
    why: "A school that opened this year has no prior year. A country may not report a metric at all. Treating those as zero silently punishes whoever reports least.",
  },
  {
    before: "Drill-down loses your place",
    after: "Scope lives in the URL, with a breadcrumb trail",
    why: "Every view is shareable, the back button works, and each breadcrumb is a dropdown so you can move sideways between schools without going back up.",
  },
  {
    before: "Mouse-only, desktop-only in practice",
    after: "Every flow completable by keyboard, at 320px",
    why: "Reordering is buttons first, drag second. There is an automated test that drives the entire customisation flow without a single mouse call.",
  },
]

export default function BeforeAfterPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-8 flex max-w-prose flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          What changes, and why
        </h1>
        <p className="text-muted-foreground">
          The same data, asked to answer three questions instead of sixty.
        </p>
      </header>

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="before-heading"
          className="flex flex-col gap-3"
        >
          <div>
            <h2 id="before-heading" className="text-sm font-medium">
              Before
            </h2>
            <p className="text-xs text-muted-foreground">
              Illustrative reconstruction — <strong>not</strong> the
              client&apos;s actual board, which we have not seen.
            </p>
          </div>

          {/*
            Decorative on purpose: it demonstrates a visual problem, and the text
            below carries the same point for anyone who cannot see it.
          */}
          <div
            aria-hidden
            className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-card p-2"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="flex h-14 flex-col justify-between rounded-sm border border-border/60 p-1"
              >
                <span className="text-[6px] leading-none text-muted-foreground">
                  METRIC {i + 1} — YTD ACT vs BUD vs LY
                </span>
                <svg viewBox="0 0 40 14" className="h-5 w-full">
                  {Array.from({ length: 9 }, (_, b) => (
                    <rect
                      key={b}
                      x={b * 4.4}
                      y={14 - ((i * 7 + b * 13) % 12) - 1}
                      width="3"
                      height={((i * 7 + b * 13) % 12) + 1}
                      // A different hue per bar: the rainbow that makes every tile
                      // look urgent and none of them readable.
                      fill={`hsl(${(i * 53 + b * 40) % 360} 70% 55%)`}
                    />
                  ))}
                </svg>
                <span className="text-[6px] leading-none text-muted-foreground">
                  ▲2.1 ▼0.4 ▲11.7
                </span>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Twenty-four tiles, each with three series and a rainbow palette,
            none of them stating which question it answers or what its numbers
            are compared against.
          </p>
        </section>

        <section
          aria-labelledby="after-heading"
          className="flex flex-col gap-3"
        >
          <div>
            <h2 id="after-heading" className="text-sm font-medium">
              After
            </h2>
            <p className="text-xs text-muted-foreground">
              Live. Everything below is running on synthetic data.
            </p>
          </div>

          <div className="flex flex-1 flex-col justify-center gap-3 rounded-lg border border-border bg-card p-6">
            <p className="text-sm">
              Six metrics, grouped by the three strategy pillars, each stating
              the question it answers and what it is measured against. Below
              them, a matrix of this level&apos;s children that doubles as the
              navigation.
            </p>
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Open the dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/focus/card.contributionMargin/emea"
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  A composite, decomposed
                </Link>
              </li>
              <li>
                <Link
                  href="/kitchen-sink"
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Every widget, every size
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <section aria-labelledby="changes-heading">
        <h2 id="changes-heading" className="mb-3 text-lg font-medium">
          Eight decisions
        </h2>
        <ul className="flex flex-col gap-4">
          {CHANGES.map((change) => (
            <li
              key={change.before}
              className="grid gap-2 rounded-lg border border-border p-4 md:grid-cols-[1fr_1fr_2fr] md:gap-6"
            >
              <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">
                {change.before}
              </p>
              <p className="text-sm font-medium">{change.after}</p>
              <p className="text-sm text-muted-foreground">{change.why}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
