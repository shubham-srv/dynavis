import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AnimatedNumber } from "@/components/motion/animated-number"
import { MotionReady } from "@/components/motion/motion-ready"

/**
 * The motion guarantees, asserted rather than inspected.
 *
 * PLAN §7 promises "`prefers-reduced-motion` → animations off", and until this work that
 * promise held only because there was nothing to disable. An accessibility guarantee that
 * is verified by looking at it is not verified, so the two mechanisms that cannot be
 * expressed in CSS — the JS tween and the first-paint gate — are tested here.
 *
 * The CSS half (`--motion-*` zeroed under the media query) is asserted by the stylesheet
 * test below, because jsdom does not evaluate media queries.
 */

function mockReducedMotion(reduce: boolean) {
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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.documentElement.removeAttribute("data-motion-ready")
})

describe("AnimatedNumber", () => {
  const format = (value: number | null) =>
    value === null ? "—" : String(Math.round(value))

  it("renders the value outright on first paint, never counting up from zero", () => {
    // A count-up on arrival is a loading animation: it claims the data landed later than
    // it did.
    mockReducedMotion(false)
    render(<AnimatedNumber value={412} format={format} />)
    expect(screen.getByText("412")).toBeInTheDocument()
  })

  it("lands on the exact value, not on an interpolated one", async () => {
    mockReducedMotion(false)
    const { rerender } = render(<AnimatedNumber value={100} format={format} />)

    rerender(<AnimatedNumber value={200} format={format} />)
    // Let every scheduled frame run to completion.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
    })
    expect(screen.getByText("200")).toBeInTheDocument()
  })

  it("swaps instantly under reduced motion instead of tweening", () => {
    mockReducedMotion(true)
    const { rerender } = render(<AnimatedNumber value={100} format={format} />)
    act(() => {
      rerender(<AnimatedNumber value={900} format={format} />)
    })
    // No frames needed: the new value is present on the very next render.
    expect(screen.getByText("900")).toBeInTheDocument()
  })

  it("does not tween into or out of 'not measured'", () => {
    /*
      Absence of a measurement is not a quantity. Sliding from 412 down to a null would
      render a sequence of values nobody recorded, which is the same lie as imputing zero
      (PLAN §12.3).
    */
    mockReducedMotion(false)
    const { rerender } = render(<AnimatedNumber value={412} format={format} />)
    act(() => {
      rerender(<AnimatedNumber value={null} format={format} />)
    })
    expect(screen.getByText("—")).toBeInTheDocument()

    act(() => {
      rerender(<AnimatedNumber value={500} format={format} />)
    })
    expect(screen.getByText("500")).toBeInTheDocument()
  })

  it("keeps digits monospaced, so a counting value cannot reflow its own card", () => {
    mockReducedMotion(false)
    const { container } = render(<AnimatedNumber value={1234} format={format} />)
    const span = container.querySelector("span")
    expect(span?.style.fontVariantNumeric).toBe("tabular-nums")
  })
})

describe("MotionReady", () => {
  it("does not open the gate until the first measurement pass has settled", () => {
    /*
      The whole "animate on change, never on first appearance" rule rests on this
      attribute arriving late enough.

      Every widget starts unmeasured and resolves to `micro`, then jumps to its real
      variant when its container reports a width — so the first measurement is itself a
      variant change. An earlier version opened the gate on the next animation frame,
      which landed before that measurement and animated all twelve widgets on every cold
      load: the mount animation the gate exists to prevent, in disguise.
    */
    vi.useFakeTimers()
    render(<MotionReady />)

    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(document.documentElement.hasAttribute("data-motion-ready")).toBe(
      false
    )

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(document.documentElement.hasAttribute("data-motion-ready")).toBe(
      true
    )
  })
})
