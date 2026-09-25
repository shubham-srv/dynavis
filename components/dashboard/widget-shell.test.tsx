import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
  ContainerSizeProvider,
  useVariant,
} from "@/components/dashboard/container-size"
import { WidgetShell } from "@/components/dashboard/widget-shell"
import type { DataTable } from "@/lib/a11y/table"
import type { Variant } from "@/lib/viz/variants"

const table: DataTable = {
  caption: "Attendance by country",
  columns: ["Period", "UAE", "UK"],
  rows: [
    ["ay-2024", 0.88, null],
    ["ay-2025", 0.91, 0.84],
  ],
}

describe("WidgetShell", () => {
  it("names the widget and states the question it answers", () => {
    render(<WidgetShell title="Attendance" question="Are students in class?" />)
    expect(
      screen.getByRole("heading", { name: "Attendance" })
    ).toBeInTheDocument()
    expect(screen.getByText("Are students in class?")).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Attendance" })
    ).toBeInTheDocument()
  })

  it("exposes the chart's data as a table to assistive tech", () => {
    // The whole a11y bet: charts are unreadable to a screen reader, this is not.
    render(
      <WidgetShell
        title="Attendance"
        table={table}
        summary="Attendance rose 3 points."
      >
        <svg role="presentation" />
      </WidgetShell>
    )
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByText("Attendance rose 3 points.")).toBeInTheDocument()
    expect(
      screen.getByRole("rowheader", { name: "ay-2025" })
    ).toBeInTheDocument()
  })

  it("says 'not measured' for a missing cell rather than showing zero", () => {
    render(<WidgetShell title="Attendance" table={table} />)
    expect(screen.getByText("not measured")).toBeInTheDocument()
  })

  it("hides the body while loading and announces it", () => {
    render(
      <WidgetShell title="Attendance" state="loading">
        <p>chart</p>
      </WidgetShell>
    )
    expect(screen.queryByText("chart")).not.toBeInTheDocument()
    expect(screen.getByText("Loading Attendance")).toBeInTheDocument()
  })

  it("reports an error as an alert with a way out", async () => {
    const onRetry = vi.fn()
    render(
      <WidgetShell
        title="Margin"
        state="error"
        errorMessage="Upstream timed out"
        onRetry={onRetry}
      />
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Upstream timed out")
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("distinguishes 'no data recorded' from an error", () => {
    render(<WidgetShell title="Placement" state="empty" />)
    expect(screen.getByText(/no data recorded/i)).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  describe("reordering", () => {
    it("ships buttons, not just a drag handle", async () => {
      // Drag-and-drop alone fails WCAG 2.5.7 and is unusable on a phone (PLAN §10).
      const onMoveUp = vi.fn()
      const onMoveDown = vi.fn()
      render(
        <WidgetShell
          title="Attendance"
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          position={{ index: 2, total: 8 }}
        />
      )

      const up = screen.getByRole("button", {
        name: /move attendance up, currently 3 of 8/i,
      })
      await userEvent.click(up)
      expect(onMoveUp).toHaveBeenCalledOnce()

      await userEvent.click(
        screen.getByRole("button", { name: /move attendance down/i })
      )
      expect(onMoveDown).toHaveBeenCalledOnce()
    })

    it("is reachable and operable by keyboard alone", async () => {
      const onMoveUp = vi.fn()
      render(
        <WidgetShell
          title="Attendance"
          onMoveUp={onMoveUp}
          position={{ index: 0, total: 3 }}
        />
      )

      await userEvent.tab()
      expect(
        screen.getByRole("button", { name: /move attendance up/i })
      ).toHaveFocus()
      await userEvent.keyboard("{Enter}")
      expect(onMoveUp).toHaveBeenCalledOnce()
    })

    it("announces position to screen readers even though it is not drawn", () => {
      render(
        <WidgetShell title="Attendance" position={{ index: 2, total: 8 }} />
      )
      expect(screen.getByText("Position 3 of 8")).toBeInTheDocument()
    })

    it("omits controls that were not wired up", () => {
      render(<WidgetShell title="Attendance" />)
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    })
  })

  it("labels every control with the widget it acts on", () => {
    // "Remove" on its own is ambiguous when eight widgets are on screen.
    render(
      <WidgetShell
        title="Seat utilisation"
        onRemove={vi.fn()}
        focusHref="/focus/card.seatUtilisation"
      />
    )
    expect(
      screen.getByRole("button", {
        name: "Remove Seat utilisation from dashboard",
      })
    ).toBeInTheDocument()
    // A link, not a button: middle-click and open-in-new-tab must work.
    expect(
      screen.getByRole("link", { name: "Open Seat utilisation in full view" })
    ).toHaveAttribute("href", "/focus/card.seatUtilisation")
  })
})

/**
 * The Phase 2 exit criterion: a widget renders a different form at each size, driven
 * purely by an injected width. This works because variant resolution reads from context
 * rather than measuring the DOM — jsdom has no layout, so a chart wired to a real
 * ResizeObserver would render 0×0 here and assert nothing (PLAN §14).
 */
function StubWidget({ supported }: { supported: readonly Variant[] }) {
  const variant = useVariant(supported)
  return <p data-testid="variant">{variant}</p>
}

const ALL: readonly Variant[] = ["micro", "compact", "standard", "expanded"]

describe("variant selection by injected width", () => {
  it.each([
    [320, "micro"],
    [336, "compact"],
    [560, "standard"],
    [1200, "expanded"],
  ])("renders the %ipx form as %s", (width, expected) => {
    render(
      <ContainerSizeProvider width={width}>
        <StubWidget supported={ALL} />
      </ContainerSizeProvider>
    )
    expect(screen.getByTestId("variant")).toHaveTextContent(expected)
  })

  it("never exceeds what the widget implements", () => {
    render(
      <ContainerSizeProvider width={1600}>
        <StubWidget supported={["micro", "compact"]} />
      </ContainerSizeProvider>
    )
    expect(screen.getByTestId("variant")).toHaveTextContent("compact")
  })

  it("starts narrow before anything has been measured", () => {
    // Guessing wide would flash an expanded chart into a phone for a frame.
    render(
      <ContainerSizeProvider>
        <StubWidget supported={ALL} />
      </ContainerSizeProvider>
    )
    expect(screen.getByTestId("variant")).toHaveTextContent("micro")
  })

  it("refuses to render outside a provider rather than guessing a size", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => render(<StubWidget supported={ALL} />)).toThrow(
      /ContainerSizeProvider/
    )
    quiet.mockRestore()
  })
})
