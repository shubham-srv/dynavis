# DynaVis — POC Implementation Plan

**Status:** draft v1 · 2026-09-23
**Reasoning record:** [discussion.md](discussion.md)
**Repo role:** POC demo for the client pitch **and** the architectural base for the real client project.

---

## 0. The dual mandate (read this first)

This repo has two jobs that pull in opposite directions:

1. **Demo** — convince the client the new UX is better. Wants speed, fake data, polish.
2. **Foundation** — become the real project. Wants contracts, tests, rigour.

Resolve the tension with one rule, enforced by directory:

| Directory | Standard | Survives into the client project? |
|---|---|---|
| `lib/`, `hooks/`, `components/dashboard/`, `components/charts/` | Production-grade. Typed, tested, reviewed. | **Yes — this is the product.** |
| `components/widgets/` | Production-grade shell, demo-grade content. | Shells yes, fixtures no. |
| `app/(demo)/`, `lib/data/fixtures/` | Throwaway. Zero test requirement. | **No — deleted at kickoff.** |

Coverage thresholds (§10) are set per-directory to match. If you can't tell which bucket a file is in, it goes in the production bucket.

> **⚠️ Never commit real client data.** This is a personal machine and the repo will be pushed to GitHub. All fixtures are synthetic and generated from a seeded PRNG. See §16.

---

## 1. Scope

### In scope for the POC

- One dashboard route with ~8–10 widgets covering the full variant ladder: KPI cards, line/area trend, bar/column, stacked bar, scatter, and one data table.
- Full responsive behaviour across mobile / tablet / desktop, driven by **container size**, not viewport.
- Widget picker (add/remove) + reordering (keyboard-first, drag as enhancement) + persistence.
- Focus/drill-in view.
- A kitchen-sink route rendering every widget at every variant.
- CI green: typecheck, lint, unit coverage gate, Playwright e2e, axe + pa11y-ci, Lighthouse budgets.

### Explicitly out of scope

- The .NET backend. The POC ships **Next.js Route Handlers that mimic the future .NET contract exactly** (§12), so the swap is a base-URL change.
- Auth, multi-tenancy, RBAC, real-time updates.
- Export to PDF/PowerPoint, scheduled email digests, alerting.
- Cross-widget filtering / drill-through chains. *(Flag to the client — this is often the thing they actually miss from Power BI. Scope it separately.)*
- Theming beyond light/dark.

### Definition of done

The POC is done when a stranger can be handed the URL on a phone and a laptop, and:

1. The default dashboard is legible and useful on both without pinch-zoom or horizontal scroll.
2. They can add, remove and reorder widgets using **only a keyboard**, and the change survives a reload.
3. Every chart can be read as a table.
4. CI is green including the a11y and perf gates.
5. `npm run demo:script` (or the README) walks the presenter through the 5-minute pitch.

---

## 2. Decisions (ADR-lite)

| # | Decision | Choice | Why | Revisit when |
|---|---|---|---|---|
| D1 | Responsive strategy | Variant substitution keyed on container width | Shrinking charts is unwinnable; substitution is declarative and testable | Never — this is the core bet |
| D2 | Size source | `ResizeObserver` context + Tailwind v4 `@container` | Widget width ≠ viewport width; context makes it test-injectable | — |
| D3 | Layout model | Ordered list + size tokens; pure packing solver | Freeform x/y is weeks of work, a11y-hostile, and not what users want | Client explicitly demands freeform canvas |
| D4 | DOM order | Always equals visual order (no `grid-auto-flow: dense`) | Tab/reading order correctness | Never |
| D5 | Reorder UX | Move up/down buttons primary, dnd-kit secondary | WCAG 2.5.7; DnD alone fails audit | — |
| D6 | Chart libs | **Recharts default. Chart.js only if spike S1 proves it's needed.** | SVG = testable + accessible; canvas is a black hole | After S1 (§14) |
| D7 | Chart data contract | Chart-neutral envelope, never library-shaped | Lets D6 be reversed without touching widgets | Never |
| D8 | A11y baseline | Every widget ships a hidden `<table>` + text summary | Solves SR access, mobile fallback, and testability at once | Never |
| D9 | Test runner | Vitest + RTL + jsdom (not Jest) | ESM/Next 16 friction is lower; speed matters for a coverage gate | After S2 |
| D10 | Mock backend | Next Route Handlers mirroring the .NET contract | Swap = base URL change; MSW only inside tests | .NET API exists |
| D11 | Persistence (POC) | `localStorage`, versioned + zod-validated, behind a repository interface | Same interface the .NET user-prefs endpoint implements later | .NET API exists |
| D12 | Palette | Replace shadcn's default `--chart-*` (see §8 — it currently fails validation) | Measured, not assumed | Client brand palette arrives |

> **Next 16 warning.** Per `AGENTS.md`, this Next version has breaking changes vs. what most tooling and docs assume. **Read `node_modules/next/dist/docs/` before writing any routing, caching, or data-fetching code.** Do not copy App Router patterns from memory or blog posts.

---

## 3. Repo structure

```
app/
  (dashboard)/
    page.tsx                  # the default dashboard
    [widgetId]/page.tsx       # focus / drill-in view (route-based → linkable, back button works)
  (demo)/
    kitchen-sink/page.tsx     # every widget × every variant — a11y + visual test target
    variants/page.tsx         # single widget in a resizable frame, for design review
  api/dashboard/              # fake .NET — mirrors §12 contract exactly
components/
  ui/                         # shadcn / base-ui primitives (untouched)
  dashboard/                  # DashboardGrid, WidgetShell, WidgetPicker, ReorderControls, FocusView
  charts/                     # library adapters: <LineChart>, <BarChart>, <ScatterChart>, <Sparkline>
  widgets/                    # concrete widgets, each = registry entry + renderer
lib/
  registry/                   # widget definitions, types, zod schemas
  layout/                     # size tokens, packing solver, breakpoints
  viz/                        # variant resolution, tick reduction, formatters, LTTB, palette
  a11y/                       # data-table builder, summary generator, live-region helpers
  data/                       # client, envelope types, fixtures (seeded PRNG)
  prefs/                      # prefs reducer, migrations, repository interface
hooks/
  use-container-size.ts
  use-dashboard-prefs.ts
  use-reduced-motion.ts
tests/
  setup.ts                    # ResizeObserver + matchMedia mocks
  e2e/                        # Playwright: flows, visual regression, axe
  a11y/                       # pa11y-ci config + URL list
```

---

## 4. The core contracts

Write these **first**, before any chart code. Everything else consumes them.

### 4.1 Size and variants

```ts
// lib/layout/tokens.ts
export const BREAKPOINTS = { mobile: 0, tablet: 768, desktop: 1280 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

/** Columns available at each breakpoint. Mobile is 1 on purpose. */
export const GRID_COLUMNS: Record<Breakpoint, number> = { mobile: 1, tablet: 6, desktop: 12 };

export type SizeToken = 'sm' | 'md' | 'lg' | 'xl';
export const COL_SPAN: Record<Breakpoint, Record<SizeToken, number>> = {
  mobile:  { sm: 1, md: 1,  lg: 1,  xl: 1  },
  tablet:  { sm: 2, md: 3,  lg: 6,  xl: 6  },
  desktop: { sm: 3, md: 6,  lg: 8,  xl: 12 },
};

/** Row height unit in px; a widget declares rowSpan per size token. */
export const ROW_UNIT = 88;
```

```ts
// lib/viz/variants.ts
export type Variant = 'micro' | 'compact' | 'standard' | 'expanded';

/** Container width → variant. Pure. Test this exhaustively; it drives everything. */
export function resolveVariant(width: number, supported: readonly Variant[]): Variant { /* ... */ }
```

### 4.2 The widget definition

```ts
// lib/registry/types.ts
export interface WidgetDefinition<TParams = unknown> {
  id: string;
  title: string;
  /** The single question this widget answers. If you can't write it, cut the widget. */
  question: string;
  category: 'revenue' | 'operations' | 'quality' | 'people';

  /** Declared footprint. The layout solver reads only this. */
  size: Record<Breakpoint, { token: SizeToken; rowSpan: number }>;

  /** Which variants this widget implements, narrowest first. */
  variants: readonly Variant[];

  /** Data */
  dataKey: string;
  params?: TParams;
  schema: ZodType<DataEnvelope>;

  /** Rendering */
  render: (props: WidgetRenderProps) => ReactNode;

  /** Accessibility — mandatory, not optional. */
  a11y: {
    /** One sentence describing the takeaway. Shown to SRs, used as chart aria-label. */
    summary: (data: DataEnvelope) => string;
    /** Tabular fallback. Also the assertion surface in tests and the CSV export source. */
    table: (data: DataEnvelope) => { columns: string[]; rows: (string | number)[][] };
  };
}

export interface WidgetRenderProps {
  data: DataEnvelope;
  variant: Variant;
  width: number;
  height: number;
  onFocus?: () => void;   // request the drill-in view
}
```

**Invariant:** a widget that does not compile against this type does not ship. The registry is the only way to add a widget.

### 4.3 Chart-neutral data envelope

```ts
// lib/data/envelope.ts
export interface DataPoint { x: number | string; y: number; meta?: Record<string, unknown>; }
export interface Series { id: string; label: string; points: DataPoint[]; }

export interface DataEnvelope {
  series: Series[];
  meta: {
    unit?: string;                 // 'USD' | '%' | 'count'
    format: 'number' | 'currency' | 'percent' | 'duration';
    precision: number;
    xType: 'time' | 'category' | 'linear';
    /** Set by the server when it downsampled; drives a "showing N of M" note. */
    sampled?: { from: number; to: number };
    asOf: string;                  // ISO — dashboards must always say how fresh they are
  };
}
```

Nothing in `components/widgets/` may import from `recharts` or `chart.js`. Enforce with an ESLint `no-restricted-imports` rule — that rule is worth more than a code review comment.

### 4.4 Preferences

```ts
// lib/prefs/types.ts
export interface DashboardPrefs {
  version: 2;                       // bump + migrate, never mutate in place
  widgets: { id: string; sizeOverride?: SizeToken }[];   // order IS the array order
}

export interface PrefsRepository {
  load(userId: string): Promise<DashboardPrefs | null>;
  save(userId: string, prefs: DashboardPrefs): Promise<void>;
}
// POC: LocalStoragePrefsRepository. Real: HttpPrefsRepository → .NET. Same interface.
```

No x/y coordinates. Ever. Position is derived, never stored.

---

## 5. Responsive spec

The ladder each widget type implements. This table is the acceptance criteria for §Phase 3.

| Widget | `micro` (<340px) | `compact` (340–560) | `standard` (560–900) | `expanded` (>900) |
|---|---|---|---|---|
| KPI card | value + delta arrow | + sparkline | + sparkline + period label | + mini breakdown |
| Trend (line/area) | headline value + delta, "View chart" | sparkline, no axes | 1–2 series, thinned ticks, no gridlines | full axes, legend, brush |
| Bar / column | top 3 as a labelled list | **horizontal** bars, top 5 + Other | horizontal bars, all | vertical bars, full axes |
| Stacked bar | total + top segment | 100% stacked, 3 segments + Other | full stack, legend | full stack + per-segment labels |
| Scatter | correlation sentence + "View chart" | binned hexes or top-N | full scatter, ≤3 series | full + brush + marginal dists |
| Table | 2 columns | 3 columns | full, horizontally scrollable | full + sort |

Cross-cutting rules at every width below `standard`:

- Abbreviate numbers (`1.2M`, `847K`), drop axis titles into the card header, drop gridlines, drop the legend in favour of direct labels or a list below the plot.
- Thin ticks to first / last / max, never rotate labels.
- Minimum 44×44 CSS px for anything tappable.
- Hit-testing by **nearest on the category axis**, never by hitting the mark. Scatter uses nearest-neighbour with a ~24px radius.
- Touch and keyboard drive a **readout strip**, not a floating tooltip. One component, both inputs.
- `prefers-reduced-motion` → animation off.

---

## 6. Layout engine spec

```ts
// lib/layout/pack.ts
export interface PackedItem { id: string; colStart: number; colSpan: number; rowSpan: number; }

/**
 * Pure. Given an ordered widget list and a breakpoint, return items in FINAL RENDER ORDER
 * with explicit grid placement.
 *
 * Invariants (assert these in tests):
 *  1. Output order is a permutation of input order that never moves an item backwards
 *     past more than `lookahead` positions. (Bounded reordering keeps the user's intent.)
 *  2. No item exceeds GRID_COLUMNS[breakpoint].
 *  3. DOM order === visual reading order (left-to-right, top-to-bottom).
 *  4. Idempotent: pack(pack(x)) === pack(x).
 */
export function pack(
  items: { id: string; size: SizeToken; rowSpan: number }[],
  breakpoint: Breakpoint,
  opts?: { lookahead?: number },
): PackedItem[];
```

The algorithm: greedy row-fill with bounded lookahead. Walk the ordered list; if the next item doesn't fit the remaining columns in the current row, look ahead up to `lookahead` (default 2) positions for one that does; otherwise start a new row. This fills gaps without letting a widget teleport across the dashboard.

**Start with the banded variant if Phase 4 runs long:** render `sm` widgets into a KPI strip that flows densely, then everything else stacked. Same solver, `lookahead: Infinity` within a band, `0` across bands.

Rendering: CSS Grid, `grid-template-columns: repeat(var(--cols), minmax(0, 1fr))`, `grid-auto-rows: ROW_UNIT`. `minmax(0, 1fr)` is load-bearing — without it, chart SVGs refuse to shrink and you get the exact overflow bug in the brief.

---

## 7. Customization UX spec

- **Picker:** a sheet/dialog listing widgets grouped by `category`, each showing its `question`, not just its title. Search. Checkbox to add/remove. Shows "6 of 10 selected" — a soft cap nudges against re-creating the clutter.
- **Reorder:** each widget header carries a handle. Primary mechanism is **Move up / Move down** buttons (visible on focus, always in the DOM). dnd-kit adds pointer dragging.
- **Announcements:** `aria-live="polite"` region — `"Revenue trend moved to position 3 of 8"`. Test this string; it's a WCAG deliverable.
- **Undo:** a toast with Undo after every add/remove/reorder. Cheap to build, disproportionately impressive in a demo.
- **Reset to default** is always one click away.
- **Edit mode is a distinct mode** with a clear enter/exit, not an always-on drag affordance. Prevents accidental reorders on touch — a real complaint about Power BI dashboards.

---

## 8. Chart design standards

Method: pick the form → assign colour by the job it does → **validate with a script, don't eyeball** → apply mark specs → hover/readout layer → a11y pass → look at it.

### 8.1 Palette — measured finding, action required

The theme currently ships five `--chart-*` tokens in `app/globals.css`. They are a **monochrome teal sequential ramp** (hue 181–188, lightness 0.855 → 0.437) sitting in *categorical* slots, identical in light and dark mode. Converted to hex and run through the categorical validator against this project's actual surfaces:

| Check | Light (`#ffffff`) | Dark card (`#171717`) |
|---|---|---|
| Lightness band | **FAIL** — `#46ecd5` at L 0.854 | **FAIL** — 3 of 5 outside band |
| Chroma floor | **FAIL** — `#00786f`, `#005f5a` read as gray | **FAIL** — same two |
| CVD separation | WARN — worst adjacent ΔE 7.7 (deutan) | WARN — ΔE 7.7 |
| Normal-vision floor | **FAIL** — ΔE 7.9, below the 15 gate | **FAIL** — ΔE 7.9 |
| Contrast vs surface | WARN — 2 slots below 3:1 | WARN — 1 slot below 3:1 |

Two slots are indistinguishable **even to full-colour vision**. Shipping a multi-series chart on these is a guaranteed audit finding.

**Action (Phase 0):** replace `--chart-1..5` with a validated 8-slot categorical order. This one passes every hard gate on *this project's* surfaces in both modes:

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

Note the dark column is **re-stepped for the dark surface**, not an automatic flip — the current file uses identical values in both modes, which is why dark fails.

Light mode carries a contrast WARN on slots 3, 4, 5 (2.17–2.82:1). That is *dischargeable but not dismissable*: it obligates visible direct labels or the table view. §4.2 already mandates the table view, so this is satisfied by construction — but do not remove it.

### 8.2 Measured constraint: scatter caps at 3 series

Categorical palettes are normally validated on *adjacent* pairs, because a legend orders them. Scatter and bubble charts have no adjacency — any two series can sit next to each other, so every pair must separate. Run against all pairs:

- 3 series — **PASS** both modes (worst normal-vision ΔE 24.0).
- 4 series — **FAIL** light (orange↔yellow ΔE 13.7) and **FAIL** dark (ΔE 10.6, and deutan ΔE 4.8).
- 5 series — **FAIL** (magenta↔orange ΔE 12.9).

**Therefore: the scatter widget is hard-capped at 3 series.** Beyond 3 → small multiples / facets, not more colours. Encode this as a runtime assertion in the scatter adapter, not a comment. It also reinforces D1 — scatter was already heading to a focus view on mobile.

### 8.3 Non-negotiables

- Categorical hues assigned in **fixed order, never cycled**. A 9th series folds into "Other" or becomes small multiples.
- **Never a dual-axis chart.** Two measures at different scales → two charts, small multiples, or index both to 100. This is the single most common dashboard mistake and the client's Power BI board almost certainly has several.
- Sequential = one hue, light→dark. Diverging = two hues + neutral gray midpoint. Never a rainbow.
- Colour follows the **entity**, not its rank — filtering out a series must not repaint the survivors.
- Text wears text tokens (`--foreground` / `--muted-foreground`), never the series colour. A colour swatch beside the label carries identity.
- Status colours (good/warning/serious/critical) are reserved and always ship with icon + label.
- Legend present for ≥2 series (none for one — the title names it); ≤4 series also get direct labels.
- Thin marks, 2px lines, ≥8px markers, 4px rounded data-ends anchored to the baseline, 2px surface gap between adjacent/stacked fills, recessive grid and axes.

### 8.4 Keep the validator in the repo

Copy the palette validator into `scripts/validate-palette.mjs` and wire `npm run validate:palette` into CI. When the client hands over their brand colours — and they will, late — you re-run it and get an answer in seconds instead of an argument.

---

## 9. Accessibility plan

### Automated (the SOW checkbox)

- **pa11y-ci** over a URL list: the dashboard, the kitchen-sink route, the picker open, the focus view. WCAG 2.1 AA.
- **axe-core via Playwright** for the dev loop — better React/ARIA coverage than pa11y, runs against real interaction states pa11y can't reach (picker open, mid-reorder, focus view).
- Run both. pa11y satisfies the contract; axe finds the bugs.

### What automation cannot catch — budget one manual day

| Risk | Mitigation |
|---|---|
| Canvas chart is invisible to SRs | Hidden `<table>` + summary (§4.2) — mandatory per widget |
| SVG read as 400 path elements | `role="img"` + `aria-label` on wrapper, `aria-hidden` on internals |
| Reorder unusable without a mouse | Move up/down buttons + live region (§7) |
| Meaning carried by colour alone | Direct labels, shape/dash variation, texture fill for forced-colors |
| Focus lost when a widget is removed | Move focus to the next widget's heading; assert in e2e |
| Focus trap in the focus view / picker | Route-based focus view + base-ui dialog handle it; verify anyway |
| Motion sickness | `prefers-reduced-motion` → animations off |

**Manual pass:** NVDA on Windows (you're on Windows — no excuse), keyboard-only traversal of every flow, 200% browser zoom, and forced-colors mode. Schedule it in Phase 7, not "later".

WCAG criteria this project will be judged on specifically: **1.4.11** (non-text contrast ≥3:1 for chart marks), **2.5.7** (dragging movements have a non-drag alternative), **2.5.8** (target size ≥24px; aim for 44), **1.4.10** (reflow at 320px with no 2-D scrolling), **4.1.3** (status messages).

---

## 10. Testing plan

### The shape of 80%

Don't chase the number through chart internals — you'll write brittle snapshot tests and delete them in a month. Push logic into pure functions and test those hard.

**Tier 1 — pure logic, target 95–100%.** This is where bugs live and coverage is cheap:
`resolveVariant`, `pack`, tick reduction, number/date formatters, LTTB downsampling, prefs reducer (add/remove/reorder/resize), prefs migrations, envelope zod schemas, the `a11y.table` builders, the palette assertion.

**Tier 2 — components, target ~75%.** RTL with an injected container size:

```ts
render(<WidgetShell width={320}>...</WidgetShell>);
expect(screen.getByRole('table')).toBeInTheDocument();  // micro variant → table, not chart
```

This works *because* variant resolution reads from context rather than from the DOM. jsdom has no layout, so any test that depends on a real `ResponsiveContainer` measuring itself will render a 0×0 chart and assert nothing. Mock `ResizeObserver` once in `tests/setup.ts` and never think about it again.

**Tier 3 — contract tests over the registry.** One `describe.each(registry)` block asserting, for every widget: schema parses the fixture; every declared variant renders without throwing; `a11y.summary` returns a non-empty string; `a11y.table` column count matches row arity; declared `size` is valid at every breakpoint. ~60 lines, scales automatically with every new widget, and catches the class of bug that actually breaks dashboards.

**Tier 4 — e2e (Playwright), not counted in coverage.** Add widget → reload → still there. Keyboard-only reorder. Focus view open/close preserves focus. Visual regression at 375 / 768 / 1440 against the kitchen-sink route.

### Gates (set in CI from day one — never retrofit a coverage gate)

```jsonc
// vitest.config.ts — coverage.thresholds
{
  "global":            { "lines": 80, "functions": 80, "branches": 75, "statements": 80 },
  "lib/**":            { "lines": 95, "functions": 95, "branches": 90, "statements": 95 },
  "components/dashboard/**": { "lines": 80 },
  // excluded: app/(demo)/**, lib/data/fixtures/**, **/*.stories.tsx, tests/**
}
```

Excluding demo code from coverage is not cheating — it's the §0 rule expressed in config. Document the exclusion list in the PR that adds it so nobody thinks it drifted there.

### .NET side (for the real project)

coverlet with a build-failing threshold; thin controllers, logic in services; contract tests that assert the JSON envelope matches the TypeScript types (generate TS from the OpenAPI spec so drift becomes a compile error).

---

## 11. Performance plan

Budgets, enforced by Lighthouse CI on the dashboard route:

| Metric | Budget | Why it's the one that bites |
|---|---|---|
| LCP | < 2.5s | Charts block it if they're in the critical path |
| **INP** | **< 200ms** | **The real risk — chart re-renders on every resize/hover** |
| CLS | < 0.05 | Charts appearing after data lands is a classic shift |
| Initial JS | < 220KB gzip | Recharts alone is ~100KB+ |
| Chart lib bytes on first load | 0 | Must be dynamically imported |

Tactics:

- `next/dynamic` every chart adapter. **Never ship Chart.js and Recharts in the same bundle** — if S1 says you need both, split by route or by widget chunk and verify with `@next/bundle-analyzer`.
- IntersectionObserver: don't mount offscreen widgets; render a sized skeleton so CLS stays flat.
- **Debounce the ResizeObserver** (~100ms, trailing) and quantise width to 8px buckets before it reaches the variant resolver. Without this, a window drag triggers hundreds of chart re-renders and INP dies. This is the #1 perf bug in this architecture — build it into `useContainerSize` from the start.
- Downsample server-side (LTTB) with a `maxPoints` hint from the client. Fewer points is faster *and* fixes overplotting — a rendering win and a design win.
- `content-visibility: auto` on below-the-fold widget shells.
- Memoise on the envelope reference, not on deep-equality of series arrays.

---

## 12. Future .NET contract

Design the POC's Route Handlers to *be* this, so the swap is a base URL.

```http
POST /api/dashboard/data
{
  "widgets": [
    { "dataKey": "revenue.trend", "params": { "range": "12m" }, "maxPoints": 480 },
    { "dataKey": "orders.byRegion", "params": { "top": 5 } }
  ],
  "asOf": "2026-09-23T00:00:00Z"
}

200 → { "results": { "revenue.trend": <DataEnvelope>, "orders.byRegion": <DataEnvelope> },
        "errors":  { } }
```

Rules:

- **One batched call per dashboard**, not N. Twelve round trips over mobile latency is the difference between a fast dashboard and a slow one.
- Partial failure is normal: one widget erroring returns an entry in `errors` and does not fail the response. The shell renders a per-widget error state.
- Server owns aggregation, downsampling (`maxPoints`), rounding, and unit metadata. The client never does statistics.
- `ETag` + `Cache-Control` — KPI data is stale-tolerant; say how stale via `meta.asOf` and show it in the UI.
- Separate endpoints: `GET/PUT /api/dashboard/prefs` implementing `PrefsRepository`, and `GET /api/dashboard/catalog` returning available widgets per role (so the picker is server-driven, not hardcoded).
- Publish OpenAPI; generate the TS types. Hand-maintained duplicate types will drift.

---

## 13. Phased execution

~13 focused days. Each phase has a hard exit criterion; don't start the next until it's met.

### Phase 0 — Foundation (1.5d)

- Vitest + RTL + jsdom + v8 coverage, thresholds wired and **failing the build**.
- `tests/setup.ts`: `ResizeObserver`, `matchMedia`, `IntersectionObserver` mocks.
- Playwright + axe; pa11y-ci config; Lighthouse CI config with §11 budgets.
- GitHub Actions: typecheck → lint → unit+coverage → build → e2e → a11y → LHCI.
- `.gitattributes`, `.nvmrc`, `.env.example` (§16).
- **Replace the `--chart-*` tokens per §8.1**; add `scripts/validate-palette.mjs` + `npm run validate:palette` to CI.
- Seeded fixture generator (`lib/data/fixtures`) — deterministic, so visual tests are stable.

**Exit:** `npm run ci` passes locally on a repo with one trivial test. Coverage gate demonstrably fails when you delete that test.

### Phase 1 — Primitives (1.5d)

- `useContainerSize` — ResizeObserver, debounced, 8px-quantised, SSR-safe.
- `ContainerSizeProvider` + `resolveVariant`.
- `WidgetShell`: header (title, `question` as tooltip/subtitle, actions menu, drag handle, move up/down), body slot, hidden-table slot, skeleton / empty / error states.
- `lib/viz`: formatters, number abbreviation, tick reduction, LTTB.
- `lib/a11y`: table builder, live-region helper, `VisuallyHidden`.

**Exit:** a stub widget renders four different variants purely by changing the injected width, proven by a unit test. Tier-1 coverage ≥95%.

### Phase 2 — Registry (1d)

- `WidgetDefinition` types + zod schemas + the registry itself.
- ESLint `no-restricted-imports` banning chart libs outside `components/charts/`.
- Three KPI-card widgets end to end on fixtures.
- Kitchen-sink route iterating the registry × variants.
- **Tier-3 contract test** (`describe.each(registry)`).

**Exit:** adding a widget requires touching exactly one file, and the contract test picks it up automatically.

### Phase 3 — Chart adapters + widgets (2d)

*Gated on spike S1.*

- Adapters: `<LineChart>`, `<BarChart>`, `<StackedBar>`, `<ScatterChart>`, `<Sparkline>` — chart-neutral props, library hidden.
- Readout strip (touch + keyboard driven), shared across adapters.
- Hit-testing per §5. Scatter: nearest-neighbour + the 3-series assertion from §8.2.
- Build out the widget set to ~8–10 covering every row of the §5 table.

**Exit:** every cell of the §5 responsive table is implemented and visible on the kitchen-sink route. Visual regression baselines captured at 375/768/1440.

### Phase 4 — Layout engine (1.5d)

- `pack()` with the four invariants as property-based tests (fast-check is worth it here).
- `DashboardGrid` rendering packed output; DOM order = visual order.
- Per-breakpoint column counts; `minmax(0, 1fr)`.

**Exit:** invariant tests pass; no horizontal scroll at 320px on the kitchen-sink route; resizing the window never reorders widgets unpredictably.

### Phase 5 — Customization (2d)

- Picker sheet (grouped, searchable, shows `question`, soft cap).
- Reorder: move up/down buttons + live region; dnd-kit as enhancement.
- Prefs reducer + zod validation + v1→v2 migration test + `LocalStoragePrefsRepository`.
- Edit mode, undo toast, reset to default.

**Exit:** the full add/remove/reorder/persist flow is completable with **keyboard only**, verified by a Playwright test that never calls `mouse`.

### Phase 6 — Focus view (1d)

- `(dashboard)/[widgetId]` route: full-viewport chart, `expanded` variant, full interactivity, table toggle, CSV export.
- Entry from every widget's "View chart" / header action. Back button and deep links work.
- Focus management on enter/exit.

**Exit:** deep-linking to a focus view works on a cold load; Escape and Back both return with focus restored to the originating widget.

### Phase 7 — Hardening (1.5d)

- axe sweep across all interaction states; fix everything.
- **Manual NVDA pass + keyboard-only pass + 200% zoom + forced-colors.**
- Bundle analysis; dynamic-import verification; INP measurement under a window-resize drag.
- pa11y-ci green.

**Exit:** all §11 budgets met; zero axe violations; the NVDA pass is written up (findings + fixes) — that document is a client deliverable.

### Phase 8 — Demo polish (1d)

- Narrative fixture data (a story the numbers tell, not noise — "Q3 dipped, recovered in September").
- Empty / loading / error / no-data-yet states, because the client will ask.
- README: run instructions, architecture diagram, the 5-minute demo script.
- A "before / after" page contrasting the cluttered original with the revamp. **This is what actually wins the pitch.**

**Exit:** a dry run of the demo on a real phone, over a real network, completes without apology.

---

## 14. Spikes — run these in Phase 0, timeboxed

| # | Question | Timebox | Decision it unblocks |
|---|---|---|---|
| S1 | Recharts vs Chart.js after LTTB downsampling to ~500 points: does Recharts hold 60fps on the worst realistic dataset? | 3h | **D6.** If yes, delete Chart.js entirely — one library, better a11y, smaller bundle |
| S2 | Vitest + Next 16 + React 19 + RTL — does the stack work, and does `next/dynamic` behave under test? | 2h | D9; fallback is Jest or moving component tests to Playwright CT |
| S3 | Tailwind v4 `@container` + `useContainerSize` — do CSS and JS agree on the breakpoint? | 1h | Whether variant switching needs JS at all for the pure-CSS cases |
| S4 | dnd-kit under React 19 | 1h | Phase 5 fallback: buttons-only reorder (which is the a11y-primary path regardless) |
| S5 | Recharts SVG + `role="img"` + hidden table — what does NVDA actually announce? | 2h | Validates the §4.2 bet before 8 widgets depend on it |

Write the outcome of each spike into this file under a "Spike results" heading. A spike with no recorded decision was a waste of time.

---

## 15. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Client insists on full analytical parity on mobile | High | Renegotiate now with the §5 ladder as the concrete proposal. "Mobile = curated summary, desktop = exploration" |
| Picker offers 60 KPIs → clutter is recreated | High | Push for role-based curated defaults; soft cap in the picker; `question` field forces justification per widget |
| POC code ships to production unhardened | High | §0 directory rule + coverage gates per directory from day one |
| Coverage gamed to hit 80% | Medium | Tier structure + the registry contract test; review the exclusion list in PRs |
| Chart.js canvas blocks the a11y sign-off | Medium | S1 may delete it; §4.2 hidden table covers it if not |
| Next 16 breaking changes vs. tooling assumptions | Medium | `AGENTS.md` rule — read `node_modules/next/dist/docs/` first; S2 |
| Resize thrash destroys INP | Medium | Debounce + quantise in `useContainerSize` from the start (§11) |
| Drag-and-drop fails the WCAG audit | Medium | Buttons are the primary path; drag is enhancement only |
| Cross-widget filtering requested late | Medium | Name it as out-of-scope in writing now (§1); design the envelope so `params` can carry filters later |
| Client brand palette fails validation | Low | `npm run validate:palette` gives a measured answer in seconds (§8.4) |

---

## 16. Multi-machine workflow

This repo moves between a personal machine and a work machine via GitHub.

- **Never commit client data.** All fixtures synthetic, from a seeded PRNG. Add a pre-commit check for suspicious patterns (real company names, emails, ₹/$ figures pasted from a report) if anything real ever touches the repo.
- **Check git identity per clone.** `git config user.email` — the work machine should commit under the work address. Consider `includeIf` in `~/.gitconfig` to make this automatic per directory.
- **`.gitattributes`** with `* text=auto eol=lf` — prevents CRLF churn and Prettier fighting itself across machines.
- **`.nvmrc` + `engines`** — pin the Node major. `package-lock.json` is committed; always `npm ci`, never `npm install`, on the second machine.
- **`.env.example` committed, `.env.local` ignored.** The POC's only env var should be `NEXT_PUBLIC_API_BASE_URL` — which is exactly the switch that swaps fixtures for the real .NET API.
- **No absolute paths** in any config. Use `@/` path aliases (already configured in `tsconfig.json`).
- **Branch discipline:** `master` is currently the local branch but `main` is the intended default — reconcile before the first push so the work machine doesn't clone a divergent default.
- **When this becomes the client repo:** decide whether to squash history or start fresh. If the client requires clean IP provenance, start fresh and port the `lib/` directory as an initial commit.

---

## 17. Open questions for the client

Ask these before Phase 3, because the answers change what gets built.

1. **Who is the primary user, and on what device?** Executive-on-phone and analyst-on-desktop are different products. Which one loses if you have to choose?
2. **How real is the mobile requirement?** "Viewable on mobile" — does that mean "legible summary" or "full analysis at 375px"? Get it in writing.
3. **How many KPIs does the picker choose from?** 12 is a design problem; 60 is an information-architecture problem requiring discovery.
4. **Which three questions should the default dashboard answer?** If nobody can name them, that's the finding, and it's more valuable than any chart.
5. **Is cross-widget filtering / drill-through expected?** Currently out of scope. It is often the thing users actually miss from Power BI.
6. **What is the real data volume per chart?** Drives S1 and the downsampling strategy. Ask for the worst case, not the average.
7. **How fresh must the data be?** Real-time, hourly, or overnight? Determines caching and whether `meta.asOf` is a footnote or a headline.
8. **Brand palette and accessibility standard?** WCAG 2.1 AA is assumed. If they have brand colours, get the hexes early and run them through the validator before design work starts.
