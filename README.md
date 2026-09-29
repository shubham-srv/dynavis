# DynaVis

Strategic performance dashboard for a multinational school group — a POC of the UI/UX,
and the architectural base for the client project.

- **[PLAN.md](PLAN.md)** — the implementation plan. Read §0 (the dual mandate) before adding code.
- **[discussion.md](discussion.md)** — why the plan is the way it is.
- **[docs/demo-script.md](docs/demo-script.md)** — the five-minute pitch, with the honest answers.
- **[docs/accessibility-manual-pass.md](docs/accessibility-manual-pass.md)** — the screen-reader
  script. **Not yet run**; it needs a person and half a day.

## Routes

| Route | What it is |
|---|---|
| `/dashboard/<scope…>` | the product. Scope lives in the path, so every view is shareable |
| `/focus/<widgetId>/<scope…>` | one metric, full viewport, with three breakdown axes |
| `/before-after` | the pitch page. The "before" panel is an illustration, not the client's board |
| `/kitchen-sink` | every widget at every variant — the a11y and visual-regression target |
| `/states` | loading, empty, error, and genuinely missing data |

`/before-after`, `/kitchen-sink` and `/states` live under `app/(demo)` and are deleted at
client kickoff (PLAN §0).

## The responsive bet, in one widget

`quadrant.costVsAttainment` (Cost per student × Attainment, one mark per school) is the
clearest demonstration of PLAN D1 — *substitute the form, never shrink the chart*. The same
widget on the same dashboard renders four different kinds of object:

| Container width | What it renders |
|---|---|
| `<336px` | a sentence stating the correlation, and naming the schools that break it |
| `336–560` | four quadrant tiles with counts — the insight, none of the geometry |
| `560–896` | a scatter with the median crosshair; no radius channel |
| `≥896px` | radius by gross revenue, quadrant verdicts, outliers labelled |

It is full width, so all of this is visible on `/dashboard` by resizing a real window — not
only on `/kitchen-sink`. `components/widgets/quadrant-widget.test.tsx` asserts each rung.

## Motion

Animation is opt-out by construction. Three duration tokens in `app/globals.css` are zeroed
by a single `prefers-reduced-motion` query, and `app/globals.test.ts` fails the build if any
rule hardcodes a duration instead. Everything is additionally gated behind
`data-motion-ready`, set once the first layout settles, so a cold load paints statically and
only *changes* animate.

## Requirements

Node 20 (see `.nvmrc`). Use `npm ci`, not `npm install`, when cloning on another machine —
the lockfile is committed on purpose.

```bash
npm ci
npx playwright install chromium   # once, for e2e
```

## Running

```bash
npm run dev          # development server
npm run build        # production build
npm run start        # serve the production build
```

## Checks

`npm run ci` is the gate that must be green before pushing. It runs typecheck, lint, the
palette validator, unit tests with coverage thresholds, and a production build.

```bash
npm run ci                # everything below except the browser suites
npm run test             # unit tests
npm run test:watch       # unit tests, watching
npm run test:coverage    # unit tests + enforced coverage thresholds
npm run validate:palette # measure the shipped chart palette
npm run e2e              # Playwright at 375 / 768 / 1440, incl. axe
npm run a11y             # pa11y-ci, WCAG2AA (needs a server on :3000)
npm run lhci             # Lighthouse performance budgets
```

The browser suites are separate from `npm run ci` because they need a built app and a
real browser; CI runs them as their own job (`.github/workflows/ci.yml`).

### Checking one page, at one width

`npm run a11y` covers a fixed URL list at a single viewport, and `npm run e2e` covers three
viewports but only the routes its specs visit. Neither helps when you have changed one
widget and want to know about one page at 575px:

```bash
npm run build && npm run start          # in another terminal

npm run a11y:page -- /dashboard/emea                          # 375, 768 and 1440
npm run a11y:page -- /dashboard/apac/au --width 575
npm run a11y:page -- /dashboard /kitchen-sink --width 375,1440 --dark
```

It prints the offending selector and the reason, and exits non-zero, so it drops into a
hook or a CI step unchanged. A route that 404s is reported as a failure rather than as a
clean page — Next renders a perfectly accessible 404, so a typo would otherwise pass.

In Git Bash, write the route **without** its leading slash (`dashboard/emea`): MSYS rewrites
anything starting with `/` into a Windows path before the script sees it.

**Kill anything on port 3000 before running `a11y` or `lhci`.** A leftover dev server is
silently measured instead of the production build, and once produced a confidently wrong
994KB bundle reading against a 220KB budget.

### Coverage

Thresholds are enforced, not reported: 80% globally and 95% across `lib/**`, which is
where the pure logic lives. Coverage counts every production source file, not only the
ones a test imports — so adding an untested module *lowers* the number rather than
quietly raising it.

`app/**` is excluded because routes and async server components are covered by
Playwright; Vitest cannot render async server components at all.

### Palette

`npm run validate:palette` parses the `--chart-*` and `--matrix-*` tokens out of
`app/globals.css` and measures them — lightness band, chroma floor, colour-vision
separation, contrast — in both light and dark mode. It fails the build on a regression.

When the client's brand colours arrive, run this first. See PLAN §11.

## Layout

| Path | Contents |
|---|---|
| `app/` | routes; `app/api/` is the stand-in for the future .NET backend |
| `components/ui/` | vendored shadcn primitives — not ours, not linted for style |
| `lib/` | production logic: pure, tested to 95% |
| `scripts/lib/` | vendored third-party; kept re-syncable, excluded from lint |
| `tests/` | `setup.ts` and mocks for Vitest, `e2e/` for Playwright |

## Adding shadcn components

```bash
npx shadcn@latest add <component>
```
