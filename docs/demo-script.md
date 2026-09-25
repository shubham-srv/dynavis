# Five-minute demo script

**Written for:** whoever presents this to the client.

Run `npm run build && npm run start`. Have a **phone on the same network** open at the
same URL — the mobile moment is the one that lands, and it does not land if you describe
it instead of showing it.

Everything is synthetic data for an invented group, "Nova Schools". Say that once at the
start and do not repeat it.

---

## 0 · Before you start (30 seconds, say it out loud)

> "Two things up front. All the data is invented — no client data has touched this. And
> the 'before' panel is our reconstruction of the *pattern* we were told about, not a
> screenshot of your board, which we haven't seen."

Say it. The alternative is someone asking later and the whole demo becoming about that.

## 1 · The problem, in one screen (45s)

**`/before-after`**

Do not narrate the left panel. Let them look at it, then:

> "Twenty-four tiles. Every one of them has three series and its own colour scheme. The
> honest observation is that this isn't a Power BI problem — it's that nobody was ever
> able to say no to a metric."

Then scroll to the eight decisions and pick **one**. The strongest is usually:

> "Every number on the new dashboard says what it's measured against. A number with no
> stated comparison isn't a fact, it's a decoration."

## 2 · The dashboard (60s)

**`/dashboard`**

> "Three strategy pillars, so six metrics rather than sixty. Each one states the question
> it answers — that's the mechanism that stops this filling up again, and it's your rule,
> not ours."

Point at the matrix:

> "This isn't a report. It's the navigation. The rows are always the children of wherever
> you are — regions here, countries inside EMEA, schools inside a country. Which means it
> never becomes a 500-row grid, and clicking a row *is* the drill-down."

Click EMEA → UAE → Dubai → a school. Then use a **breadcrumb dropdown** to jump sideways
to another school without going back up. That move gets a reaction.

## 3 · The thing they will ask about (45s)

Egypt reads weak on the matrix. Go there.

> "Fee collection has been sliding for three years. Notice it's not just red — it says
> what it's measured against, and it says by how much."

Open **contribution margin** in full view:

> "A composite metric drills two ways. Most tools give you the school list. What you
> usually want first is *which cost line moved* — and that's what this opens on."

## 4 · The mobile moment (45s)

**Hand them the phone**, already on `/dashboard`. Do not explain it first.

> "Same URL. The matrix isn't a squeezed grid — at this width a twelve-column table is
> unreadable at any font size that fits, so it becomes a ranked list. Nothing shrank.
> Things were substituted."

Let them drill on the phone themselves.

## 5 · Customisation (45s)

Back on the laptop. **Choose metrics** → add one → **Arrange** → move one → **Undo**.

> "Grouped by pillar, and each one shows its question, not a description. It warns past
> eight rather than blocking — that's a conversation for you to have, not a rule for us
> to impose."

Then, if the room is technical:

> "Reordering is buttons, with drag as a possible later addition rather than the other way
> round. There's a test that completes this entire flow without a single mouse event."

## 6 · Close on the honest bit (30s)

**`/states`**

> "Schools that opened this year have no prior year. Some countries don't report some
> metrics at all. Most dashboards show a blank or a zero for those — both of which are
> lies. This says 'not measured' and tells you why."

Then stop.

---

## If you have ten minutes instead of five

- **`/kitchen-sink`** — every widget at every size, on one page. This is what convinces
  an engineering audience the responsive behaviour is systematic, not hand-tuned.
- **Windows High Contrast / forced colours** — the tints vanish and the ▲▼ glyphs carry
  the meaning. Good if anyone in the room owns accessibility.
- **Role switcher at the bottom of the dashboard** — switch to Principal, then hand-edit
  the URL to another school. It's refused. "A scope in a URL is a request, not a grant."

## Questions you will get, and honest answers

**"Is this real data?"**
No. Invented group, invented schools, synthetic numbers with deliberate gaps.

**"How long did this take?"**
It's a POC, and the foundation under it — the contracts, tests and accessibility gates —
is production-grade and intended to carry into the real build. `PLAN.md` has the phasing.

**"Can we have all sixty metrics?"**
You can. The picker warns past eight rather than blocking. But the reason the current
board is hard to use is that everything is on it, and adding everything back is the one
change that would reproduce the problem.

**"Does it work with our data?"**
The API contract is defined and chart-neutral; swapping fixtures for the real .NET
service is a base-URL change. What we need from you is in `PLAN.md` §21 — the org tree
including its exceptions, and whether per-KPI targets exist.

**"Has it been tested with a screen reader?"**
Automated accessibility checks run on every commit and are green. The manual
screen-reader pass has **not** been run yet — the script is written and it needs a person
and half a day. Do not claim otherwise.
