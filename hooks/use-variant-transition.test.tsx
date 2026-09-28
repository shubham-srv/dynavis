import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useVariantTransition } from "@/hooks/use-variant-transition"
import type { Variant } from "@/lib/viz/variants"

/**
 * The animation must fire on a threshold crossing and at no other time.
 *
 * Worth its own file because the failure mode is invisible to every other test and very
 * visible to a user: the previous version leaned on a global "page has painted" flag,
 * which is set once and never cleared, so from the second navigation onwards every widget
 * mounted mid-animation. Drilling into a scope slid all six cards up at once and read as
 * the dashboard reshuffling itself.
 */

function Probe({ variant }: { variant: Variant }) {
  const ref = useVariantTransition<HTMLDivElement>(variant)
  return <div ref={ref} data-testid="body" />
}

function stubMotion(reduce = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reduce : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
}

describe("useVariantTransition", () => {
  it("does not animate on mount", () => {
    stubMotion()
    const { getByTestId } = render(<Probe variant="compact" />)
    expect(getByTestId("body").className).not.toContain("variant-enter")
    vi.unstubAllGlobals()
  })

  it("animates when the variant actually changes", () => {
    stubMotion()
    const { getByTestId, rerender } = render(<Probe variant="compact" />)
    rerender(<Probe variant="standard" />)
    expect(getByTestId("body").className).toContain("variant-enter")
    vi.unstubAllGlobals()
  })

  it("stays still when the widget re-renders at the same variant", () => {
    // Drilling re-renders every widget with new data at an unchanged width. That is not a
    // form change and must not move anything.
    stubMotion()
    const { getByTestId, rerender } = render(<Probe variant="standard" />)
    rerender(<Probe variant="standard" />)
    rerender(<Probe variant="standard" />)
    expect(getByTestId("body").className).not.toContain("variant-enter")
    vi.unstubAllGlobals()
  })

  it("stays still on a fresh mount, however many have come before", () => {
    /*
      The exact regression. A client-side navigation unmounts the dashboard and mounts a
      new one; each widget is a first render again. Nothing may animate, even though the
      page has been alive for a while.
    */
    stubMotion()
    const first = render(<Probe variant="standard" />)
    first.rerender(<Probe variant="expanded" />)
    first.unmount()

    const second = render(<Probe variant="expanded" />)
    expect(second.getByTestId("body").className).not.toContain("variant-enter")
    vi.unstubAllGlobals()
  })

  it("does nothing at all under reduced motion", () => {
    stubMotion(true)
    const { getByTestId, rerender } = render(<Probe variant="compact" />)
    rerender(<Probe variant="expanded" />)
    expect(getByTestId("body").className).not.toContain("variant-enter")
    vi.unstubAllGlobals()
  })
})
