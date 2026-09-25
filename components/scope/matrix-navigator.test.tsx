import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { MatrixNavigator } from "@/components/scope/matrix-navigator"
import { CURRENT_ACADEMIC_YEAR } from "@/lib/data/fixtures/org"
import { buildMatrix } from "@/lib/matrix/build"

const period = { kind: "academic-year", id: CURRENT_ACADEMIC_YEAR } as const
const hrefFor = (id: string) => `/dashboard/emea/${id}`

const matrix = buildMatrix({
  scopeId: "emea",
  kpiIds: ["seatUtilisation", "attainmentRate", "costPerStudent"],
  period,
})

const wide = (props = {}) =>
  render(
    <MatrixNavigator
      matrix={matrix}
      variant="expanded"
      hrefFor={hrefFor}
      {...props}
    />
  )

describe("MatrixNavigator — wide", () => {
  it("is a real table with row and column headers", () => {
    wide()
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: /Name/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("rowheader", { name: /United Arab Emirates/ })
    ).toBeInTheDocument()
  })

  it("makes every row a link, so drilling is the navigation", () => {
    // Links, not click handlers: middle-click and open-in-new-tab must work, which
    // analysts absolutely expect (PLAN §8.2).
    wide()
    expect(
      screen.getByRole("link", { name: /United Arab Emirates/ })
    ).toHaveAttribute("href", "/dashboard/emea/uae")
  })

  it("labels each column with the baseline it resolved to", () => {
    wide()
    const seats = screen.getByRole("columnheader", { name: /Seats/ })
    expect(seats).toHaveTextContent(/vs\./)
  })

  it("sorts on click and reports it via aria-sort", async () => {
    wide()
    const header = screen.getByRole("columnheader", { name: /Seats/ })
    expect(header).toHaveAttribute("aria-sort", "none")

    await userEvent.click(within(header).getByRole("button"))
    expect(header).toHaveAttribute("aria-sort", "descending")

    await userEvent.click(within(header).getByRole("button"))
    expect(header).toHaveAttribute("aria-sort", "ascending")

    await userEvent.click(within(header).getByRole("button"))
    expect(header).toHaveAttribute("aria-sort", "none")
  })

  it("marks only one column as sorted at a time", async () => {
    wide()
    await userEvent.click(
      within(screen.getByRole("columnheader", { name: /Seats/ })).getByRole(
        "button"
      )
    )
    await userEvent.click(
      within(
        screen.getByRole("columnheader", { name: /Attainment/ })
      ).getByRole("button")
    )
    const sorted = screen
      .getAllByRole("columnheader")
      .filter((header) => header.getAttribute("aria-sort") !== "none")
      .filter((header) => header.hasAttribute("aria-sort"))
    expect(sorted).toHaveLength(1)
  })

  it("announces a cell with its row, column, value and baseline", () => {
    // A number whose comparison is unstated is not a fact (PLAN §8.8).
    wide()
    const cells = screen.getAllByRole("cell")
    const labelled = cells.find((cell) =>
      /United Arab Emirates, Seat utilisation/.test(
        cell.getAttribute("aria-label") ?? ""
      )
    )
    expect(labelled).toBeDefined()
    expect(labelled!.getAttribute("aria-label")).toMatch(/vs\.|no comparison/)
  })

  it("says why a cell is empty rather than leaving a bare dash", () => {
    const sparse = buildMatrix({
      scopeId: "eg",
      kpiIds: ["progressScore"],
      period,
    })
    render(
      <MatrixNavigator matrix={sparse} variant="expanded" hrefFor={hrefFor} />
    )
    expect(
      screen.getAllByText(/not reported in this country/i).length
    ).toBeGreaterThan(0)
  })

  it("shows fewer columns at the standard variant", () => {
    const { container } = render(
      <MatrixNavigator matrix={matrix} variant="standard" hrefFor={hrefFor} />
    )
    // Name + at most 4 metric columns.
    expect(container.querySelectorAll("thead th").length).toBeLessThanOrEqual(5)
  })

  describe("keyboard grid", () => {
    it("has one tab stop, then moves with the arrow keys", async () => {
      // 6 rows x 6 columns of individually tabbable cells would bury the rest of the
      // page; analysts expect arrow navigation in a table (PLAN §8.8).
      wide()
      const table = screen.getByRole("table")
      const tabbable = within(table)
        .getAllByRole("cell")
        .concat(within(table).getAllByRole("rowheader"))
        .filter((cell) => cell.getAttribute("tabindex") === "0")
      expect(tabbable.length).toBeLessThanOrEqual(1)

      await userEvent.tab()
      await userEvent.tab()
      const firstRowLink = screen.getAllByRole("link")[0]
      firstRowLink.focus()

      await userEvent.keyboard("{ArrowRight}")
      expect(document.activeElement?.getAttribute("data-cell")).toBe("0-0")

      await userEvent.keyboard("{ArrowDown}")
      expect(document.activeElement?.getAttribute("data-cell")).toBe("1-0")

      await userEvent.keyboard("{ArrowLeft}")
      expect(document.activeElement?.getAttribute("data-cell")).toBe("1--1")
    })

    it("clamps at the edges instead of wrapping", async () => {
      wide()
      screen.getAllByRole("link")[0].focus()
      await userEvent.keyboard("{ArrowUp}{ArrowLeft}")
      expect(document.activeElement?.getAttribute("data-cell")).toBe("0--1")

      await userEvent.keyboard("{End}")
      expect(document.activeElement?.getAttribute("data-cell")).toBe("0-2")
      await userEvent.keyboard("{ArrowRight}")
      expect(document.activeElement?.getAttribute("data-cell")).toBe("0-2")
    })
  })
})

describe("MatrixNavigator — narrow", () => {
  it("becomes a ranked list, not a shrunken grid", () => {
    // A 12-column grid is unreadable at 375px at any font size that fits (PLAN §8.7).
    render(
      <MatrixNavigator matrix={matrix} variant="compact" hrefFor={hrefFor} />
    )
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(
      screen.getByRole("combobox", { name: /ranked by/i })
    ).toBeInTheDocument()
    expect(screen.getAllByRole("link").length).toBe(matrix.rows.length)
  })

  it("lets the reader choose which KPI ranks the list", async () => {
    render(
      <MatrixNavigator matrix={matrix} variant="compact" hrefFor={hrefFor} />
    )
    const select = screen.getByRole("combobox", { name: /ranked by/i })
    await userEvent.selectOptions(select, "costPerStudent")
    expect(select).toHaveValue("costPerStudent")
  })

  it("shows top and bottom at the narrowest size", () => {
    const dubai = buildMatrix({
      scopeId: "dubai",
      kpiIds: ["attainmentRate"],
      period,
    })
    render(<MatrixNavigator matrix={dubai} variant="micro" hrefFor={hrefFor} />)
    expect(screen.getByRole("heading", { name: "Top" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Bottom" })).toBeInTheDocument()
  })

  it("still links every row to its drill target", () => {
    render(
      <MatrixNavigator matrix={matrix} variant="compact" hrefFor={hrefFor} />
    )
    expect(
      screen.getByRole("link", { name: /United Arab Emirates/ })
    ).toHaveAttribute("href", "/dashboard/emea/uae")
  })
})

describe("MatrixNavigator — nothing to show", () => {
  it("renders nothing at a leaf rather than an empty table", () => {
    const leaf = buildMatrix({
      scopeId: "sch-dxb-01",
      kpiIds: ["attainmentRate"],
      period,
    })
    const { container } = render(
      <MatrixNavigator matrix={leaf} variant="expanded" hrefFor={hrefFor} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
