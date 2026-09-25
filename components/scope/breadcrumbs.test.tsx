import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Breadcrumbs } from "@/components/scope/breadcrumbs"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { buildBreadcrumbs } from "@/lib/scope/breadcrumbs"
import { resolveScope } from "@/lib/scope/resolve"

const crumbsFor = (ids: string[]) =>
  buildBreadcrumbs(resolveScope(ids, fixtureLookup)!, fixtureLookup)

describe("Breadcrumbs", () => {
  it("is a labelled landmark, so it can be jumped to", () => {
    render(<Breadcrumbs crumbs={crumbsFor(["emea"])} />)
    expect(
      screen.getByRole("navigation", { name: "Scope" })
    ).toBeInTheDocument()
  })

  it("renders the trail in order", () => {
    render(<Breadcrumbs crumbs={crumbsFor(["emea", "uae"])} />)
    const items = screen
      .getAllByRole("listitem")
      .filter((item) => item.textContent?.trim())
    expect(items[0]).toHaveTextContent("Nova Schools Group")
  })

  it("links ancestors and does not link the current location", () => {
    render(<Breadcrumbs crumbs={crumbsFor(["emea", "uae"])} />)
    const nav = screen.getByRole("navigation", { name: "Scope" })

    expect(within(nav).getByRole("link", { name: "EMEA" })).toHaveAttribute(
      "href",
      "/dashboard/emea"
    )
    // A link to where you already are is a lie, and WCAG 2.4.8 wants the location marked.
    expect(
      within(nav).queryByRole("link", { name: "United Arab Emirates" })
    ).not.toBeInTheDocument()
  })

  it("marks exactly one element as the current page", () => {
    const { container } = render(
      <Breadcrumbs crumbs={crumbsFor(["emea", "uae"])} />
    )
    const current = container.querySelectorAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent("United Arab Emirates")
  })

  it("offers siblings so a user can move laterally", () => {
    render(<Breadcrumbs crumbs={crumbsFor(["emea", "uae"])} />)
    const nav = screen.getByRole("navigation", { name: "Scope" })

    expect(
      within(nav).getByLabelText(
        /Switch from United Arab Emirates to another country/i
      )
    ).toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: /^Egypt/ })).toHaveAttribute(
      "href",
      "/dashboard/emea/eg"
    )
  })

  it("names the current sibling in words rather than repeating aria-current", () => {
    render(<Breadcrumbs crumbs={crumbsFor(["emea", "uae"])} />)
    // \s* because accessible-name computation trims each text node before joining.
    expect(
      screen.getByRole("link", { name: /United Arab Emirates\s*\(current\)/ })
    ).toBeInTheDocument()
  })

  it("gives the root no sibling menu", () => {
    render(<Breadcrumbs crumbs={crumbsFor([])} />)
    expect(
      screen.queryByLabelText(/Switch from Nova Schools Group/i)
    ).not.toBeInTheDocument()
  })

  it("collapses a deep trail behind a disclosure rather than dropping levels", () => {
    render(
      <Breadcrumbs
        crumbs={crumbsFor(["emea", "uae", "dubai"])}
        maxVisible={3}
      />
    )
    const nav = screen.getByRole("navigation", { name: "Scope" })

    // Root and the last two stay; the middle is elided but still in the DOM.
    expect(
      within(nav).getByLabelText(/Show 1 hidden level/i)
    ).toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: "EMEA" })).toBeInTheDocument()
    expect(
      within(nav).getByRole("link", { name: "Nova Schools Group" })
    ).toBeInTheDocument()
  })

  it("leaves a short trail uncollapsed", () => {
    render(<Breadcrumbs crumbs={crumbsFor(["emea"])} maxVisible={3} />)
    expect(screen.queryByLabelText(/hidden level/i)).not.toBeInTheDocument()
  })

  it("truncates a long non-ASCII label instead of letting it push the page wide", () => {
    const { container } = render(
      <Breadcrumbs crumbs={crumbsFor(["emea", "uae", "dubai", "sch-dxb-03"])} />
    )
    // The name also appears in its own sibling menu, so scope to the current crumb.
    const currentCrumb = container.querySelector(
      '[aria-current="page"]'
    ) as HTMLElement
    expect(
      within(currentCrumb).getByText(/مدرسة الشيخ زايد/).className
    ).toContain("truncate")
  })
})
