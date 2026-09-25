# DynaVis

Strategic performance dashboard for a multinational school group — a POC of the UI/UX,
and the architectural base for the client project.

- **[PLAN.md](PLAN.md)** — the implementation plan. Read §0 (the dual mandate) before adding code.
- **[discussion.md](discussion.md)** — why the plan is the way it is.

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
