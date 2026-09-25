import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { DashboardCustomizer } from "@/components/dashboard/dashboard-customizer"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { loadWidgetDatum } from "@/lib/data/widget-data"
import { MemoryPrefsRepository } from "@/lib/prefs/local-storage"
import { DEFAULT_WIDGET_IDS, widgetsForLevel } from "@/lib/registry/registry"
import { resolveScope } from "@/lib/scope/resolve"

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const
const scope = resolveScope(["emea"], fixtureLookup)!

const data = Object.fromEntries(
  widgetsForLevel("region").map((widget) => [
    widget.id,
    loadWidgetDatum("emea", widget.kpiId, period),
  ])
)

let repository: MemoryPrefsRepository
beforeEach(() => {
  repository = new MemoryPrefsRepository()
})

function show(role = "super-admin") {
  return render(
    <DashboardCustomizer
      scope={scope}
      level="region"
      role={role}
      defaults={DEFAULT_WIDGET_IDS}
      data={data}
      repository={repository}
    />
  )
}

describe("DashboardCustomizer", () => {
  it("starts from the role's defaults without waiting on storage", () => {
    show()
    expect(screen.getAllByRole("listitem")).toHaveLength(
      DEFAULT_WIDGET_IDS.length
    )
  })

  describe("edit mode", () => {
    it("hides move and remove controls until editing", async () => {
      // A mis-tap must not rearrange someone's dashboard (PLAN §10).
      show()
      expect(
        screen.queryByRole("button", { name: /move .* down/i })
      ).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole("button", { name: /arrange/i }))
      expect(
        screen.getAllByRole("button", { name: /move .* down/i }).length
      ).toBeGreaterThan(0)
    })

    it("reports its state to assistive tech", async () => {
      show()
      const toggle = screen.getByRole("button", { name: /arrange/i })
      expect(toggle).toHaveAttribute("aria-pressed", "false")
      await userEvent.click(toggle)
      expect(
        screen.getByRole("button", { name: /done arranging/i })
      ).toHaveAttribute("aria-pressed", "true")
    })

    it("offers reset only while editing", async () => {
      show()
      expect(
        screen.queryByRole("button", { name: /reset to default/i })
      ).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole("button", { name: /arrange/i }))
      expect(
        screen.getByRole("button", { name: /reset to default/i })
      ).toBeInTheDocument()
    })
  })

  describe("reordering", () => {
    it("moves a widget and announces its new position", async () => {
      show()
      await userEvent.click(screen.getByRole("button", { name: /arrange/i }))

      const before = screen
        .getAllByRole("listitem")
        .map((item) => within(item).getByRole("heading").textContent)

      await userEvent.click(
        within(screen.getAllByRole("listitem")[1]).getByRole("button", {
          name: /move .* up/i,
        })
      )

      const after = screen
        .getAllByRole("listitem")
        .map((item) => within(item).getByRole("heading").textContent)
      expect(after[0]).toBe(before[1])
      expect(after[1]).toBe(before[0])

      // Silent to a screen reader unless said out loud (WCAG 4.1.3).
      expect(
        screen.getByText(/moved to position 1 of \d+\./)
      ).toBeInTheDocument()
    })

    it("persists the new order", async () => {
      show()
      await userEvent.click(screen.getByRole("button", { name: /arrange/i }))
      await userEvent.click(
        within(screen.getAllByRole("listitem")[1]).getByRole("button", {
          name: /move .* up/i,
        })
      )

      await waitFor(async () => {
        const saved = await repository.load("demo", "super-admin")
        expect(saved!.widgets[0].id).toBe(DEFAULT_WIDGET_IDS[1])
      })
    })
  })

  describe("the picker", () => {
    it("groups by pillar and shows the question each widget answers", async () => {
      show()
      await userEvent.click(
        screen.getByRole("button", { name: /choose metrics/i })
      )
      const dialog = screen.getByRole("dialog")
      expect(
        within(dialog).getByRole("heading", { name: /profitable revenue/i })
      ).toBeInTheDocument()
      // The card and the trend widget share this KPI, so both legitimately show it.
      expect(
        within(dialog).getAllByText(/are families choosing to stay with us\?/i)
          .length
      ).toBeGreaterThan(0)
    })

    it("adds and removes, and says how many are selected", async () => {
      show()
      await userEvent.click(
        screen.getByRole("button", { name: /choose metrics/i })
      )
      const dialog = screen.getByRole("dialog")
      expect(
        within(dialog).getByText(`${DEFAULT_WIDGET_IDS.length} selected`)
      ).toBeInTheDocument()

      const checkbox = within(dialog).getByRole("checkbox", {
        name: /staff turnover/i,
      })
      await userEvent.click(checkbox)
      expect(screen.getByText(/staff turnover added\./i)).toBeInTheDocument()

      await userEvent.click(checkbox)
      expect(screen.getByText(/staff turnover removed\./i)).toBeInTheDocument()
    })

    it("searches by the question, not just the title", async () => {
      show()
      await userEvent.click(
        screen.getByRole("button", { name: /choose metrics/i })
      )
      const dialog = screen.getByRole("dialog")
      await userEvent.type(
        within(dialog).getByRole("searchbox"),
        "families choosing"
      )
      // The accessible name is title + question, since the label wraps both.
      expect(
        within(dialog).getAllByRole("checkbox", { name: /^Re-enrolment rate/ })
          .length
      ).toBeGreaterThan(0)
      expect(
        within(dialog).queryByRole("checkbox", { name: /cost per student/i })
      ).not.toBeInTheDocument()
    })

    it("warns past the soft cap rather than blocking", async () => {
      // A nudge, not a rule: rebuilding the clutter is the failure mode (PLAN §1.1).
      show()
      await userEvent.click(
        screen.getByRole("button", { name: /choose metrics/i })
      )
      const dialog = screen.getByRole("dialog")
      for (const name of [
        /staff turnover/i,
        /fee collection/i,
        /class fill/i,
      ]) {
        await userEvent.click(within(dialog).getByRole("checkbox", { name }))
      }
      expect(
        within(dialog).getByText(/trying to answer too much at once/i)
      ).toBeInTheDocument()
    })
  })

  describe("undo", () => {
    it("takes back a removal", async () => {
      show()
      await userEvent.click(screen.getByRole("button", { name: /arrange/i }))
      const removed = within(screen.getAllByRole("listitem")[0]).getByRole(
        "heading"
      ).textContent!

      await userEvent.click(
        screen.getAllByRole("button", { name: /remove .* from dashboard/i })[0]
      )
      expect(screen.getAllByRole("listitem")).toHaveLength(
        DEFAULT_WIDGET_IDS.length - 1
      )

      await userEvent.click(screen.getByRole("button", { name: "Undo" }))
      expect(screen.getAllByRole("listitem")).toHaveLength(
        DEFAULT_WIDGET_IDS.length
      )
      expect(
        within(screen.getAllByRole("listitem")[0]).getByRole("heading")
      ).toHaveTextContent(removed)
    })

    it("can be dismissed without undoing", async () => {
      show()
      await userEvent.click(screen.getByRole("button", { name: /arrange/i }))
      await userEvent.click(
        screen.getAllByRole("button", { name: /remove .* from dashboard/i })[0]
      )
      await userEvent.click(screen.getByRole("button", { name: /dismiss/i }))
      expect(
        screen.queryByRole("button", { name: "Undo" })
      ).not.toBeInTheDocument()
      expect(screen.getAllByRole("listitem")).toHaveLength(
        DEFAULT_WIDGET_IDS.length - 1
      )
    })
  })

  describe("per-role preferences", () => {
    it("keeps one role's dashboard out of another's", async () => {
      // Storage is keyed by user AND role: a principal's layout is not a manager's.
      const { unmount } = show("super-admin")
      await userEvent.click(screen.getByRole("button", { name: /arrange/i }))
      await userEvent.click(
        screen.getAllByRole("button", { name: /remove .* from dashboard/i })[0]
      )
      await waitFor(async () =>
        expect(
          (await repository.load("demo", "super-admin"))!.widgets
        ).toHaveLength(DEFAULT_WIDGET_IDS.length - 1)
      )
      unmount()

      show("principal")
      await waitFor(() =>
        expect(screen.getAllByRole("listitem")).toHaveLength(
          DEFAULT_WIDGET_IDS.length
        )
      )
    })

    it("restores what was saved for the role", async () => {
      await repository.save(
        {
          version: 2,
          role: "super-admin",
          widgets: [{ id: DEFAULT_WIDGET_IDS[2] }],
        },
        "demo"
      )
      show()
      await waitFor(() =>
        expect(screen.getAllByRole("listitem")).toHaveLength(1)
      )
    })

    it("drops a saved widget the registry no longer has", async () => {
      await repository.save(
        {
          version: 2,
          role: "super-admin",
          widgets: [{ id: DEFAULT_WIDGET_IDS[0] }, { id: "card.retired" }],
        },
        "demo"
      )
      show()
      await waitFor(() =>
        expect(screen.getAllByRole("listitem")).toHaveLength(1)
      )
    })
  })
})
