import { describe, expect, it } from "vitest"

import {
  breakpointFor,
  BREAKPOINTS,
  colSpan,
  COL_SPAN,
  GRID_COLUMNS,
  ORDERED_BREAKPOINTS,
  ROW_UNIT,
  type SizeToken,
} from "@/lib/layout/tokens"

const TOKENS: SizeToken[] = ["sm", "md", "lg", "xl"]

describe("breakpointFor", () => {
  it("maps viewport widths onto the three layouts", () => {
    expect(breakpointFor(375)).toBe("mobile")
    expect(breakpointFor(767)).toBe("mobile")
    expect(breakpointFor(768)).toBe("tablet")
    expect(breakpointFor(1279)).toBe("tablet")
    expect(breakpointFor(1280)).toBe("desktop")
  })

  it("treats a nonsense width as mobile rather than desktop", () => {
    // Guessing wide is the expensive mistake: it lays a 12-column grid into a phone.
    expect(breakpointFor(0)).toBe("mobile")
    expect(breakpointFor(-100)).toBe("mobile")
  })
})

describe("grid tokens", () => {
  it("gives mobile exactly one column", () => {
    // One column on purpose: it removes a whole class of chart-squishing (PLAN §5.2).
    expect(GRID_COLUMNS.mobile).toBe(1)
    for (const token of TOKENS) expect(COL_SPAN.mobile[token]).toBe(1)
  })

  it("never lets a size token exceed the columns available", () => {
    for (const breakpoint of ORDERED_BREAKPOINTS) {
      for (const token of TOKENS) {
        expect(colSpan(token, breakpoint)).toBeLessThanOrEqual(
          GRID_COLUMNS[breakpoint]
        )
        expect(colSpan(token, breakpoint)).toBeGreaterThan(0)
      }
    }
  })

  it("keeps size tokens monotonic, so 'lg' is never narrower than 'md'", () => {
    for (const breakpoint of ORDERED_BREAKPOINTS) {
      const spans = TOKENS.map((token) => colSpan(token, breakpoint))
      expect(spans).toEqual([...spans].sort((a, b) => a - b))
    }
  })

  it("orders the breakpoints by ascending width", () => {
    const widths = ORDERED_BREAKPOINTS.map((b) => BREAKPOINTS[b])
    expect(widths).toEqual([...widths].sort((a, b) => a - b))
  })

  it("uses a positive row unit", () => {
    expect(ROW_UNIT).toBeGreaterThan(0)
  })
})
