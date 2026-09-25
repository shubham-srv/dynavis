import { describe, expect, it } from "vitest"

import {
  academicYearEnd,
  academicYearFor,
  academicYearLabel,
  academicYearStart,
  addDays,
  comparablePriorPeriod,
  fromUtcDays,
  resolvePeriod,
  toUtcDays,
} from "@/lib/calendar/academic"
import { calendarById, NORTHERN, SOUTHERN } from "@/lib/calendar/calendars"

describe("date helpers", () => {
  it("round-trips ISO days through UTC without timezone drift", () => {
    for (const iso of [
      "2025-01-01",
      "2024-02-29",
      "2025-12-31",
      "2026-06-15",
    ]) {
      expect(fromUtcDays(toUtcDays(iso))).toBe(iso)
    }
  })

  it("crosses month, year and leap boundaries", () => {
    expect(addDays("2025-08-31", 1)).toBe("2025-09-01")
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01")
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29")
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01")
    expect(addDays("2025-01-01", -1)).toBe("2024-12-31")
  })

  it("rejects anything that is not a calendar day", () => {
    expect(() => toUtcDays("2025-9-1")).toThrow(TypeError)
    expect(() => toUtcDays("2025-09-01T00:00:00Z")).toThrow(TypeError)
  })
})

describe("academicYearFor — the hemisphere problem", () => {
  it("puts a northern summer date in the year that is ending, not the one starting", () => {
    expect(academicYearFor("2025-09-01", NORTHERN)).toBe("ay-2025")
    expect(academicYearFor("2025-10-15", NORTHERN)).toBe("ay-2025")
    expect(academicYearFor("2026-06-15", NORTHERN)).toBe("ay-2025")
    expect(academicYearFor("2025-08-31", NORTHERN)).toBe("ay-2024")
  })

  it("splits the southern year on its own mid-January boundary", () => {
    expect(academicYearFor("2025-01-14", SOUTHERN)).toBe("ay-2024")
    expect(academicYearFor("2025-01-15", SOUTHERN)).toBe("ay-2025")
    expect(academicYearFor("2025-12-20", SOUTHERN)).toBe("ay-2025")
  })

  it("gives the same calendar date different academic years by hemisphere", () => {
    // The bug this guards: one group-wide date range for "this year".
    expect(academicYearFor("2025-06-15", NORTHERN)).toBe("ay-2024")
    expect(academicYearFor("2025-06-15", SOUTHERN)).toBe("ay-2025")
  })

  it("bounds the year without gaps or overlaps", () => {
    expect(academicYearStart(2025, NORTHERN)).toBe("2025-09-01")
    expect(academicYearEnd(2025, NORTHERN)).toBe("2026-08-31")
    expect(addDays(academicYearEnd(2025, NORTHERN), 1)).toBe(
      academicYearStart(2026, NORTHERN)
    )
    expect(addDays(academicYearEnd(2025, SOUTHERN), 1)).toBe(
      academicYearStart(2026, SOUTHERN)
    )
  })
})

describe("academicYearLabel", () => {
  it("spans two calendar years in the north and one in the south", () => {
    expect(academicYearLabel("ay-2025", NORTHERN)).toBe("2025/26")
    expect(academicYearLabel("ay-2099", NORTHERN)).toBe("2099/00")
    expect(academicYearLabel("ay-2025", SOUTHERN)).toBe("2025")
  })

  it("rejects ids that are not academic years", () => {
    expect(() => academicYearLabel("2025-09", NORTHERN)).toThrow(TypeError)
  })
})

describe("resolvePeriod", () => {
  it("resolves an academic year to its full span", () => {
    const period = resolvePeriod(
      { kind: "academic-year", id: "ay-2025" },
      NORTHERN
    )
    expect(period).toMatchObject({
      start: "2025-09-01",
      end: "2026-08-31",
      label: "2025/26",
      inSession: true,
    })
  })

  it("resolves a term from its offsets", () => {
    const period = resolvePeriod({ kind: "term", id: "ay-2025-t2" }, NORTHERN)
    expect(period.start).toBe("2026-01-09")
    expect(period.label).toBe("Spring 2025/26")
    expect(period.academicYear).toBe("ay-2025")
  })

  it("resolves ytd against an as-of date, falling back to the year end", () => {
    const withAsOf = resolvePeriod(
      { kind: "ytd", id: "ay-2025-ytd" },
      NORTHERN,
      "2025-11-30"
    )
    expect(withAsOf).toMatchObject({ start: "2025-09-01", end: "2025-11-30" })
    expect(
      resolvePeriod({ kind: "ytd", id: "ay-2025-ytd" }, NORTHERN).end
    ).toBe("2026-08-31")
  })

  it("counts weeks from the academic year start, not the ISO year", () => {
    const week1 = resolvePeriod({ kind: "week", id: "ay-2025-w01" }, NORTHERN)
    expect(week1).toMatchObject({
      start: "2025-09-01",
      end: "2025-09-07",
      inSession: true,
    })
    expect(
      resolvePeriod({ kind: "week", id: "ay-2025-w06" }, NORTHERN).start
    ).toBe("2025-10-06")
  })

  it("marks a break week as out of session — attendance then is N/A, not zero", () => {
    // Northern summer term ends at offset 320 (2026-07-18); the year runs to 2026-08-31.
    const breakWeek = resolvePeriod(
      { kind: "week", id: "ay-2025-w49" },
      NORTHERN
    )
    expect(breakWeek.inSession).toBe(false)
    expect(
      resolvePeriod({ kind: "week", id: "ay-2025-w10" }, NORTHERN).inSession
    ).toBe(true)
  })

  it("treats months as calendar months and attributes them to the right academic year", () => {
    const september = resolvePeriod({ kind: "month", id: "2025-09" }, NORTHERN)
    expect(september).toMatchObject({
      start: "2025-09-01",
      end: "2025-09-30",
      academicYear: "ay-2025",
    })
    expect(
      resolvePeriod({ kind: "month", id: "2025-06" }, NORTHERN).academicYear
    ).toBe("ay-2024")
    expect(
      resolvePeriod({ kind: "month", id: "2025-06" }, SOUTHERN).academicYear
    ).toBe("ay-2025")
    expect(resolvePeriod({ kind: "month", id: "2025-12" }, NORTHERN).end).toBe(
      "2025-12-31"
    )
    expect(resolvePeriod({ kind: "month", id: "2024-02" }, NORTHERN).end).toBe(
      "2024-02-29"
    )
  })

  it("throws on a malformed or out-of-range id rather than guessing a range", () => {
    expect(() =>
      resolvePeriod({ kind: "term", id: "ay-2025" }, NORTHERN)
    ).toThrow(TypeError)
    expect(() =>
      resolvePeriod({ kind: "term", id: "ay-2025-t9" }, NORTHERN)
    ).toThrow(RangeError)
    expect(() =>
      resolvePeriod({ kind: "week", id: "ay-2025-w00" }, NORTHERN)
    ).toThrow(RangeError)
    expect(() => resolvePeriod({ kind: "week", id: "nope" }, NORTHERN)).toThrow(
      TypeError
    )
    expect(() =>
      resolvePeriod({ kind: "month", id: "2025-13" }, NORTHERN)
    ).toThrow(RangeError)
    expect(() =>
      resolvePeriod({ kind: "month", id: "2025" }, NORTHERN)
    ).toThrow(TypeError)
    expect(() =>
      resolvePeriod({ kind: "nonsense" as never, id: "x" }, NORTHERN)
    ).toThrow(TypeError)
  })
})

describe("comparablePriorPeriod", () => {
  it("steps back one academic year for every academic-relative period", () => {
    expect(
      comparablePriorPeriod({ kind: "academic-year", id: "ay-2025" })
    ).toEqual({
      kind: "academic-year",
      id: "ay-2024",
    })
    expect(comparablePriorPeriod({ kind: "term", id: "ay-2025-t2" }).id).toBe(
      "ay-2024-t2"
    )
    expect(comparablePriorPeriod({ kind: "week", id: "ay-2025-w06" }).id).toBe(
      "ay-2024-w06"
    )
    expect(comparablePriorPeriod({ kind: "ytd", id: "ay-2025-ytd" }).id).toBe(
      "ay-2024-ytd"
    )
  })

  it("compares September to last September, never to August", () => {
    expect(comparablePriorPeriod({ kind: "month", id: "2025-09" })).toEqual({
      kind: "month",
      id: "2024-09",
    })
  })

  it("preserves the period kind, so a week never degrades into a month", () => {
    for (const ref of [
      { kind: "week", id: "ay-2025-w06" },
      { kind: "term", id: "ay-2025-t1" },
      { kind: "month", id: "2025-03" },
    ] as const) {
      expect(comparablePriorPeriod(ref).kind).toBe(ref.kind)
    }
  })

  it("throws on ids it cannot step back", () => {
    expect(() => comparablePriorPeriod({ kind: "term", id: "t2" })).toThrow(
      TypeError
    )
    expect(() => comparablePriorPeriod({ kind: "month", id: "bad" })).toThrow(
      TypeError
    )
    expect(() =>
      comparablePriorPeriod({ kind: "nonsense" as never, id: "x" })
    ).toThrow(TypeError)
  })
})

describe("calendarById", () => {
  it("resolves known calendars and rejects unknown ones", () => {
    expect(calendarById("northern")).toBe(NORTHERN)
    expect(calendarById("southern")).toBe(SOUTHERN)
    expect(() => calendarById("martian")).toThrow(RangeError)
  })
})
