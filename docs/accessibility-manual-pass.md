# Manual accessibility pass

**Written for:** whoever runs the pass, and the client's accessibility reviewer.
**Status:** script prepared, **not yet executed**. See "Who has to run this" below.

---

## Why this document exists

The automated gates in this repo are a floor, not a ceiling. They run on every commit:

| Gate | What it catches |
|---|---|
| `npm run e2e` (axe-core, 3 viewports) | ARIA misuse, missing names, contrast, landmark structure |
| `npm run a11y` (pa11y-ci, WCAG2AA, 5 URLs) | the SOW's named tool, same class of defect |
| `tests/e2e/hardening.spec.ts` | forced colours, 320px reflow, dark mode, reduced motion |
| `tests/e2e/customize.spec.ts` | every customisation flow, keyboard-only, no mouse calls |
| `npm run validate:palette` | contrast and colour-vision separation, measured numerically |

None of them can tell you whether the product **makes sense when read aloud**. A page can
be free of axe violations and still announce "graphic, button, button, button" in an order
nobody can follow. That is what the script below is for.

## Who has to run this

**A person, with a real screen reader.** This has not been run.

It was not skipped for time: it cannot be automated and it cannot be done by the agent
that wrote the code. Assistive-technology output is not observable from the test runner —
NVDA's speech buffer is not exposed to Playwright, and simulating it would test the
simulation. Anything claiming otherwise would be a fabricated result in the one area
where a fabricated result is most damaging.

Budget **half a day**. The most useful reviewer is someone who uses a screen reader daily;
the second most useful is a developer who has never seen this dashboard before.

---

## Setup

- **Windows + NVDA** (free, and what most UK/EMEA users of this kind of product run).
  macOS + VoiceOver is an acceptable substitute; note which you used.
- Chrome or Edge, latest.
- `npm run build && npm run start`, then `http://localhost:3000/dashboard`.
- Turn the screen off, or use NVDA's speech viewer with the monitor off. Reading the
  screen while listening defeats the exercise.

Record: what was said, what you expected, and whether you could complete the task.

---

## 1 · Orientation (10 min)

Start at `/dashboard`.

1. Press `H` repeatedly. Do the headings describe the page, in order?
2. Press `D` (landmarks). Are navigation, main and the regions distinguishable?
3. Press `T` (tables). **There will be one table per widget plus the matrix.** Is it clear
   which is which from the caption alone?

> **Known risk.** Every widget ships a visually-hidden data table so that charts are
> readable at all (PLAN §5.3, D8). On a dashboard of six widgets that is seven tables. If
> that is noisy to navigate, the fix is better captions, not fewer tables — record the
> wording you would have wanted.

## 2 · The matrix (20 min)

At `/dashboard/emea`, find the matrix.

1. Enter the grid. You should get **one** tab stop, then arrow keys move between cells.
2. Move across a row. Each cell should announce **row, column, value, and what the value
   is measured against** — e.g. "Al Barsha School, pass rate, 87 percent, up 2.1
   percentage points on last year".
   - A value with no stated comparison is the defect to look for.
3. Find a cell that reads "not measured". Is the *reason* given ("Not reported in this
   country", "No senior year groups")?
4. Sort a column. Is the new order announced, or does the table silently rearrange?
5. Press `Enter` on a cell. Did you drill into that row? Where did focus land?

## 3 · Drill-down and orientation (15 min)

1. Drill group → region → country → school using only the keyboard.
2. After each drill, **is it announced where you now are?** There is a live region for
   this; confirm it actually fires and is not swallowed.
3. Use a breadcrumb's sibling dropdown to jump sideways. Is it discoverable at all
   without sight? This is the interaction most likely to fail the pass.
4. Press the browser Back button. Is the change announced?

## 4 · Customising (20 min)

1. Activate "Choose metrics". Does focus enter the dialog, and is it trapped?
2. Are metrics grouped by pillar audibly, or does it read as one long list?
3. Each checkbox announces its title *and* the question it answers. Too much? Record it.
4. Close with `Escape`. **Does focus return to the button that opened it?**
5. Activate "Arrange", move a widget up. The announcement should be
   "<name> moved to position N of M". Confirm it is heard, once, not twice.
6. Remove a widget. Is the Undo offer announced and reachable?

## 5 · The focus view (15 min)

1. Open a widget's full view. Focus should land on the heading, not the document top.
2. Switch breakdown axes. Is the current axis identifiable?
3. On contribution margin, read the waterfall. Does each line announce its contribution
   and the running total, and does the shape make sense without seeing it?
4. `Escape` out. **Did you land back on the widget you opened, or at the top of the page?**

## 6 · Zoom and colour (15 min)

Automated tests cover the measurable parts; these need eyes.

1. Browser zoom to **200%**, then **400%**. Is anything clipped or overlapping? Is any
   content reachable only by horizontal scrolling?
2. Windows High Contrast on. Are selected states still visibly selected? Can you still
   tell an above-target cell from a below-target one? *(The tint is removed on purpose —
   the ▲/▼ glyph and the signed number are what should carry it.)*
3. Dark mode. Anything unreadable?

## 7 · The honest question

> If this were the only way you could use this dashboard, could you do your job with it?

Write the answer down verbatim. It is the finding that matters most and the one that
never appears in an automated report.

---

## Recording results

Create `docs/accessibility-pass-<yyyy-mm-dd>.md` with, for each finding:

- what you did, what was said, what you expected
- WCAG criterion if one applies (and "none" is a valid answer — a confusing experience
  that violates no criterion is still a defect)
- severity: blocks the task / makes it slow / irritating

**This write-up is a client deliverable** (PLAN §13). Ship it whatever it says; a pass
report with no findings is not credible and will be read as one that was not run.

## Criteria this product is most likely to be judged on

| Criterion | Where the risk is |
|---|---|
| 1.4.11 Non-text contrast | chart marks and matrix tints |
| 2.5.7 Dragging movements | reordering — mitigated by buttons being the primary path |
| 2.5.8 Target size | 44px is enforced in code; verify at 200% zoom |
| 1.4.10 Reflow | the matrix at 320px — automated, but confirm it is *usable*, not just unclipped |
| 4.1.3 Status messages | drill, reorder, add/remove announcements |
| 2.4.8 Location | the breadcrumb is the whole answer |
