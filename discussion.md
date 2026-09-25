# Discussion — Dashboard Revamp Approach

> Brainstorming transcript, 2026-09-23. Captured verbatim as the reasoning record behind [PLAN.md](PLAN.md).
> Context: revamping a client's cluttered Power BI dashboard. Next.js frontend, .NET backend.
> SOW commits to ≥80% test coverage, accessibility validation (pa11y), and performance testing.
> Intent: build a POC demonstrating the UI/UX, and use this repo as the base for the real client project.

---

## Question

I have a new project requirement where we want to revamp the client's existing Power BI dashboard, which is very cluttered and hard to use.

Our tech stack would be Next.js frontend, .NET backend. Our SOW says we would have to implement minimum 80% test coverage, validated by accessibility tools like pa11y, and performance testing as well.

Onto our main requirement, that is revamping existing visualizations. We decided to use Chart.js for heavy data charts and Recharts for 90% of our use cases, since it has almost every chart.

The page has to be viewable on mobile, tablet and desktop screens. And this brings a big problem. Charts do not scale well on small screens. The text goes out of the container, or is unreadable, or the tappable part is so small that adjacent elements are tapped.

There is also a requirement of customization: a user can pick from a list of KPIs to show on his dashboard, and can also reorder them. But this brings another problem of layout management. Not all KPIs will be equal size. KPI cards will be small, while a scatter plot will be big.

How do we approach this problem?

---

## Response

### The reframe

The two problems look unrelated but they're the same problem: **a widget currently has no contract**. It's just a chart someone dropped in a div. Once each visualization declares *what it is, what sizes it can occupy, and what it degrades into*, both the responsive problem and the layout problem become data, not CSS firefighting. And that same contract is what gets you the 80% coverage cheaply, because contracts are testable in a loop.

So the spine of the app is a **widget registry**:

```
{ id, title, question, sizes: {sm|md|lg}, renderer, dataShape,
  variants: { compact, standard, expanded }, a11y: { summary, tableFn } }
```

Everything else — the picker UI, the layout solver, the data fetcher, the test suite, the pa11y fixture page — iterates over that registry. Build it first, before you build a single chart.

### Problem 1: charts on small screens

Stop trying to shrink charts. **Shrinking is the wrong operation — substitution is the right one.**

Each widget declares a ladder of variants, and picks one based on *its own box width*, not the viewport:

| Container width | Scatter plot | Multi-series line | KPI card |
|---|---|---|---|
| < 380px | headline stat + "View chart" → fullscreen | sparkline + latest value + delta | value + delta |
| 380–700px | binned/hex or top-N, no legend | 2 series max + "other", no gridlines | value + delta + sparkline |
| > 700px | full scatter, tooltips, brush | full | full |

Concretely:

- **Container queries, not breakpoints.** Tailwind v4 ships `@container` natively. A widget that's ⅓-width on desktop and full-width on mobile is the *same* pixel width in both — viewport media queries get this wrong every time. Wrap it in a `useContainerSize()` (ResizeObserver) context so the variant decision is also readable in JS and, crucially, **injectable in tests**.
- **Flip orientation on narrow.** Vertical bars → horizontal bars. Category labels become left-aligned text, no rotation, no truncation, and the natural overflow direction is vertical scroll, which phones already do.
- **Budget your ink.** At narrow widths: thin ticks to first/last/peak, abbreviate numbers (`1.2M`), drop axis titles into the card header, kill the legend and use direct labels or a list below the chart, drop gridlines.
- **Escape hatch beats compromise.** Tap → full-screen focus view where the chart owns the whole viewport. Most dense charts (scatter, heatmap, 10-series line) should *never* attempt to be legible at 340px. Show the headline, offer the drill-in. This one decision removes about half of your responsive pain.

**Touch targets / mis-taps** are a hit-testing problem, not a size problem. Never require the user to hit the mark:

- Chart.js: `interaction: { mode: 'index', intersect: false }` — the whole vertical column is the target.
- Recharts cartesian charts already hit-test on the category axis; keep it that way.
- Scatter is the hard case — use nearest-neighbour (voronoi-ish) hit testing with a ~24px search radius rather than the point radius.
- **Replace tooltips on touch with a readout strip.** Hover doesn't exist on touch, and a floating tooltip covers the data it describes. A persistent value panel above/below the chart that updates on touch-drag is better on mobile *and* is the same component you update on keyboard focus — so it doubles as your a11y story. Two requirements, one component.

### Problem 2: heterogeneous layout

The trap is building a freeform drag-anywhere canvas. It's weeks of work, it's a nightmare for keyboard users, and users don't actually want it — they want *their* KPIs, in *their* order.

Recommendation: **ordered list + size tokens, not x/y coordinates.**

- Each widget declares a size token (`sm` = 3 cols, `md` = 6, `lg` = 12) per breakpoint. CSS Grid: 12 cols desktop, 6 tablet, 1 mobile (everything full width on mobile — which conveniently kills a whole class of chart-squishing).
- User state persisted is just `{ version: 1, widgets: [{id, sizeOverride?}] }`. An ordered array. No coordinates, no collision detection, trivially serializable, trivially diffable, trivially testable.
- **Don't use `grid-auto-flow: dense`.** It reorders visually without reordering the DOM, which breaks reading and tab order — a real a11y failure pa11y won't catch but an auditor will. Instead, run a small **pure packing function** that produces the final order, and render in that order so DOM order == visual order. That function is maybe 40 lines and 100% unit-testable — free coverage on the riskiest logic in the app.
- Consider a **banded layout** for v1: a KPI strip (small cards flow densely) on top, charts stacked below. Users reorder within a band. Far fewer edge cases, and it's the layout nearly every good dashboard converges on anyway.
- **Reordering must be keyboard-operable.** Drag-and-drop alone fails WCAG 2.5.7. Ship "move up / move down" buttons as the primary mechanism (dnd-kit's keyboard sensor as an enhancement), and announce position changes via `aria-live`: *"Revenue trend moved to position 3 of 8."*

### The thing nobody will say in the kickoff

The client's Power BI dashboard isn't cluttered because Power BI is bad. It's cluttered because nobody said no. If your customization feature is "pick from 60 KPIs," **you will ship the same clutter with better typography** and the revamp will be judged a failure in six months.

Push for: curated, role-based default dashboards that answer one question each ("Is revenue on track?"), with customization as an escape hatch for power users. Make the default so good that most users never open the picker. That's an editorial deliverable, not an engineering one — get it into the SOW as a discovery phase, or it won't happen.

### Accessibility — and the trick that pays for itself

pa11y is automated DOM checking. It will catch a `<canvas>` with no accessible name, contrast failures, unlabelled drag handles, missing landmarks. It will *not* catch "this chart is meaningless to a screen reader." Passing pa11y is your floor, not your goal — budget for one manual NVDA/VoiceOver pass.

The high-leverage pattern: **every widget ships a visually-hidden `<table>` of its underlying data**, plus a one-sentence text summary ("Revenue rose 12% over 6 months, peaking in March").

That single decision gives you four things:

1. Screen reader access to canvas charts (Chart.js is otherwise a black hole).
2. Your mobile "view as table" fallback — already built.
3. Your RTL testing surface — assert on the table, not on SVG paths. Charts become testable.
4. CSV export, basically free.

Also: `role="img"` + `aria-label` on the Recharts SVG wrapper with `aria-hidden` on the innards (otherwise SR users hear 400 path elements); never encode meaning by colour alone (shape/pattern/direct labels); 3:1 contrast for graphical objects per WCAG 1.4.11; honour `prefers-reduced-motion` to disable chart animation — which also makes your visual tests deterministic.

### Hitting 80% without hating your life

Don't chase coverage through chart internals. Push logic *out* of components into pure functions and test those:

- Variant selection (width → variant), tick reduction, number/date formatting, LTTB downsampling, the layout packing solver, the preferences reducer (add/remove/reorder), schema migration. These are where the bugs actually live, and they're 100%-coverable.
- Components: RTL + **a mocked ResizeObserver** — jsdom has no layout, so `ResponsiveContainer` renders at 0×0 and your charts render nothing. This is the #1 reason chart test suites get abandoned. Because your variant decision reads from *your* size context, you can just provide `{width: 320}` and assert "renders a table, not a scatter." Deterministic, fast, no snapshots.
- One **kitchen-sink route** rendering every registered widget at every variant with seeded fixture data. It's your pa11y-ci target, your Playwright visual-regression target, and your design review page. One page covers the whole matrix.
- .NET: coverlet with a build-failing threshold; keep controllers thin so the logic lives in testable services.
- Perf: Lighthouse CI budgets, and track **INP** specifically — charts destroy interaction latency. Dynamic-import the chart libs, don't mount offscreen widgets (IntersectionObserver + skeleton), and never ship Chart.js and Recharts in the same initial bundle.

### Two calls worth making early

**Do you actually need both libraries?** Recharts renders SVG → inspectable DOM, testable, natively accessible-ish. Chart.js renders canvas → faster at volume, but an a11y and testing liability. If you downsample server-side (LTTB to ~500 points based on a width hint from the client), Recharts may handle everything and you delete a whole dependency, a whole bundle, and a whole abstraction layer. **Spike this in week one** with your worst real dataset before committing.

**Define the API contract in chart-neutral terms.** The .NET response should be `{ series: [{id, label, points}], meta: {unit, format, precision} }` — never Recharts-shaped. And batch the dashboard fetch: one `POST /dashboard/data` with N widget requests, not 12 round trips over mobile latency. Server owns aggregation, downsampling, and a `width` hint; add ETag/output caching since KPI data is stale-tolerant.

### Questions back

1. **Who's the actual user?** Executives glancing on a phone and analysts drilling on desktop want genuinely different products. If it's both, "mobile = curated summary, desktop = exploration" is a legitimate answer and a much cheaper one than full parity.
2. **How real is the mobile requirement?** "Viewable on mobile" in an SOW sometimes means "doesn't break." If someone's committed to full analytical parity on a 375px screen, renegotiate that now, not in UAT.
3. **How many KPIs is the picker choosing from?** 12 is a design problem. 60 is an information architecture problem and needs discovery before any chart code gets written.

---

## Round 2 — 2026-09-25: the domain arrives

### Context added

Target: a **multinational school organisation**, at strategy level. Needs a matrix view of school × KPI, a
homepage of KPI cards over week / month / year (enrolment, active students, teachers), **drill-down to
granular level with breadcrumbs**, and multiple roles — super admin, regional manager, principal.
Strategy revolves around three pillars: **increasing profitable revenue, improving operational efficiency,
improving academic outcomes.**

### What this changed

**Drill-down moved from out-of-scope to the spine.** Round 1 listed cross-widget drill-through as
explicitly out of scope. That was wrong for this product. The dashboard is not "a list of widgets" — it is
*a list of widgets at a scope, for a period, for a role*. Those three values parameterise every data
request in the app.

**Three reframings did most of the work:**

1. **The matrix is the navigator, not a widget.** A school × KPI matrix at group level with hundreds of
   schools is unusable. But if the matrix always renders *the children of the current scope* — group→regions,
   region→countries, country→schools — the row count stays bounded at every level, and clicking a row *is*
   the drill-down. One component becomes the matrix view, the navigation, and the source of the breadcrumb
   trail.

2. **Role = a root scope plus a depth cap, not a permission list.** Super admin roots at the group,
   regional manager at their region, principal at their school. Same code path, different root. Four
   dashboards collapse into one. (Authorisation still enforced server-side — the client's scope parameter
   is a request, not a grant.)

3. **The three pillars are the information architecture.** A KPI that doesn't ladder to a pillar doesn't
   go on the strategic dashboard. That is the "say no" mechanism Round 1 said the project needed, and it
   comes from the client's own strategy rather than from us — far easier to sell.

**Scope state belongs in the URL.** Path segments for scope, query string for period and filters. Deep
links, correct back button, shareable views, and every drill flow becomes testable by navigating to a URL.

### Domain traps surfaced

These are specific to a *multinational school* group and are cheap now, expensive later:

- **The academic calendar is not the calendar.** Schools in both hemispheres means academic years starting
  in September *and* January. Comparisons must default to the comparable prior *academic* period —
  week-over-week enrolment deltas will produce garbage, and trust won't recover. Term-time-only metrics
  have legitimate gaps: attendance during summer break is *not applicable*, not 0%.
- **Currency.** Constant currency by default, or a 6% FX move reads as 6% growth and someone decides on it.
- **Missing data is not zero.** A school opened this year has no prior-year comparison; some countries
  don't report some KPIs. Nulls must never enter an average.
- **Matrix cell colour must respect KPI direction.** Higher-is-better, lower-is-better, and *band*
  (student:teacher ratio — both directions are bad). Colouring high cost-per-student green is the single
  most likely bug in the component.
- **Student-level drill-down is a legal boundary, not a feature flag.** The POC stops at class level.

### Proposed north star

**Re-enrolment rate.** It sits at the intersection of all three pillars — academic outcomes drive
retention, retention drives revenue without acquisition cost — and it is leading rather than lagging.

Full detail in [PLAN.md](PLAN.md) v2.

---

## Round 3 — 2026-09-25: answers, and the pattern in them

### Answers given

1. **Targets:** unknown. *"If we can't show targets, we can at least show trends — delta with numbers."*
2. **Drill-down:** hierarchical, confirmed. *"I see a comparison of different schools for a complex KPI.
   Then we click on that school to view further breakdown of that KPI. Breadcrumbs would show
   `comparison > particular selected school`."*
3. **Principals seeing other schools:** unsure. *"Perhaps not a detailed breakdown but maybe some kind of
   ranking. Perhaps it increases competition among schools?"*

### The pattern

Two of three answers are "we don't know yet." Neither needs to block anything — **make the unknown a
parameter rather than a decision.** Both became configuration:

**Targets → polymorphic baseline.** The cell renderer reads `vsBaseline` and never knows where it came
from. A resolver falls through `target → prior period → peer median → none`, per KPI. If the answer comes
back "no targets anywhere," a default changes and nothing else does.

Better still, the three baselines aren't degraded substitutes — they answer different questions:

| Baseline | Question |
|---|---|
| Target | *Who is failing?* — absolute performance |
| Prior period | *Who is moving?* — momentum |
| Peer median | *Who is behind comparable schools?* — relative |

So it becomes a control in the matrix header — **Compare against: Target · Last year · Peer median** —
and the POC turns into a discovery instrument. Demo all three, see which one the client argues about.
That argument is worth more than the answer we'd have guessed.

**Peer visibility → role setting**, defaulting to `anonymised-band`: *"7th of 22 comparable schools, band
median 82%."* Keeps the motivational signal, removes naming-and-shaming and most of the gaming incentive —
you can't target a rival you can't identify.

On the "increases competition" hypothesis: it does, but competition improves *the measured number*, which
isn't always the outcome. Schools are a well-documented case — teaching to the test, easier qualification
entries, attendance-code gaming. Two mitigations worth raising: **rank on progress rather than attainment**
(ranking raw exam results mostly ranks intake quality), and **make the peer band defensible** — a
300-student school against a 2,000-student flagship gets dismissed as unfair, and a dashboard dismissed
once by the people it measures doesn't recover.

### What the drill-down example actually revealed

The stated example is a drill with **one KPI held constant**, which is a different gesture from re-scoping
the whole dashboard. But they unify: the focus view is the matrix with one column and a real chart. Same
scope mechanics, same breadcrumb builder, same drill handler, cache key plus a KPI id. The headline
interaction turned out to need almost no new machinery.

The word doing the work was **"complex KPI."** A composite metric — contribution margin, cost per student,
value-added — has a second drill that is usually *more* useful than the sub-unit list: **what made this
number.** A regional manager seeing margin drop wants the cost line that moved; they get to the school list
second. So the focus view carries three breakdown axes — **By location**, **By component** (waterfall),
**Over time** — with the default declared per KPI.

And the guardrail: curriculum, cohort, subject and gender are *not* levels of the org tree. They are
filters or breakdown axes, never scope segments. The day one becomes a scope segment, `parseScope` stops
being total and the breadcrumb stops meaning "where am I."

### One trap in "delta with numbers"

A pass rate moving 80% → 85% is **+5 percentage points**, not +5%. Both framings are defensible, mixing
them is not, and a numerate client catches it in the first five minutes of the demo. Hence `deltaFormat`
on the envelope, `pp` suffixes, constant-currency money deltas, and a noise floor so a 3-student school
doesn't report "+33pp."

Full detail in [PLAN.md](PLAN.md) v3.
