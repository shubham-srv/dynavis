# DynaVis — POC Implementation Plan

**Status:** draft v3 · 2026-09-25
*(v1 2026-09-23 · v2 added the domain model, drill-down and the matrix navigator · v3 adds polymorphic
baselines, the KPI drill axes, and anonymised peer context)*
**Reasoning record:** [discussion.md](discussion.md)
**Repo role:** POC demo for the client pitch **and** the architectural base for the real client project.

**Product:** a strategic dashboard for a multinational school group. It answers, at any level of the
organisation from the whole group down to a single class, how the business is performing against three
strategic pillars — **profitable revenue**, **operational efficiency**, **academic outcomes** — and lets
the user drill from a global view to the granular cause without losing their place.

---

## 0. The dual mandate (read this first)

This repo has two jobs that pull in opposite directions:

1. **Demo** — convince the client the new UX is better. Wants speed, fake data, polish.
2. **Foundation** — become the real project. Wants contracts, tests, rigour.

Resolve the tension with one rule, enforced by directory:

| Directory | Standard | Survives into the client project? |
|---|---|---|
| `lib/`, `hooks/`, `components/dashboard/`, `components/charts/`, `components/scope/` | Production-grade. Typed, tested, reviewed. | **Yes — this is the product.** |
| `components/widgets/` | Production-grade shell, demo-grade content. | Shells yes, fixtures no. |
| `app/(demo)/`, `lib/data/fixtures/` | Throwaway. Zero test requirement. | **No — deleted at kickoff.** |

Coverage thresholds (§14) are set per-directory to match. If you can't tell which bucket a file is in, it goes in the production bucket.

> **⚠️ Never commit real client data.** This is a personal machine and the repo will be pushed to GitHub.
> All fixtures are synthetic, from a seeded PRNG, with invented school and region names. **No real student
> records, ever, under any circumstance** — see §12.5 and §20.

---

## 1. The product

### 1.1 The three pillars are the information architecture

The client's strategy has three pillars. So does the dashboard. This is not decoration — it is the
mechanism that stops the rebuild from recreating the clutter:

> **A KPI that does not ladder to a pillar does not go on the strategic dashboard.**

That rule comes from the client's own strategy, which makes it far easier to sell than "we think you have
too many charts." Every widget declares its pillar; the picker groups by pillar; the homepage has three
sections. If someone wants a KPI that fits nowhere, that is a conversation about strategy, not layout.

### 1.2 Candidate KPI set

A starting proposal, to be confirmed in discovery (§21). Deliberately short — six per pillar, not sixty.

**Profitable revenue**

| KPI | Note |
|---|---|
| Seat utilisation (enrolled ÷ capacity) | The hinge metric — links revenue and operations |
| Revenue per student | Constant currency (§12.2) |
| Contribution margin per school | "Profitable" revenue, not gross |
| Fee collection rate / receivables > 90 days | Cash, not accruals |
| Discount & scholarship leakage (% of gross fees) | Usually invisible and usually large |
| Net new enrolments (gross adds − withdrawals) | Net, because gross flatters |

**Operational efficiency**

| KPI | Note |
|---|---|
| Student:teacher ratio | A **band**, not a maximum (§8.4) |
| Class fill rate | Where utilisation actually leaks |
| Cost per student | Constant currency |
| Staff turnover (rolling 12m) | Leading indicator for both other pillars |
| Teacher absence + substitute cost | Operational and academic impact |
| Facility utilisation | Capex justification |

**Academic outcomes**

| KPI | Note |
|---|---|
| Attainment (pass rate / mean score) | What they have today |
| **Progress / value-added vs. baseline** | Fairer than attainment — a selective intake flatters raw scores |
| Student attendance rate | Leading indicator of attainment *and* withdrawal |
| **Re-enrolment / retention rate** | **The north star — see below** |
| University placement rate | Senior schools only |
| Parent satisfaction (NPS) | Leading indicator of retention |

**Propose re-enrolment rate as the single north-star metric.** It sits at the intersection of all three
pillars — academic outcomes drive retention, retention drives revenue without acquisition cost, and it is
*leading* rather than lagging. If the homepage has one hero number, this is a strong candidate.

### 1.3 The organisation hierarchy

```
Group → Region → Country → City / Cluster → School → Year group → Class → Student
```

**The depth is not uniform and must not be hardcoded.** A multinational group always has exceptions —
a country with one school and no cluster tier, a region that is a single country, a school with no senior
year groups. Treat the hierarchy as **data**: the server returns the available dimensions and each scope
node declares its children. The client renders whatever depth it is given. Hardcoding an eight-level enum
is the single most likely source of rework when real org data arrives.

### 1.4 Roles

**Role = a root scope plus a depth cap, not a list of permissions.** This is the key simplification: there
is one dashboard, and a role determines where in the tree you start and how far down you may go.

| Role | Root scope | Depth cap | Pillars |
|---|---|---|---|
| Super admin | Group | Class | All |
| Regional manager | Their region(s) | School (or class) | All |
| Country head | Their country | School | All |
| Principal | Their school | Class | All + anonymised peer context (§1.5) |
| Head of academics | Group or region | Class | Academic only |
| Finance | Group or region | School | Revenue only |

Notes:

- A role may have **multiple roots** (a manager over two regions). Render a synthetic "My regions" root
  above them so the breadcrumb always has a single home.
- **Scope authorisation is enforced server-side, always.** The client's scope parameter is a request, not
  a grant. A hand-edited URL must return 403, and there must be a test for exactly that.
- The widget catalog is **server-driven per role** (`GET /catalog`), not a client-side constant. Otherwise
  a principal's bundle contains the names of every group-level revenue KPI.

### 1.5 Peer visibility — build the mechanism, let the client choose the policy

Whether a principal sees other schools is a political question the client has not settled. Do not wait for
the answer and do not hardcode a guess. Make it a role setting:

```ts
type PeerVisibility =
  | 'none'              // own school only
  | 'anonymised-band'   // own value + rank/percentile within a peer band, peers unnamed  ← recommended default
  | 'named-group';      // full matrix of named peers
```

**Recommended default: `anonymised-band`.** *"You are 7th of 22 comparable schools; band median 82%,
upper quartile 89%."* It keeps the motivational signal, and it removes naming-and-shaming along with most
of the gaming incentive — you cannot target a rival you cannot identify.

Three things to raise with the client when this is decided (§21.5):

1. **The peer band matters more than the rank.** A 300-student school in a developing market against a
   2,000-student flagship is not a fair comparison, and the first thing a principal will say is that the
   comparison is unfair. Band by size, curriculum, fee tier and market maturity. **A rank whose peer set
   is not defensible is the most common reason a performance dashboard loses credibility with the people
   it measures** — once dismissed, it does not recover.
2. **Rank on progress, not attainment.** Ranking on raw exam results ranks intake quality. Ranking on
   value-added ranks what the school actually contributed. This is why §1.2 proposes progress alongside
   attainment.
3. **Ranking moves the measured number, which is not the same as moving the outcome.** In schools this is
   well documented — teaching to the test, entering students for easier qualifications, attendance-code
   gaming, discouraging weak students from sitting exams. If the group ranks on a single lagging metric,
   expect that metric to improve faster than reality. Mitigate by ranking on a small balanced set across
   all three pillars rather than one headline number, and by pairing any rank with its inputs.

Principals must see **the same metric definitions leadership sees**. "Head office has a different number"
destroys trust faster than an unflattering number does.

---

## 2. Scope

### 2.1 In scope for the POC

- **Homepage** — hero KPI cards per pillar, with a period control (week / month / term / academic year / YTD).
- **The matrix navigator** — children-of-current-scope × KPI, colour-coded against target, sortable, clickable to drill. §8.
- **Drill-down with breadcrumbs** — scope in the URL, back button correct, deep-linkable. §6.
- **Three role presets** — super admin, regional manager, principal — switchable in the demo via a role picker.
- Full responsive behaviour driven by **container size**, not viewport. §7.
- Widget picker + keyboard-first reordering + persistence, per role. §10.
- Focus / drill-in view for a single widget.
- Kitchen-sink route rendering every widget at every variant.
- CI green: typecheck, lint, unit coverage gate, Playwright e2e, axe + pa11y-ci, Lighthouse budgets.

### 2.2 Explicitly out of scope

- The .NET backend. The POC ships **Next.js Route Handlers mimicking the future .NET contract exactly** (§16), so the swap is a base-URL change.
- Real auth. The demo role picker is a client-side switch; the real thing is server-enforced (§1.4).
- **Student-level drill-down.** The POC stops at **class**. This is a data-protection decision, not a UX one — see §12.5.
- Export to PDF/PowerPoint, scheduled digests, alerting and thresholds. *(Alerting is likely a phase-2 ask; the target/band metadata in §5.4 is designed to support it later.)*
- Write-back, commentary, annotations.
- Localisation beyond `en`. **But do not make RTL impossible** — see §12.4.

### 2.3 Definition of done

The POC is done when a stranger can be handed the URL on a phone and a laptop, and:

1. The default dashboard for each of the three roles is legible and useful on both, without pinch-zoom or horizontal page scroll.
2. They can drill group → region → country → school and back, via the matrix, with breadcrumbs tracking position, and the URL is shareable at every step.
3. They can add, remove and reorder widgets using **only a keyboard**, and the change survives a reload.
4. Every chart and every matrix can be read as a table.
5. CI is green including the a11y and perf gates.
6. The README walks a presenter through the 5-minute pitch.

---

## 3. Decisions (ADR-lite)

| # | Decision | Choice | Why | Revisit when |
|---|---|---|---|---|
| D1 | Responsive strategy | Variant substitution keyed on container width | Shrinking charts is unwinnable; substitution is declarative and testable | Never — core bet |
| D2 | Size source | `ResizeObserver` context + Tailwind v4 `@container` | Widget width ≠ viewport width; context makes it test-injectable | — |
| D3 | Layout model | Ordered list + size tokens; pure packing solver | Freeform x/y is weeks of work, a11y-hostile, not what users want | Client demands a freeform canvas |
| D4 | DOM order | Always equals visual order (no `grid-auto-flow: dense`) | Tab/reading order correctness | Never |
| D5 | Reorder UX | Move up/down buttons primary, dnd-kit secondary | WCAG 2.5.7; DnD alone fails audit | — |
| D6 | Chart libs | **Recharts default. Chart.js only if spike S1 proves it's needed.** | SVG = testable + accessible; canvas is a black hole | After S1 |
| D7 | Chart data contract | Chart-neutral envelope, never library-shaped | Lets D6 reverse without touching widgets | Never |
| D8 | A11y baseline | Every widget ships a hidden `<table>` + text summary | Solves SR access, mobile fallback, testability at once | Never |
| D9 | Test runner | Vitest + RTL + jsdom | Lower ESM/Next 16 friction; speed matters for a coverage gate | After S2 |
| D10 | Mock backend | Next Route Handlers mirroring the .NET contract | Swap = base URL change; MSW only inside tests | .NET API exists |
| D11 | Persistence (POC) | `localStorage`, versioned + hand-validated, behind a repository interface | Same interface the .NET prefs endpoint implements | .NET API exists |
| D12 | Palette | Replace shadcn's `--chart-*` — it currently fails validation (§11.1) | Measured, not assumed | Client brand palette arrives |
| **D13** | **Scope model** | **Scope is a path of `{level, id}` pairs, server-described, not a hardcoded enum** | Org depth is never uniform in a multinational group (§1.3) | Never |
| **D14** | **Scope state lives in the URL** | **Path segments for scope, query string for period/filters** | Deep links, back button, sharing, and trivially testable in Playwright | Never |
| **D15** | **The matrix is the navigator** | **Always renders children-of-current-scope; a row click drills** | Bounds row count at every level and unifies matrix + navigation | Never |
| **D16** | **Matrix is a custom virtualised `<table>`**, not a charting-library heatmap | Real table semantics for a11y, virtualisation for perf, full control of cell rendering | — |
| **D17** | **Cell colour encodes distance from a baseline, never raw magnitude** | KPI scales are incomparable; distance-from-baseline is the only shared scale (§8.3) | Never |
| **D18** | **Academic-calendar-aware date dimension from day one** | Hemispheres and term dates differ across a multinational group (§12.1) | Never — retrofitting this is a rewrite |
| **D19** | **Constant-currency is the default for money KPIs** | Otherwise FX movement masquerades as performance (§12.2) | Never |
| **D20** | **Missing data is a first-class state, distinct from zero** | Sparse matrices are guaranteed in a multinational group (§12.3) | Never |
| **D21** | **Baseline is polymorphic — target / prior period / peer median / none — and user-switchable** | The client doesn't know yet whether targets exist; this makes that a setting, not a blocker (§8.4) | Never |
| **D22** | **Two drill axes: scope (where) and decomposition (what made it). Both stay inside one focus view** | A "complex KPI" drills by component, not only by sub-unit (§6.5) | Never |
| **D23** | **Peer visibility is a role setting, defaulting to anonymised band** | Political question, mechanical answer (§1.5) | Client sets policy |

> **Next 16 warning.** Per `AGENTS.md`, this Next version has breaking changes vs. what most tooling and
> docs assume. **Read `node_modules/next/dist/docs/` before writing any routing, caching, or data-fetching
> code.** D14 in particular depends on current routing semantics — do not copy App Router patterns from
> memory or blog posts.

---

## 4. Repo structure

```
app/
  (dashboard)/
    [[...scope]]/page.tsx     # THE dashboard. Scope comes from the catch-all segment (D14).
    [[...scope]]/[widgetId]/  # focus / drill-in view for one widget at one scope
  (demo)/
    kitchen-sink/page.tsx     # every widget × every variant — a11y + visual test target
    roles/page.tsx            # side-by-side role preset comparison, for the pitch
    before-after/page.tsx     # the old Power BI board vs. the revamp — wins the pitch
  api/
    dashboard/data/           # batched widget data (fake .NET, §16)
    dashboard/matrix/         # matrix envelope for a scope
    dashboard/catalog/        # role-scoped widget catalog
    dashboard/scope/          # scope tree: children, labels, breadcrumb resolution
    dashboard/prefs/          # per-role preferences
components/
  ui/                         # shadcn / base-ui primitives (untouched)
  dashboard/                  # DashboardGrid, WidgetShell, WidgetPicker, ReorderControls, FocusView
  scope/                      # Breadcrumbs, ScopeSwitcher, MatrixNavigator, PeriodControl
  charts/                     # adapters: <LineChart>, <BarChart>, <ScatterChart>, <Sparkline>
  widgets/                    # concrete widgets, each = registry entry + renderer
lib/
  registry/                   # widget definitions, types, zod schemas
  scope/                      # ScopeRef, path parse/serialise, breadcrumb builder, role roots
  layout/                     # size tokens, packing solver, breakpoints
  viz/                        # variant resolution, tick reduction, formatters, LTTB, palette, scales
  matrix/                     # cell state derivation, direction/band logic, sorting, virtualisation glue
  calendar/                   # academic calendar, period resolution, comparable-prior-period (§12.1)
  money/                      # constant-currency conversion, reporting currency (§12.2)
  a11y/                       # data-table builder, summary generator, live-region helpers
  data/                       # client, envelope types, fixtures (seeded PRNG)
  prefs/                      # prefs reducer, migrations, repository interface
hooks/
  use-container-size.ts
  use-scope.ts
  use-dashboard-prefs.ts
  use-reduced-motion.ts
tests/
  setup.ts                    # ResizeObserver + matchMedia + IntersectionObserver mocks
  e2e/                        # Playwright: drill flows, visual regression, axe
  a11y/                       # pa11y-ci config + URL list
```

---

## 5. Core contracts

Write these **first**, before any chart code. Everything else consumes them.

### 5.1 Scope

```ts
// lib/scope/types.ts

/** One level of the hierarchy, as described by the server — NOT a hardcoded union (D13). */
export interface ScopeLevel { key: string; label: string; pluralLabel: string; depth: number; }

/** A position in the org tree. The array IS the breadcrumb trail. */
export type ScopeRef = { level: string; id: string; label: string }[];

/** URL <-> ScopeRef. Pure, total, and round-trip tested. */
export function serialiseScope(scope: ScopeRef): string[];        // → ['emea','uae','dubai','sch-1042']
export function parseScope(segments: string[]): ScopeRef | null;  // null = malformed → 404, never a crash

export interface ScopeNode {
  ref: ScopeRef;
  childLevel: string | null;        // null = leaf; the matrix renders nothing below this
  children: { id: string; label: string }[];
  /** Role-derived. The client uses it to hide affordances; the SERVER still enforces (§1.4). */
  canDrill: boolean;
}
```

**Invariant:** `parseScope(serialiseScope(s)) === s`. Property-test it. Every deep link in the product depends on it.

### 5.2 Size and variants

```ts
// lib/layout/tokens.ts
export const BREAKPOINTS = { mobile: 0, tablet: 768, desktop: 1280 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

export const GRID_COLUMNS: Record<Breakpoint, number> = { mobile: 1, tablet: 6, desktop: 12 };

export type SizeToken = 'sm' | 'md' | 'lg' | 'xl';
export const COL_SPAN: Record<Breakpoint, Record<SizeToken, number>> = {
  mobile:  { sm: 1, md: 1, lg: 1, xl: 1  },
  tablet:  { sm: 2, md: 3, lg: 6, xl: 6  },
  desktop: { sm: 3, md: 6, lg: 8, xl: 12 },
};
export const ROW_UNIT = 88;
```

```ts
// lib/viz/variants.ts
export type Variant = 'micro' | 'compact' | 'standard' | 'expanded';

/** Container width → variant. Pure. Test exhaustively; it drives everything. */
export function resolveVariant(width: number, supported: readonly Variant[]): Variant;
```

### 5.3 The widget definition

```ts
// lib/registry/types.ts
export type Pillar = 'revenue' | 'efficiency' | 'academic';

export interface WidgetDefinition<TParams = unknown> {
  id: string;
  title: string;
  /** The single question this widget answers. If you can't write it, cut the widget (§1.1). */
  question: string;
  pillar: Pillar;

  /** Scope levels at which this widget is meaningful. "Revenue by region" is nonsense at class level. */
  validAtLevels: readonly string[] | 'all';
  /** Minimum role depth required to see it at all. Advisory — the server owns the truth. */
  minRole?: string;

  size: Record<Breakpoint, { token: SizeToken; rowSpan: number }>;
  variants: readonly Variant[];

  dataKey: string;
  params?: TParams;
  schema: ZodType<DataEnvelope>;

  render: (props: WidgetRenderProps) => ReactNode;

  a11y: {
    summary: (data: DataEnvelope, scope: ScopeRef) => string;
    table: (data: DataEnvelope) => { columns: string[]; rows: (string | number | null)[][] };
  };
}

export interface WidgetRenderProps {
  data: DataEnvelope;
  scope: ScopeRef;
  period: PeriodRef;
  variant: Variant;
  width: number;
  height: number;
  onDrill?: (child: { level: string; id: string; label: string }) => void;
  onFocus?: () => void;
}
```

**Invariant:** a widget that does not compile against this type does not ship. The registry is the only way to add one.

### 5.4 Data envelopes

```ts
// lib/data/envelope.ts

/** A property of the KPI itself, NOT of the target. Required even when no target exists. */
export type Direction = 'higher-is-better' | 'lower-is-better' | 'band' | 'neutral';

/**
 * What a value is judged against. Polymorphic because the client may not have targets (§8.4).
 * The matrix and every delta read `vsBaseline`; they never care which kind produced it.
 */
export type Baseline =
  | { kind: 'target'; value: number; band?: { min: number; max: number } }
  | { kind: 'prior-period'; value: number | null; period: PeriodRef }
  | { kind: 'peer-median'; value: number; n: number; band?: string }
  | { kind: 'none' };

/** null = NOT MEASURED. Never coerce to 0, never include in an average (D20, §12.3). */
export interface DataPoint { x: number | string; y: number | null; meta?: Record<string, unknown>; }
export interface Series {
  id: string; label: string; points: DataPoint[];
  direction: Direction;
  baseline?: Baseline;
}

export interface EnvelopeMeta {
  unit?: string;
  format: 'number' | 'currency' | 'percent' | 'duration' | 'ratio';
  /**
   * How a delta on this KPI is expressed. Getting this wrong is a credibility bug:
   * a pass rate moving 80 → 85 is +5 PERCENTAGE POINTS, not +5 percent (§8.6).
   */
  deltaFormat: 'absolute' | 'percent' | 'percentage-points';
  precision: number;
  xType: 'time' | 'category' | 'linear';
  /** Money only. Absent = nominal, which must then be labelled in the UI (§12.2). */
  currency?: { reporting: string; basis: 'constant' | 'nominal'; fxAsOf?: string };
  /** Which academic period this covers, and what it is fairly comparable to (§12.1). */
  period: PeriodRef;
  comparison?: { period: PeriodRef; label: string };
  sampled?: { from: number; to: number };
  asOf: string;
}

export interface DataEnvelope { series: Series[]; meta: EnvelopeMeta; }
```

```ts
// lib/matrix/types.ts — the matrix needs its own shape (§8)
export interface MatrixColumn {
  kpiId: string; label: string; shortLabel: string;   // shortLabel for narrow headers
  pillar: Pillar;
  format: EnvelopeMeta['format']; precision: number;
  deltaFormat: EnvelopeMeta['deltaFormat'];
  direction: Direction;
  /** Which baseline kind this column actually resolved to — surfaced in the header (§8.4). */
  baselineKind: Baseline['kind'];
}
export interface MatrixCell {
  value: number | null;                 // null = not measured (D20)
  baseline: Baseline;
  /** Raw signed delta vs. baseline, in the KPI's own units. Shown as a number beside the value. */
  delta: number | null;
  /** Signed, normalised distance in [-1, 1], direction-aware. THE colour input (D17). */
  vsBaseline: number | null;
  note?: string;                        // why a value is missing or caveated
}
export interface MatrixEnvelope {
  scope: ScopeRef;
  rowLevel: string;                     // the child level being listed, e.g. 'school'
  rows: { id: string; label: string; canDrill: boolean }[];
  columns: MatrixColumn[];
  cells: MatrixCell[][];                // cells[rowIndex][colIndex]
  meta: Omit<EnvelopeMeta, 'format' | 'precision' | 'xType'>;
}
```

Nothing in `components/widgets/` may import from `recharts` or `chart.js`. Enforce with an ESLint
`no-restricted-imports` rule — worth more than a review comment.

### 5.5 Preferences

```ts
// lib/prefs/types.ts
export interface DashboardPrefs {
  version: 2;
  /** Preferences are PER ROLE — a principal's layout is not a regional manager's. */
  role: string;
  widgets: { id: string; sizeOverride?: SizeToken }[];   // order IS the array order
  matrix?: { visibleKpis: string[]; sortBy?: string; sortDir?: 'asc' | 'desc' };
  defaultPeriod?: PeriodRef;
}

export interface PrefsRepository {
  load(userId: string, role: string): Promise<DashboardPrefs | null>;
  save(userId: string, prefs: DashboardPrefs): Promise<void>;
}
```

No x/y coordinates. Ever. Position is derived, never stored.

---

## 6. Scope, drill-down and breadcrumbs

### 6.1 The model

The dashboard is not "a list of widgets." It is **a list of widgets at a scope, for a period, for a role.**
Those three values parameterise every data request in the app.

- **Scope** lives in the URL path: `/dashboard/emea/uae/dubai/sch-1042?period=ay-2025&compare=prior-ay`
- **Period and filters** live in the query string.
- **Role** comes from the session (demo: a switcher that rewrites the root).

Everything follows: sharing a link shares a view, the back button walks the drill history for free,
and every flow is testable in Playwright by navigating to a URL.

### 6.2 Drill mechanics

- **Drilling down** appends a segment. The widget set is re-resolved against `validAtLevels` — widgets that
  don't apply at the new level drop out, new ones appear. Preserve scroll position and the selected KPI.
- **Drilling up** is the breadcrumb, the back button, or `Escape`. All three do the same thing.
- **Cache by `scope + period`** so going back up is instant. Prefetch children's summary data on row hover
  or focus — drilling should feel free.
- **Widget continuity matters more than widget count.** If a user drills while looking at "attendance rate,"
  the same widget should still be on screen at the new level, in the same position. Nothing destroys
  orientation faster than the layout reshuffling on every drill. Sort the resolved widget list stably by
  the user's saved order, not by relevance score.

### 6.3 Breadcrumbs

- Rendered from `ScopeRef` directly — the array *is* the trail. No separate state to desync.
- `<nav aria-label="Scope">` + an ordered list; current level is `aria-current="page"` and is not a link.
- **Each crumb is a dropdown**, not just a link: clicking "UAE" offers sibling countries. This turns the
  breadcrumb from a back-button into a lateral navigator and removes most of the need for a separate
  scope switcher. High value for low cost.
- On mobile, collapse the middle: `Group › … › Dubai › Al Barsha School`, with the ellipsis opening the
  full trail in a sheet. Never let the trail wrap to three lines or scroll horizontally.
- Announce scope changes in a live region: *"Now viewing Al Barsha School. 8 widgets."*

### 6.4 Guardrails

- `parseScope` returning `null` → a proper 404, never a crash or a blank dashboard.
- A scope the role may not see → 403 from the server, a friendly "you don't have access to this view"
  page on the client. **Test this by hand-editing the URL in an e2e test.**
- A scope with `childLevel === null` renders no matrix and no drill affordances.
- Deleted/renamed org nodes: resolve by id, render by server-supplied label, never trust the label in the URL.

### 6.5 The two drill axes

The client's example: *"I see a comparison of different schools for a complex KPI. Then I click on that
school to view a further breakdown of that KPI. Breadcrumbs would show `comparison > particular selected
school`."*

That is a drill with **one KPI held constant**, which is a different gesture from re-scoping the whole
dashboard. Both exist, and they unify:

| | Matrix navigator | Focus view |
|---|---|---|
| **Query** | children of scope × **many** KPIs | children of scope × **one** KPI |
| **Rendering** | tinted cells | full chart + table + decomposition |
| **Click a row** | drill: append scope segment | drill: append scope segment, **KPI stays pinned** |
| **Rest of dashboard** | re-scopes with it | hidden |

**The focus view is the matrix with one column and a real chart.** Same scope mechanics, same breadcrumb
builder, same drill handler, same cache key plus a KPI id. It is not a separate feature to design — which
is why Phase 8 is short despite this being the client's headline interaction.

URL keeps carrying the state: `/dashboard/emea/uae/sch-1042/seat-utilisation?period=ay-2025&by=location`

**Breadcrumb inside the focus view.** The KPI is the title; the trail is the scope, marked from where the
exploration started:

> **Seat utilisation** · UAE schools › Al Barsha School › Year 9

Entering the focus view from a matrix row sets the entry point to the matrix's scope, which is exactly the
client's `comparison > particular selected school`. Crumbs remain sibling dropdowns (§6.3), so a user can
jump laterally to the next school without going back up — which is the actual behaviour when someone is
working through an underperforming region.

### 6.6 Decomposition — the other meaning of "drill into a complex KPI"

A **composite** KPI (contribution margin = revenue − staff cost − facility cost; cost per student;
value-added) has a second, often more useful drill: *not* "which sub-unit," but **"what made this number."**
A regional manager looking at a margin drop usually wants the cost line that moved, not the school list —
they will get to the school list second.

So the focus view offers up to three breakdown axes, as a segmented control (`?by=`):

| Axis | Shows | Applies to |
|---|---|---|
| **By location** | children of the current scope, ranked | Every KPI |
| **By component** | waterfall / contribution chart of the inputs that produce the metric | Composite KPIs only |
| **Over time** | trend at the current scope, with the comparison period overlaid | Every KPI |

Default per KPI type: composites open on **By component**, simple metrics on **By location**, anything the
user reached by clicking a trend on **Over time**. Declare the default in the registry; don't infer it.

`WidgetDefinition` gains:

```ts
  /** Axes this KPI supports in the focus view. First entry is the default. */
  breakdowns: readonly ('location' | 'component' | 'time')[];
  /** Required when 'component' is offered — the input metrics, in waterfall order. */
  components?: { dataKey: string; label: string; sign: 1 | -1 }[];
```

**Non-hierarchical breakdowns are filters, not scope.** Curriculum, fee tier, intake cohort, subject and
gender are not levels of the org tree — they slice whatever scope you are already at. Keep them in the
query string (`?filter=curriculum:IB`), never in the scope path, and never in the breadcrumb trail. The
moment a non-hierarchical dimension becomes a scope segment, `parseScope` stops being total and the
breadcrumb stops meaning "where am I." This is the top risk in §19; the rule above is the mitigation.

---

## 7. Responsive spec

The ladder each widget type implements. This table is the acceptance criteria for Phase 3.

Thresholds are **336 / 560 / 896** (`VARIANT_MIN_WIDTH` in `lib/viz/variants.ts`). All three are
multiples of the 8px measurement quantum (§15), which is load-bearing rather than tidy: measured widths are
bucketed before they reach the table, so a threshold falling mid-bucket moves. At 340 a container measuring
exactly 340px quantised to 336 and resolved one variant too narrow.

| Widget | `micro` (<336px) | `compact` (336–560) | `standard` (560–896) | `expanded` (≥896) |
|---|---|---|---|---|
| KPI card | value + delta arrow | + sparkline | + sparkline + period label | + mini breakdown |
| Trend (line/area) | headline value + delta, "View chart" | sparkline, no axes | 1–2 series, thinned ticks, no gridlines | full axes, legend, brush |
| Bar / column | top 3 as a labelled list | **horizontal** bars, top 5 + Other | horizontal bars, all | vertical bars, full axes |
| Stacked bar | total + top segment | 100% stacked, 3 segments + Other | full stack, legend | full stack + segment labels |
| Scatter | correlation sentence + "View chart" | binned hexes or top-N | full scatter, **≤3 series** (§11.2) | full + brush |
| **Matrix** | **ranked list, 1 KPI, top/bottom 5** | **ranked list, 1 KPI, all rows** | **4–5 KPI columns, sticky row header** | **full matrix, sortable, virtualised** |
| Table | 2 columns | 3 columns | full, horizontally scrollable | full + sort |

Cross-cutting rules below `standard`:

- Abbreviate numbers (`1.2M`, `847K`), drop axis titles into the card header, drop gridlines, drop the legend in favour of direct labels.
- Thin ticks to first / last / max. **Never rotate labels.**
- Minimum 44×44 CSS px for anything tappable. School names are long — truncate with a title attribute, never wrap to three lines.
- Hit-test by **nearest on the category axis**, never by hitting the mark. Scatter uses nearest-neighbour with a ~24px radius.
- Touch and keyboard drive a **readout strip**, not a floating tooltip. One component, both inputs.
- `prefers-reduced-motion` → animations off.

---

## 8. The matrix navigator

The highest-value and highest-risk component in the product. It gets its own section and its own phase.

### 8.1 It is the navigator, not a widget (D15)

**The matrix always renders the children of the current scope.** At group level the rows are regions; at a
region, countries; at a country, schools; at a school, year groups. Clicking a row drills into it.

This single decision:

- **Bounds the row count at every level** — ~6 regions, ~20 countries, ~30 schools per country. The
  "500-school matrix" problem never arises, because you only ever see one level's children.
- **Unifies the matrix with navigation** — no separate drill UI to design, build, or test.
- Makes the breadcrumb trail and the matrix two views of the same state.

When a level genuinely has many children (a country with 80 schools), add search + top/bottom-N filtering
*within* the level. Virtualise rows regardless (§15).

### 8.2 Structure

- A real `<table>`: `<caption>`, `<th scope="col">` per KPI, `<th scope="row">` per child.
- First column sticky (the child name); header row sticky.
- Sortable columns, `aria-sort` on the active header, sort state in the query string so it is shareable.
- Row click / `Enter` drills. The row name is a link — so middle-click and "open in new tab" work, which
  analysts will absolutely expect.
- Column set is user-configurable and persisted (`prefs.matrix.visibleKpis`), defaulting to two KPIs per pillar.

### 8.3 Cell encoding

Each cell shows **the value and its delta as numbers**, with a **background tinted by `vsBaseline`**.
Colour is secondary; the numbers are always present. This satisfies "never encode by colour alone" by
construction and sidesteps the light-mode contrast warning in §11.1.

```
┌──────────────┐
│  87.4%       │   ← value, text token, primary weight
│  ▲ +2.1pp    │   ← delta, muted, with direction glyph and correct unit (§8.6)
└──────────────┘     background tinted by vsBaseline
```

- **Diverging scale**: two hues with a **neutral gray midpoint at the baseline**. Never a rainbow, never a hue at the midpoint.
- Tint the **cell background**, put the value in a text token — not coloured text on a coloured cell.
- The direction glyph (▲ / ▼ / ●) carries the signal for CVD, print, and `forced-colors`. Mandatory, not decorative.
- Cap intensity: beyond ±1 normalised, clamp. One outlier must not flatten the rest of the matrix.

### 8.4 Baselines — what the colour is measured against

**The client does not yet know whether per-KPI, per-school targets exist.** That is not a blocker, because
the cell renderer never needs to know: it reads `vsBaseline`. Only the *resolver* changes.

Resolution order, per KPI, falling through when unavailable:

| # | Baseline | Answers | Available when |
|---|---|---|---|
| 1 | `target` | *"Who is failing?"* — absolute performance | The client has targets |
| 2 | `prior-period` | *"Who is moving?"* — momentum | Always, except for new schools |
| 3 | `peer-median` | *"Who is behind comparable schools?"* — relative | Always; it is the column you're already rendering |
| 4 | `none` | Value only, no judgement | Fallback |

**These are not degraded substitutes for each other — they answer genuinely different questions,** and
leadership wants all three. So make it a **first-class control in the matrix header**:

> **Compare against:  [ Target ] [ Last year ] [ Peer median ]**

One control, three readings of the same matrix, state in the query string so the view is shareable. This
turns an open question into a product feature, and it makes the POC a **discovery instrument**: demo all
three modes and let the client tell you which one they argue about. That conversation is worth more than
the answer you would have guessed.

Implementation notes:

- The active baseline kind is **always visible** — in the control and in each column header (`vs. target`
  / `vs. AY 2024` / `vs. peer median, n=22`). A number whose baseline is ambiguous is worse than no number.
- Columns may resolve differently: with partial targets, some columns read `vs. target` and others
  `vs. last year` in the same matrix. That is fine and must be labelled per column, not per matrix.
- `prior-period` must use the **comparable prior academic period** (§12.1), not the prior calendar period.
- `peer-median` needs a defensible peer band (§1.5), and `n` must be shown. A median of 3 is not a median.
- **New schools have no prior period.** `baseline.value === null` → no colour, no delta, a "new" chip. Not zero, not red.
- Persist the user's choice in `prefs.matrix.baselineMode`.

If the answer comes back "we have no targets at all," the default becomes `prior-period` and nothing else
in the design changes. That is the point.

### 8.5 Direction handling — the classic bug

`vsBaseline` is computed from the **KPI's** `direction`, never from raw magnitude (D17). Direction is a
property of the metric, so it is required **even when there is no target**:

| Direction | Example | Rule |
|---|---|---|
| `higher-is-better` | Pass rate, seat utilisation | Above baseline → good hue |
| `lower-is-better` | Cost per student, staff turnover | **Above baseline → bad hue.** Colouring rising cost green is the single most likely bug in this component |
| `band` | Student:teacher ratio 12–18 | **Both directions are bad.** Inside band → neutral; outside → bad hue, intensity by distance from the nearer edge |
| `neutral` | Headcount, enrolment mix | No judgement. Show the delta, tint nothing |

Two consequences of the no-targets case:

- **`band` requires an explicit band and cannot be inferred from a trend.** Without one, a ratio KPI
  degrades to `neutral` — show the value and the movement, tint nothing. Guessing that "ratio went down,
  that's good" is exactly how you tell a CFO that understaffing is an improvement. Degrade honestly.
- Under `prior-period`, `higher-is-better` means *"rising is good"*, which is a weaker claim than *"above
  target is good"*. Word the tooltips accordingly — "up 2.1pp on last year", not "above target".

Unit-test all four directions × all four baseline kinds × {above, below, at, `null`}. That matrix of cases
is small, pure, and is where this component will break.

### 8.6 Showing deltas honestly

The client asked for "delta with numbers," and the numbers have a trap in them:

- A pass rate moving 80% → 85% is **+5 percentage points**, not +5 percent. Rendering it as "+5%" is wrong,
  and someone numerate will catch it in the demo. `deltaFormat: 'percentage-points'` exists for this; use
  `pp` as the suffix.
- A rate moving 80% → 85% *is* +6.25% in relative terms. Both framings are legitimate — pick one per KPI,
  label it, never mix them in one column.
- Money deltas are constant-currency by default (§12.2), or the delta is partly FX.
- Always show the delta's **period** somewhere: "+2.1pp vs. AY 2024". A delta without a comparison window is not a fact.
- Suppress deltas below the noise floor for small denominators — a 3-student school going 2/3 → 3/3 is
  "+33pp" and it is meaningless. Show `n` and grey the delta below a configurable threshold.

### 8.7 Responsive ladder

- **`expanded`** — full matrix, all selected KPIs, sortable, virtualised.
- **`standard`** — 4–5 KPI columns (user-selected priority), sticky first column, horizontal scroll *inside the card only*, never the page.
- **`compact`** — **the matrix becomes a ranked list.** One KPI, chosen from a segmented control or select; each row is `name · bar · value · Δ`. Sorted by the selected KPI. This is a better mobile experience than a scrollable grid, not a degraded one.
- **`micro`** — top 5 and bottom 5 for the selected KPI, with "View full matrix" opening the focus view.

The ranked-list variant is the mobile answer to "matrix view of school vs KPI." Do not attempt to render a
grid at 375px; a 12-column matrix on a phone is unreadable at any font size that fits.

### 8.8 Accessibility

- Cell announcement must include row, column, value, delta **and which baseline it is measured against**:
  *"Al Barsha School, pass rate, 87 percent, up 2.1 percentage points on last year."* Build this from
  `a11y.summary`-style helpers, not from `aria-label` strings scattered through JSX.
- `null` cells announce *"not measured"*, never "zero" and never silence.
- Sortable headers are `<button>`s inside `<th>`, with `aria-sort` reflecting current state.
- Keyboard: arrow-key grid navigation is expected by analysts. Implement roving tabindex — one tab stop for
  the table, arrows to move between cells, `Enter` to drill.

---

## 9. Layout engine

```ts
// lib/layout/pack.ts
export interface PackedItem { id: string; colStart: number; colSpan: number; rowSpan: number; }

/**
 * Pure. Ordered widget list + breakpoint → items in FINAL RENDER ORDER with explicit placement.
 *
 * Invariants (assert in tests):
 *  1. Output is a permutation of input that never moves an item backwards past more than `lookahead`.
 *  2. No item exceeds GRID_COLUMNS[breakpoint].
 *  3. DOM order === visual reading order (left-to-right, top-to-bottom).
 *  4. Deterministic: pack(x) === pack(x). NOT idempotent — measured over 2,000 random
 *     dashboards, feeding the output back in settles within 4 passes but is not stable
 *     on the first. That is fine because callers always pass the user's saved order,
 *     never the solver's output; determinism is what SSR hydration actually needs.
 */
export function pack(
  items: { id: string; size: SizeToken; rowSpan: number }[],
  breakpoint: Breakpoint,
  opts?: { lookahead?: number },
): PackedItem[];
```

Greedy row-fill with bounded lookahead: walk the ordered list; if the next item doesn't fit the remaining
columns, look ahead up to `lookahead` (default 2) for one that does; otherwise start a new row. Fills gaps
without letting a widget teleport across the dashboard.

**Banded variant, if Phase 4 runs long:** KPI strip of `sm` widgets flowing densely, then the matrix
full-width, then everything else. Same solver — `lookahead: Infinity` within a band, `0` across bands.
This is also the natural pillar-sectioned layout (§1.1), so it may simply be the right answer.

CSS Grid, `grid-template-columns: repeat(var(--cols), minmax(0, 1fr))`, `grid-auto-rows: ROW_UNIT`.
**`minmax(0, 1fr)` is load-bearing** — without it, chart SVGs and wide tables refuse to shrink and you get
the exact overflow bug in the brief.

---

## 10. Customization UX

- **Picker:** grouped by **pillar** (§1.1), each entry showing its `question`, not just its title. Search.
  Shows "6 of 10 selected" — a soft cap nudges against recreating the clutter. Widgets invalid at the
  current scope level are shown disabled with a reason, not hidden (hiding looks like a bug).
- **Reorder:** primary mechanism is **Move up / Move down** buttons (in the DOM always, visible on focus).
  dnd-kit adds pointer dragging as an enhancement.
- **Announcements:** `aria-live="polite"` — *"Attendance rate moved to position 3 of 8."* Test the string; it's a WCAG deliverable.
- **Undo:** toast with Undo after every add/remove/reorder. Cheap, disproportionately impressive in a demo.
- **Reset to default** — per role — always one click away.
- **Edit mode is a distinct mode** with clear enter/exit, not an always-on drag affordance. Prevents accidental reorders on touch, a real complaint about the current board.
- **Period control is global**, at dashboard level, not per card. Per-card periods triple the card count and bring the clutter straight back.

---

## 11. Chart design standards

Method: pick the form → assign colour by the job it does → **validate with a script, don't eyeball** →
apply mark specs → hover/readout layer → a11y pass → look at it.

### 11.1 Palette — measured finding, action required

The theme currently ships five `--chart-*` tokens in `app/globals.css`. They are a **monochrome teal
sequential ramp** (hue 181–188, L 0.855 → 0.437) sitting in *categorical* slots, identical in light and dark
mode. Converted to hex and run through the categorical validator against this project's actual surfaces:

| Check | Light (`#ffffff`) | Dark card (`#171717`) |
|---|---|---|
| Lightness band | **FAIL** — `#46ecd5` at L 0.854 | **FAIL** — 3 of 5 outside band |
| Chroma floor | **FAIL** — `#00786f`, `#005f5a` read as gray | **FAIL** — same two |
| CVD separation | WARN — worst adjacent ΔE 7.7 (deutan) | WARN — ΔE 7.7 |
| Normal-vision floor | **FAIL** — ΔE 7.9, below the 15 gate | **FAIL** — ΔE 7.9 |
| Contrast vs surface | WARN — 2 slots below 3:1 | WARN — 1 slot below 3:1 |

Two slots are indistinguishable **even to full-colour vision**. Shipping a multi-series chart on these is a
guaranteed audit finding.

**Action (Phase 0):** replace `--chart-1..5` with a validated 8-slot categorical order. This one passes
every hard gate on *this project's* surfaces in both modes:

| Slot | Hue | Light | Dark |
|---|---|---|---|
| 1 | blue | `#2a78d6` | `#3987e5` |
| 2 | orange | `#eb6834` | `#d95926` |
| 3 | aqua | `#1baf7a` | `#199e70` |
| 4 | yellow | `#eda100` | `#c98500` |
| 5 | magenta | `#e87ba4` | `#d55181` |
| 6 | green | `#008300` | `#008300` |
| 7 | violet | `#4a3aa7` | `#9085e9` |
| 8 | red | `#e34948` | `#e66767` |

The dark column is **re-stepped for the dark surface**, not an automatic flip — the current file uses
identical values in both modes, which is why dark fails harder.

Light mode carries a contrast WARN on slots 3, 4, 5 (2.17–2.82:1). That is *dischargeable but not
dismissable*: it obligates visible direct labels or the table view. §5.3 already mandates the table view,
so this is satisfied by construction — but do not remove it.

### 11.2 Measured constraint: scatter caps at 3 series

Categorical palettes are normally validated on *adjacent* pairs, because a legend orders them. Scatter and
bubble charts have no adjacency — any two series can sit side by side, so every pair must separate.
Run against all pairs:

- 3 series — **PASS** both modes (worst normal-vision ΔE 24.0).
- 4 series — **FAIL** light (orange↔yellow ΔE 13.7) and **FAIL** dark (ΔE 10.6; deutan ΔE 4.8).
- 5 series — **FAIL** (magenta↔orange ΔE 12.9).

**The scatter widget is hard-capped at 3 series.** Beyond that → small multiples / facets, not more colours.
Encode as a runtime assertion in the scatter adapter, not a comment.

### 11.3 The matrix diverging scale — derived and measured (Phase 0)

The categorical palette does not apply to matrix cells. Matrix cells are **background tints carrying
text**, so the binding constraint is different: text contrast on the tint, not mark contrast against the
surface. Poles are **blue (above baseline) ↔ red (below baseline)** with the card surface itself as the
neutral midpoint — deliberately not red/green, which is the worst possible pair for the most common CVD and
exactly the pair a school performance matrix invites.

Shipped tokens (`--matrix-pos-*` / `--matrix-neg-*` in `app/globals.css`), measured by
`npm run validate:palette`:

| | level 1 | level 2 | text contrast | arm separation (normal / worst CVD) |
|---|---|---|---|---|
| Light | `#91c1ff` / `#ffa098` | `#62a6ff` / `#ff716b` | 7.38–10.63:1 | 19.7 / 14.1 · 29.1 / 20.9 |
| Dark | `#1d467b` / `#732c2a` | `#215da6` / `#9a3836` | 6.32–9.48:1 | 18.2 / 13.7 · 23.9 / 18.0 |

**Two levels, not three or four — this was a measurement, not a preference.** Keeping text readable caps
how much chroma a tint can carry, and low-chroma colours sit close together. A faint third level measured
ΔE 8.7 between "slightly above" and "slightly below" against a floor of 15: a colour implying a signal it
cannot deliver. So the faintest band became a **deadband** instead (`MATRIX_DEADBAND` in
`lib/viz/palette.ts`): near-baseline cells are not tinted at all, which is also better data-ink — the
matrix only colours what is actually material.

The direction glyph in §8.3 remains mandatory. It is the sole carrier inside the deadband, and the CVD
separation at level 1 (13.7–14.1) sits below the 15 bar even where normal vision clears it.

### 11.4 Non-negotiables

- Categorical hues assigned in **fixed order, never cycled**. A 9th series folds into "Other" or becomes small multiples.
- **Never a dual-axis chart.** Two measures at different scales → two charts, small multiples, or index both to 100. The client's current Power BI board almost certainly has several; being able to name this is credibility in the pitch.
- Sequential = one hue, light→dark. Diverging = two hues + neutral gray midpoint.
- Colour follows the **entity**, not its rank — filtering a series must not repaint the survivors. With regions and schools this matters: "EMEA is always blue" builds a mental model across the whole dashboard.
- Text wears text tokens (`--foreground` / `--muted-foreground`), never the series colour.
- Status colours (good/warning/serious/critical) are reserved and always ship with icon + label.
- Legend present for ≥2 series (none for one — the title names it); ≤4 series also get direct labels.
- Thin marks, 2px lines, ≥8px markers, 4px rounded data-ends on the baseline, 2px surface gap between adjacent/stacked fills, recessive grid and axes.

### 11.5 Keep the validator in the repo

Copy the palette validator to `scripts/validate-palette.mjs` and wire `npm run validate:palette` into CI.
When the client hands over their brand colours — and they will, late — you get an answer in seconds instead
of an argument.

---

## 12. Multinational domain traps

These are the things that make this project different from a generic dashboard. Each one is cheap to design
for now and expensive to retrofit.

### 12.1 The academic calendar is not the calendar (D18)

- **Hemispheres differ.** A group with schools in the UK/UAE and in Australia/South Africa has academic years
  starting in September *and* in January. "This year vs. last year" is not a single date range.
- **Term dates differ by country**, and half-terms and holidays differ within a country.
- **Seasonality dominates.** Enrolment in September vs. August is meaningless; September vs. *last* September
  is the real signal. **Default every comparison to the comparable prior academic period, not the prior
  calendar period.** Week-over-week enrolment deltas will produce garbage, the client will notice, and trust
  in the dashboard will not recover.
- **Term-time-only metrics have legitimate gaps.** Attendance "last week" during summer break is not 0% — it
  is *not applicable*. The period control must know this and say so.

Design: a `lib/calendar` module owning `PeriodRef`, period resolution per scope (because the academic
calendar is a property of the school/country, not the group), and `comparablePriorPeriod(period, scope)`.
Never compute date ranges inline in a widget.

### 12.2 Currency (D19)

- Multinational revenue needs a **reporting currency** and an explicit **FX basis**.
- **Constant currency is the default** for anything strategic. Otherwise a 6% AED move reads as 6% growth,
  and someone makes a decision on it.
- Always label which basis is shown, and expose a nominal toggle for finance users.
- `meta.currency.fxAsOf` is not optional — a number without a rate date is not reproducible, and finance
  will ask.

### 12.3 Missing data is not zero (D20)

Guaranteed in this domain: a school opened this year has no prior-year comparison; some countries don't
report some KPIs; a new KPI has no history; a school with no senior years has no university placement rate.

- `y: null` means **not measured**. Never coerce to 0.
- **Never include nulls in an average or a total.** Show `n` alongside any aggregate.
- Matrix cells render `—` with a `note` explaining why, and announce *"not measured"*.
- A sparse row is not a failing row. Do not let a null sort as the worst value — sort nulls to a stable
  position and say so in the header.

### 12.4 Locale and RTL

- The group very likely operates in the Gulf, so **RTL is a realistic phase-2 requirement.** Full RTL is out
  of scope (§2.2), but do not make it impossible: use logical CSS properties (`margin-inline-start`, not
  `margin-left`), keep the axis-direction assumption in one module, and avoid hardcoded `left`/`right` in
  chart layout. Retrofitting RTL into a chart layer is genuinely painful.
- Number and date formatting through `Intl`, with locale from the user, not the browser default.
- School and region names are long and non-ASCII. Test the layout with a 45-character school name in Arabic
  script — put one in the fixtures deliberately.

### 12.5 Student data is a legal boundary, not a feature flag

Drilling below class level means individual student records: attendance, grades, possibly SEN status. That
is personal data in every jurisdiction this group operates in, and special-category data in some.

**The POC stops at class level.** Getting student-level drill-down right requires DPIA, data minimisation,
role-based field masking, audit logging of who viewed which student, and retention rules — none of which
belongs in a pitch demo, and all of which must be scoped and priced separately. Raise it as a question
(§21.7), not an assumption, and make sure the fixtures contain no student-shaped data at all.

---

## 13. Accessibility plan

### Automated (the SOW checkbox)

- **pa11y-ci** over a URL list: dashboard per role, kitchen-sink, matrix at three scope levels, picker open, focus view. WCAG 2.1 AA.
- **axe-core via Playwright** for the dev loop — better React/ARIA coverage, and reaches interaction states pa11y can't (picker open, mid-reorder, sorted matrix).
- Run both. pa11y satisfies the contract; axe finds the bugs.

**One rule is ignored in pa11y, and contrast is still the most strictly gated thing in
the build.** pa11y's axe runner reports axe's `incomplete` results — "I cannot determine
the background" — as errors. Measured on `/dashboard`: `@axe-core/playwright` reports
**0 violations, 1 incomplete (color-contrast)** where pa11y reports **20 errors**,
including near-black text on white. axe cannot resolve a single background for a matrix
cell whose tint arrives as an inline custom property. Contrast is instead gated by
`npm run validate:palette`, which measures every token pair numerically in both modes,
and by the zero-violations assertion in Playwright. The justification is written into
`.pa11yci.json` beside the ignore so it cannot quietly become a habit.

**Colour tokens are hex, not `oklch()`.** Tailwind v4's `oklch()` authoring resolves to
computed `lab()`/`oklab()` values, which axe 4.11 cannot evaluate at all — it flagged
even black-on-white. Converting the tokens to hex fixed the tooling rather than
suppressing it, and removed ~90% of the pa11y findings before the ignore above was
needed for the remainder.

### What automation cannot catch — budget one manual day

| Risk | Mitigation |
|---|---|
| Canvas chart invisible to SRs | Hidden `<table>` + summary (§5.3) — mandatory per widget |
| SVG read as 400 path elements | `role="img"` + `aria-label` on wrapper, `aria-hidden` on internals |
| Matrix unusable without a mouse | Roving tabindex + arrow navigation + `aria-sort` (§8.6) |
| Reorder unusable without a mouse | Move up/down buttons + live region (§10) |
| Drill-down state change unannounced | Live region on scope change (§6.3) |
| Meaning carried by colour alone | Value always in the cell + direction glyph (§8.3) |
| Focus lost on drill, or on widget removal | Move focus to the new scope heading / next widget; assert in e2e |
| Motion sickness | `prefers-reduced-motion` → animations off |

**Manual pass:** NVDA on Windows, keyboard-only traversal of every flow *including a full drill-down and
back*, 200% zoom, and forced-colors mode. Schedule in Phase 8, not "later."

Criteria this project will be judged on: **1.4.11** (non-text contrast ≥3:1), **2.5.7** (dragging has a
non-drag alternative), **2.5.8** (target size), **1.4.10** (reflow at 320px, no 2-D scrolling — the matrix
is the risk), **4.1.3** (status messages), **2.4.8** (location — the breadcrumb is the answer).

---

## 14. Testing plan

### The shape of 80%

Don't chase the number through chart internals — you'll write brittle snapshots and delete them in a month.
Push logic into pure functions and test those hard.

**Tier 1 — pure logic, target 95–100%.** Where the bugs actually live:
`resolveVariant`, `pack`, `parseScope`/`serialiseScope` (property-tested round-trip), breadcrumb builder,
**baseline resolution and matrix cell derivation across 4 directions × 4 baseline kinds × null**,
**delta formatting (percent vs. percentage points, noise floor)**, tick reduction, formatters, LTTB,
**`comparablePriorPeriod` across hemispheres**, **constant-currency conversion**, prefs reducer, prefs
migrations, envelope schemas, `a11y.table` builders, palette assertions.

**Tier 2 — components, target ~75%.** RTL with an injected container size:

```ts
render(<MatrixNavigator width={320} {...props} />);
expect(screen.getByRole('listbox', { name: /KPI/ })).toBeInTheDocument();  // ranked list, not a grid
expect(screen.queryByRole('table')).not.toBeInTheDocument();
```

This works *because* variant resolution reads from context rather than the DOM. jsdom has no layout, so any
test depending on a real `ResponsiveContainer` measuring itself renders a 0×0 chart and asserts nothing.
Mock `ResizeObserver` once in `tests/setup.ts` and never think about it again.

**Tier 3 — contract tests over the registry.** One `describe.each(registry)` asserting, per widget: schema
parses the fixture; every declared variant renders without throwing; `a11y.summary` is non-empty;
`a11y.table` column count matches row arity; `size` is valid at every breakpoint; **`validAtLevels` names
only levels the fixture hierarchy actually contains**. ~70 lines, scales with every new widget.

**Tier 4 — e2e (Playwright), not counted in coverage.**
Drill group → region → country → school and back via breadcrumb; deep-link to a leaf scope on a cold load;
**hand-edit the URL to an unauthorised scope and assert 403** (§6.4); keyboard-only reorder; keyboard-only
matrix navigation and drill; add widget → reload → still there; visual regression at 375/768/1440 against
kitchen-sink and the matrix at two levels.

### Gates (set in CI from day one — never retrofit a coverage gate)

```jsonc
// vitest.config.ts — coverage.thresholds
{
  "global":                  { "lines": 80, "functions": 80, "branches": 75, "statements": 80 },
  "lib/**":                  { "lines": 95, "functions": 95, "branches": 90, "statements": 95 },
  "components/dashboard/**": { "lines": 80 },
  "components/scope/**":     { "lines": 80 },
  // excluded: app/(demo)/**, lib/data/fixtures/**, **/*.stories.tsx, tests/**
}
```

Excluding demo code is not cheating — it's the §0 rule expressed in config. Document the exclusion list in
the PR that adds it so nobody thinks it drifted there.

### .NET side (for the real project)

coverlet with a build-failing threshold; thin controllers, logic in services; **scope-authorisation tests as
a first-class suite** (every role × every level × allowed/denied); contract tests asserting the JSON envelope
matches the TypeScript types — generate TS from OpenAPI so drift is a compile error.

---

## 15. Performance plan

Budgets, enforced by Lighthouse CI on the dashboard route:

| Metric | Budget | Why it bites here |
|---|---|---|
| LCP | < 2.5s | Charts and the matrix block it if in the critical path |
| **INP** | **< 200ms** | **The real risk — matrix sort, drill, and resize all re-render everything** |
| CLS | < 0.05 | Widgets appearing after data lands |
| Initial JS | < 220KB gzip | Recharts alone is ~100KB+ |
| Chart lib bytes on first load | 0 | Must be dynamically imported |

Tactics:

- `next/dynamic` every chart adapter. **Never ship Chart.js and Recharts in the same bundle** — if S1 says you need both, split by route or widget chunk and verify with `@next/bundle-analyzer`.
- **Virtualise matrix rows** (TanStack Virtual). A country with 80 schools × 12 KPIs is ~1,000 cells; don't render what isn't visible.
- **Memoise matrix cell derivation** on `(value, target)` — it runs per cell per render and is pure, so it caches trivially.
- **Debounce the ResizeObserver** (~100ms trailing) and quantise width to 8px buckets before it reaches the variant resolver. Without this, a window drag triggers hundreds of re-renders and INP dies. **The #1 perf bug in this architecture — build it into `useContainerSize` from the start.**
- IntersectionObserver: don't mount offscreen widgets; render a sized skeleton so CLS stays flat.
- **Prefetch children on row hover/focus** so drilling feels instant; cache by `scope + period` so drilling back up is free.
- Downsample server-side (LTTB) with a `maxPoints` hint. Fewer points is faster *and* fixes overplotting.
- `content-visibility: auto` on below-the-fold widget shells.
- Memoise on the envelope reference, not deep-equality of series arrays.

---

## 16. Future .NET contract

Design the POC's Route Handlers to *be* this, so the swap is a base URL.

```http
POST /api/dashboard/data
{
  "scope":  ["emea", "uae", "dubai", "sch-1042"],
  "period": { "kind": "academic-year", "id": "ay-2025" },
  "compare":{ "kind": "prior-academic-year" },
  "widgets": [
    { "dataKey": "enrolment.trend",   "params": { "granularity": "month" }, "maxPoints": 480 },
    { "dataKey": "retention.current", "params": {} }
  ]
}

200 → { "results": { "enrolment.trend": <DataEnvelope>, "retention.current": <DataEnvelope> },
        "errors":  { } }
```

```http
GET /api/dashboard/matrix?scope=emea/uae&period=ay-2025&kpis=seatUtil,passRate,stRatio
                          &baseline=target|prior-period|peer-median      # falls back per column (§8.4)
200 → <MatrixEnvelope>          # rows = children of the scope (D15)

GET /api/dashboard/peer-context?scope=emea/uae/sch-1042&kpis=passRate&period=ay-2025
200 → { passRate: { value, rank, n, band: { label, median, q1, q3 }, peersNamed: false } }
      # Powers the principal view (§1.5). The server decides whether peers are named — NEVER the client.

GET /api/dashboard/scope?scope=emea/uae
200 → <ScopeNode>               # children, labels, childLevel, canDrill

GET /api/dashboard/catalog      # role-scoped widget list (§1.4)
GET|PUT /api/dashboard/prefs    # implements PrefsRepository, keyed by user + role
```

Rules:

- **One batched call per dashboard**, not N. Twelve round trips over mobile latency is the difference between a fast dashboard and a slow one.
- Partial failure is normal: one widget erroring returns an entry in `errors` and does not fail the response. The shell renders a per-widget error state.
- **Every endpoint re-validates scope against the caller's role.** No exceptions, no "the client already checked."
- Server owns aggregation, downsampling, FX conversion, academic-period resolution, and target lookup. **The client never does statistics and never converts currency.**
- `ETag` + `Cache-Control`; KPI data is stale-tolerant. Say how stale via `meta.asOf` and show it in the UI.
- Publish OpenAPI; generate the TS types. Hand-maintained duplicates drift.

---

## 17. Phased execution

~17 focused days. Each phase has a hard exit criterion; don't start the next until it's met.

### Phase 0 — Foundation ✅ COMPLETE (2026-09-25)

- Vitest + RTL + jsdom + v8 coverage, thresholds wired and **failing the build**.
- `tests/setup.ts`: `ResizeObserver`, `matchMedia`, `IntersectionObserver` mocks.
- Playwright + axe; pa11y-ci config; Lighthouse CI config with §15 budgets.
- GitHub Actions: typecheck → lint → unit+coverage → build → e2e → a11y → LHCI.
- `.gitattributes`, `.nvmrc`, `.env.example` (§20).
- **Replace `--chart-*` per §11.1; derive and validate the diverging matrix ramp per §11.3**; add `scripts/validate-palette.mjs` + `npm run validate:palette` to CI.

**Exit: met.** `npm run ci` is green (typecheck · lint · palette · 13 tests at 100% · build).
Both failure modes verified rather than assumed: deleting the test drops coverage to 0%
and fails the gate, and adding an untested file to `lib/` drops it to 89.65% and trips
the `lib/**` 95% threshold — so the gate cannot be gamed by adding uncovered code.
`npm run e2e` (9 tests, 3 viewports), `npm run a11y` and `npm run lhci` all pass locally.

Two things worth knowing came out of it:

- **The a11y gate earned its keep on first run.** It failed immediately on
  `document-title` — the scaffold had no `<title>`, a WCAG 2.4.2 Level A failure. Fixed
  with a `metadata` export in `app/layout.tsx`.
- **The shipped chart palette was worse than §11.1 assumed, and is now measured in CI.**
  `npm run validate:palette` parses the tokens out of `globals.css`, so it can never
  drift from what renders. It also asserts the scatter budget is *tight* — that a 4th
  slot genuinely fails all-pairs — so `SERIES_BUDGET.all` can't silently go stale.

### Phase 1 — Domain fixtures (1d)

- Seeded synthetic org tree: 3 regions, ~8 countries, ~40 schools, non-uniform depth, **including a cluster-less country and a school with no senior years**.
- **A southern-hemisphere country** with a January academic year, and a school opened this year with no prior-year data.
- A deliberately long, non-ASCII school name (§12.4).
- KPI values per §1.2 with directions and **deliberate nulls**.
- **Targets for only *some* KPIs**, deliberately — the mixed case is the realistic one and the one that breaks per-column baseline labelling (§8.4). Include one `band` KPI with a band and one without.
- At least one **composite KPI with its components** (contribution margin → revenue, staff cost, facility cost) so the waterfall axis has something real to render (§6.6).
- Peer bands assigned to schools so `peer-median` and the principal's anonymised rank are computable (§1.5).
- `lib/calendar` + `lib/money` with their Tier-1 tests.

**Exit:** fixtures exercise every trap in §12, and `comparablePriorPeriod` is correct for both hemispheres.

> Do this *before* the UI. Fixtures that only contain the happy path will hide every bug in §12 until integration.

### Phase 2 — Scope & primitives (2d)

- `lib/scope`: `ScopeRef`, parse/serialise (property-tested round-trip), breadcrumb builder, role roots.
- `app/(dashboard)/[[...scope]]` routing; `useScope`; 404/403 handling.
- `Breadcrumbs` with sibling dropdowns (§6.3) + live-region announcements.
- `useContainerSize` — debounced, 8px-quantised, SSR-safe; `ContainerSizeProvider`; `resolveVariant`.
- `WidgetShell`, `lib/viz` formatters, `lib/a11y` table builder + `VisuallyHidden`.

**Exit:** you can navigate the fixture tree by URL alone, breadcrumbs track correctly, a stub widget renders four variants purely by injected width. Tier-1 coverage ≥95%.

### Phase 3 — Registry & KPI cards (1d)

- `WidgetDefinition` types + zod schemas + registry; ESLint chart-lib import ban.
- Pillar-based KPI cards with period + comparison, on fixtures.
- Kitchen-sink route; **Tier-3 contract test**.

**Exit:** adding a widget touches exactly one file and the contract test picks it up automatically.

### Phase 4 — The matrix navigator (2.5d)

*The highest-risk component — give it real time.*

- **`lib/matrix` baseline resolver first** (§8.4): target → prior period → peer median → none, per column, with the resolved kind surfaced. Tier-1 tested before any JSX exists.
- Cell derivation: all four directions × all four baseline kinds × nulls, with clamping (§8.5).
- Delta formatting incl. percentage points and the small-denominator noise floor (§8.6).
- **The "Compare against" control**, state in the query string, choice persisted in prefs.
- Virtualised table, sticky headers, sorting with `aria-sort`, roving tabindex + arrow keys.
- Row links that drill (and open in a new tab).
- All four responsive variants (§8.7), including the ranked-list mobile form.

**Exit:** drill from group to school entirely through the matrix, keyboard-only, at 375px and 1440px, and
switch all three baselines on a fixture set where **targets exist for only some KPIs** — the mixed case is
the one that breaks the header labelling.

### Phase 5 — Chart adapters & widgets (2d)

*Gated on spike S1.*

- Adapters: `<LineChart>`, `<BarChart>`, `<StackedBar>`, `<ScatterChart>`, `<Sparkline>` — chart-neutral props.
- Shared readout strip (touch + keyboard). Hit-testing per §7. Scatter 3-series assertion (§11.2).
- Widget set to ~10 across all three pillars, with `validAtLevels` set honestly.

**Exit:** every cell of the §7 table is implemented and visible on kitchen-sink. Visual baselines at 375/768/1440.

### Phase 6 — Layout engine (1.5d)

- `pack()` with the four invariants as property-based tests (fast-check earns its keep here).
- `DashboardGrid`; DOM order = visual order; per-breakpoint columns; `minmax(0, 1fr)`.
- Pillar-banded layout.

**Exit:** invariants pass; no horizontal page scroll at 320px anywhere; resizing never reorders unpredictably.

### Phase 7 — Customization & roles ✅ COMPLETE (2026-09-25)

- Picker grouped by pillar, scope-aware disabled states.
- Reorder: buttons + live region; dnd-kit enhancement.
- Prefs reducer, validation, v1→v2 migration test, `LocalStoragePrefsRepository`, **per-role prefs**.
  *(zod was specified and then dropped: a validation library for a four-field schema that
  parses in the browser is bundle cost with no safety gain, and the tests pin the
  behaviour either way.)*
- Three role presets + the demo role switcher; edit mode; undo toast; reset.

**Exit: met.** `tests/e2e/customize.spec.ts` drives add, remove, reorder, undo, reset and
reload-persistence with `page.keyboard` only — the file contains no `.click()` and no
`page.mouse`. It also runs axe against the open picker. 6 flows × 3 viewports.

### Phase 8 — Focus view & hardening ✅ COMPLETE (2026-09-25)

- `[[...scope]]/[widgetId]` focus route: full-viewport, `expanded` variant, table toggle, CSV export. Deep-linkable; Escape and Back restore focus.
- **The three breakdown axes (§6.6):** By location (reuses the matrix drill), Over time, and By component as a waterfall for at least one composite KPI — contribution margin is the obvious demo.
- **Focus-view breadcrumb with entry point** (§6.5) — `Seat utilisation · UAE schools › Al Barsha School`, crumbs still sibling dropdowns so a user can walk laterally across schools without going back up.
- axe sweep across all interaction states; **manual NVDA + keyboard-only + 200% zoom + forced-colors**.
- Bundle analysis; dynamic-import verification; INP measured under a window-resize drag *and* a matrix sort.
- pa11y-ci green.

**Exit: met, with one item explicitly NOT done.**
All §15 budgets green, zero axe violations across three viewports plus forced-colours,
dark mode and 320px reflow. pa11y 5/5.

**The manual screen-reader pass has not been run, and could not be.** NVDA's speech
output is not observable from a test runner, and simulating it would test the simulation.
`docs/accessibility-manual-pass.md` is the prepared script — it is the deliverable this
phase produces, and a person still has to execute it. Budget half a day.

**Route correction.** §4 sketched the focus view as `dashboard/[[...scope]]/[widgetId]`,
which Next cannot express: an optional catch-all must be the final segment. Shipped as
`focus/[widgetId]/[[...scope]]`, which keeps both the widget and the full scope in the URL.

### Phase 9 — Demo polish (1.5d)

- **Narrative fixture data** — the numbers must tell a story a CFO would react to. One underperforming region, one school that turned around, one KPI where the group is quietly losing ground. Random noise demos badly.
- Empty / loading / error / not-measured states, because the client will click into them.
- README: run instructions, architecture diagram, the 5-minute demo script.
- **The before/after page** — cluttered original vs. revamp. This is what wins the pitch.

**Exit:** a dry run on a real phone over a real network, completed without apology.

---

## 18. Spikes — run in Phase 0, timeboxed

| # | Question | Timebox | Unblocks |
|---|---|---|---|
| S1 | Recharts vs Chart.js after LTTB to ~500 points on the worst realistic dataset | 3h | **D6.** If Recharts holds, delete Chart.js — one library, better a11y, smaller bundle |
| S2 | Vitest + Next 16 + React 19 + RTL; does `next/dynamic` behave under test? | 2h | D9; fallback is Playwright component tests |
| S3 | Tailwind v4 `@container` + `useContainerSize` — do CSS and JS agree on the breakpoint? | 1h | Whether variant switching needs JS for the pure-CSS cases |
| S4 | dnd-kit under React 19 | 1h | Phase 7 fallback: buttons-only (the a11y-primary path regardless) |
| S5 | Recharts SVG + `role="img"` + hidden table — what does NVDA actually announce? | 2h | Validates the §5.3 bet before 10 widgets depend on it |
| **S6** | **Virtualised sticky-header table: TanStack Virtual vs. plain CSS `position: sticky` at 80 rows × 12 cols. Does sticky survive virtualisation?** | **3h** | **Phase 4. Sticky + virtual is a known-awkward combination; find out before building on it** |
| **S7** | **Next 16 catch-all routing + scope state: does `[[...scope]]` give clean back-button behaviour and cheap client-side drill?** | **2h** | **D14. Read `node_modules/next/dist/docs/` first** |

Record each outcome under a "Spike results" heading in this file. A spike with no recorded decision was a waste of time.

### Spike results

**S2 — Vitest + Next 16 + React 19 + RTL — ✅ RESOLVED, D9 stands.**
Works, with one substitution. `@vitejs/plugin-react` (the Babel one the Next guide
recommends) cannot be installed: it pulls `@babel/core@8.0.0-rc` via
`@rolldown/plugin-babel`, which conflicts with the Babel 7 that `shadcn` pins as a
*runtime* dependency. **Use `@vitejs/plugin-react-swc`** — no Babel, faster, same result.
Also: Vite now resolves tsconfig `paths` natively (`resolve.tsconfigPaths: true`), so
`vite-tsconfig-paths` is not needed despite the Next guide listing it.
`next/dynamic` under test is **still unverified** — nothing dynamically imports yet.
Re-check at Phase 5 when the chart adapters land.

**Unplanned finding — ESLint 10 is ahead of the ecosystem.** The scaffold shipped
`eslint@10` with `eslint-config-next@16.3.4`, whose bundled `eslint-plugin-react@7.37.5`
supports `eslint@^9.7` and calls the `context.getFilename` API that ESLint 10 removed.
`npm run lint` crashed on any file with a component. **Pinned to `eslint@^9`** — the
supported combination. This was broken before Phase 0 started; nothing in the repo had
ever run lint.

**S4 — dnd-kit under React 19 — ✅ CLOSED, not run, and deliberately so.**
The spike existed to de-risk drag-and-drop as an *enhancement* over the buttons. Once the
buttons were built and the keyboard-only e2e passed, dnd-kit would add a dependency and a
second interaction path for zero accessibility gain — dragging is the mechanism WCAG 2.5.7
requires an alternative *to*, and the alternative is the primary here. Revisit only if
users ask for it in testing.

**S1, S3, S5, S6, S7 — still open.** S1 and S5 need chart libraries (Phase 5), S3
needs a container-query component (Phase 2), S6 needs the matrix (Phase 4), S7 needs the
scope routes (Phase 2). None blocks the phase they sit before. **S7 is the one to run
early** — it decides D14, and D14 is load-bearing for the whole scope model.

---

## 19. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Non-hierarchical dimensions leaking into the scope path** | **High** | *Confirmed hierarchical (§21.2), so the tree is safe — but curriculum, cohort and subject will still be asked for.* They are filters (`?filter=`) or focus-view breakdown axes (§6.6), never scope segments. The day one becomes a segment, `parseScope` stops being total and the breadcrumb stops meaning "where am I" |
| **"Complex KPI" turns out to mean composite, and decomposition is the real ask** | Medium | §6.6 builds the `component` axis as a first-class breakdown. Confirm which KPIs are composite in discovery and populate `components` in the registry |
| Client insists on full analytical parity on mobile | High | Renegotiate with the §7 ladder as the concrete proposal. "Mobile = curated summary, desktop = exploration" |
| Picker offers 60 KPIs → clutter recreated | High | Pillar rule (§1.1); soft cap; `question` field forces justification per widget |
| **Student-level drill-down assumed to be in scope** | **High** | §12.5 — raise as a legal/commercial question before it becomes an expectation |
| ~~Targets don't exist~~ — **mitigated** | Low | *Was the top design risk. D21 makes baseline polymorphic and user-switchable (§8.4), so "we don't have targets" now changes a default, not a design. Residual risk is only that `band` KPIs degrade to `neutral` without an explicit band* |
| **Delta arithmetic wrong in the demo** (percent vs. percentage points, FX-inflated money deltas, tiny denominators) | Medium | §8.6. A numerate client catches this in the first five minutes and it costs more credibility than a missing feature |
| POC code ships to production unhardened | High | §0 directory rule + per-directory coverage gates from day one |
| Academic-calendar complexity discovered late | Medium | Phase 1 fixtures include both hemispheres; `lib/calendar` exists before any widget |
| Matrix perf at a large level (80+ children) | Medium | S6 + virtualisation + search/top-N within level |
| Coverage gamed to hit 80% | Medium | Tier structure + registry contract test; review the exclusion list in PRs |
| Chart.js canvas blocks a11y sign-off | Medium | S1 may delete it; §5.3 hidden table covers it otherwise |
| Next 16 breaking changes vs. tooling assumptions | Medium | `AGENTS.md` rule; S2 and S7 |
| Resize thrash destroys INP | Medium | Debounce + quantise in `useContainerSize` from the start |
| Drag-and-drop fails the WCAG audit | Medium | Buttons primary, drag enhancement only |
| RTL requested in phase 2 | Medium | Logical CSS properties now (§12.4); full RTL out of scope but not blocked |
| Client brand palette fails validation | Low | `npm run validate:palette` gives a measured answer in seconds |

---

## 20. Multi-machine workflow

This repo moves between a personal machine and a work machine via GitHub.

- **Never commit client data.** All fixtures synthetic, seeded PRNG, invented names. **No student-shaped data at all** (§12.5), not even fake — it sets the wrong precedent and it will get copied.
- **Check git identity per clone.** `git config user.email` — the work machine commits under the work address. `includeIf` in `~/.gitconfig` makes this automatic per directory.
- **`.gitattributes`** with `* text=auto eol=lf` — prevents CRLF churn and Prettier fighting itself across machines.
- **`.nvmrc` + `engines`** — pin the Node major. `package-lock.json` is committed; always `npm ci` on the second machine, never `npm install`.
- **`.env.example` committed, `.env.local` ignored.** The POC's only env var should be `NEXT_PUBLIC_API_BASE_URL` — exactly the switch that swaps fixtures for the real .NET API.
- **No absolute paths** in any config. Use the `@/` alias (already in `tsconfig.json`).
- **Branch:** local is `master`, intended default is `main`. Reconcile before the first push, and add a remote — there is none configured yet.
- **When this becomes the client repo:** decide whether to squash history or start fresh. If the client requires clean IP provenance, start fresh and port `lib/` as an initial commit.

---

## 21. Open questions for the client

Ask before Phase 4 — the answers change what gets built. **Answered so far** is recorded inline; three of
these are now settled enough to build against.

1. **What is the exact org hierarchy, and where is it not uniform?** Ask for the real tree, including the exceptions. "Region → Country → School" is never the whole truth.
2. ✅ **Is drill-down purely hierarchical?** — **Yes, confirmed.** The scope tree is safe.
   *Residual:* when curriculum / cohort / subject are eventually requested, they are filters or focus-view
   breakdown axes (§6.6), never scope segments. Get agreement on that boundary before it is tested.
3. ✅ **Do targets exist per KPI per school?** — **Unknown, and no longer blocking.** Baseline is
   polymorphic and user-switchable (D21, §8.4): target → prior period → peer median → none.
   *Residual, and worth asking as three separate questions:* (a) do any KPIs have agreed targets today?
   (b) are targets set per school or group-wide? (c) for the band KPIs — student:teacher ratio, class fill
   — is there an agreed acceptable range? Without (c) those KPIs can only show movement, not judgement (§8.5).
4. **Which three questions should the homepage answer — one per pillar?** If nobody can name them, that is the most valuable finding of discovery.
5. ✅ **Do principals see other schools, ranked?** — **Leaning yes, ranking without detail.** Built as a
   role setting defaulting to `anonymised-band` (D23, §1.5).
   *Residual, and these are the ones that decide whether it works:* (a) what defines a fair peer band —
   size, curriculum, fee tier, market maturity? (b) rank on attainment or on progress? (c) is the intent
   motivational or evaluative — i.e. does a principal's rank reach their appraisal? If it does, expect the
   measured number to improve faster than the underlying outcome, and rank on a balanced set rather than
   one headline metric.
6. **How many roles, really, and what does each root at?** The §1.4 table is a guess. Confirm before building the catalog.
7. **Is student-level drill-down expected?** If yes: that is a separate, separately-priced workstream with a DPIA (§12.5). Surface it now.
8. **Reporting currency and FX policy?** Constant or nominal by default, which rate source, revalued how often (§12.2).
9. **Academic calendars in play — which countries, which hemispheres, which term structures?** Drives `lib/calendar` (§12.1).
10. **What is the real data volume and freshness?** Worst case, not average. Drives S1, downsampling, and caching.
11. **Brand palette and accessibility standard?** WCAG 2.1 AA assumed. Get hexes early and validate before design work starts (§11.5).
12. **Is Arabic / RTL on the roadmap?** Cheap to accommodate now, expensive later (§12.4).
