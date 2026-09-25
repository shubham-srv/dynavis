import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Waterfall } from "@/components/charts/waterfall"
import type { WaterfallStep } from "@/lib/focus/breakdown"

const steps: WaterfallStep[] = [
  { label: "Gross revenue", value: 1000, sign: 1, cumulative: 1000 },
  { label: "Staff cost", value: 600, sign: -1, cumulative: 400 },
  { label: "Facility cost", value: 150, sign: -1, cumulative: 250 },
]

describe("Waterfall", () => {
  it("names itself and lists every step", () => {
    render(
      <Waterfall
        steps={steps}
        format="currency"
        currency="USD"
        label="Margin by component"
      />
    )
    const figure = screen.getByRole("figure", { name: "Margin by component" })
    expect(within(figure).getAllByRole("listitem")).toHaveLength(steps.length)
  })

  it("renders values as real text, so no parallel table is needed", () => {
    // Unlike the library charts, this one is not aria-hidden: the numbers are the
    // content, and a screen reader reads them directly.
    const { container } = render(
      <Waterfall
        steps={steps}
        format="currency"
        currency="USD"
        label="Margin"
      />
    )
    // Asserted on the container because each row interleaves a sign glyph, the value
    // and a visually-hidden explanation in one line.
    expect(container.textContent).toMatch(/\$1K|\$1,000/)
    expect(container.textContent).toContain("Staff cost")
  })

  it("marks which lines add and which subtract, in words as well as a sign", () => {
    render(
      <Waterfall
        steps={steps}
        format="currency"
        currency="USD"
        label="Margin"
      />
    )
    expect(screen.getByText(/added, running total/)).toBeInTheDocument()
    expect(screen.getAllByText(/subtracted, running total/)).toHaveLength(2)
  })

  it("shows the final contribution as the caption", () => {
    render(
      <Waterfall
        steps={steps}
        format="currency"
        currency="USD"
        label="Margin"
      />
    )
    const caption = screen.getByText("Contribution").closest("figcaption")!
    expect(caption).toHaveTextContent(/\$250/)
  })

  it("renders nothing rather than a partial picture when a step is unmeasured", () => {
    // A waterfall missing a cost line reads as complete and is not (PLAN §12.3).
    const gappy: WaterfallStep[] = [
      steps[0],
      { label: "Staff cost", value: null, sign: -1, cumulative: null },
    ]
    const { container } = render(
      <Waterfall
        steps={gappy}
        format="currency"
        currency="USD"
        label="Margin"
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing for an empty decomposition", () => {
    const { container } = render(
      <Waterfall steps={[]} format="currency" currency="USD" label="Margin" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("scales bars against the largest magnitude, not each row's own", () => {
    const { container } = render(
      <Waterfall
        steps={steps}
        format="currency"
        currency="USD"
        label="Margin"
      />
    )
    const widths = [
      ...container.querySelectorAll<HTMLElement>("li span[style]"),
    ].map((node) => Number.parseFloat(node.style.width))
    // Revenue is the largest value here, so it is the full-width reference.
    expect(Math.max(...widths)).toBeCloseTo(100, 5)
    expect(widths.every((width) => width <= 100)).toBe(true)
  })

  it("colours additions and subtractions from opposite ends of the palette", () => {
    const { container } = render(
      <Waterfall
        steps={steps}
        format="currency"
        currency="USD"
        label="Margin"
      />
    )
    const bars = [...container.querySelectorAll<HTMLElement>("li span[style]")]
    expect(bars[0].style.backgroundColor).toContain("--chart-1")
    expect(bars[1].style.backgroundColor).toContain("--chart-8")
  })
})
