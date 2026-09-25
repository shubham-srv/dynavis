import type { AcademicCalendar, PeriodRef, ResolvedPeriod } from "./types"

/**
 * Academic-calendar arithmetic.
 *
 * All dates are handled as UTC calendar days (`YYYY-MM-DD`). Nothing here touches local
 * time: a school day is a calendar day, and dragging the host timezone into it produces
 * off-by-one term boundaries that only reproduce for colleagues in other countries.
 */

const DAY_MS = 86_400_000

export function toUtcDays(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) throw new TypeError(`expected YYYY-MM-DD, got "${iso}"`)
  const [, y, m, d] = match
  return Date.UTC(Number(y), Number(m) - 1, Number(d)) / DAY_MS
}

export function fromUtcDays(days: number): string {
  return new Date(days * DAY_MS).toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return fromUtcDays(toUtcDays(iso) + days)
}

/** First day of the academic year labelled `ay-<year>`. */
export function academicYearStart(
  year: number,
  calendar: AcademicCalendar
): string {
  const month = String(calendar.startMonth).padStart(2, "0")
  const day = String(calendar.startDay).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Last day (inclusive) of the academic year labelled `ay-<year>`. */
export function academicYearEnd(
  year: number,
  calendar: AcademicCalendar
): string {
  return addDays(academicYearStart(year + 1, calendar), -1)
}

/**
 * Which academic year a date falls in.
 *
 * The whole hemisphere problem lives in this one comparison. For a September calendar,
 * 2026-06-15 is still `ay-2025`; for a January calendar it is `ay-2026`.
 */
export function academicYearFor(
  iso: string,
  calendar: AcademicCalendar
): string {
  const year = Number(iso.slice(0, 4))
  return `ay-${iso >= academicYearStart(year, calendar) ? year : year - 1}`
}

export function academicYearLabel(
  id: string,
  calendar: AcademicCalendar
): string {
  const year = academicYearNumber(id)
  return calendar.labelStyle === "span"
    ? `${year}/${String((year + 1) % 100).padStart(2, "0")}`
    : `${year}`
}

function academicYearNumber(id: string): number {
  const match = /^ay-(\d{4})/.exec(id)
  if (!match) throw new TypeError(`not an academic-year id: "${id}"`)
  return Number(match[1])
}

/** Does any part of [start, end] fall inside a term? */
export function inSession(
  start: string,
  end: string,
  year: number,
  calendar: AcademicCalendar
): boolean {
  const yearStart = toUtcDays(academicYearStart(year, calendar))
  const from = toUtcDays(start)
  const to = toUtcDays(end)
  return calendar.terms.some((term) => {
    const termStart = yearStart + term.startOffsetDays
    const termEnd = yearStart + term.endOffsetDays
    return from <= termEnd && to >= termStart
  })
}

/**
 * Turn a `PeriodRef` into real dates.
 *
 * Throws on an unparseable id rather than guessing: a period that silently resolves to
 * the wrong range produces numbers that look plausible and are wrong, which is worse
 * than an error.
 */
export function resolvePeriod(
  ref: PeriodRef,
  calendar: AcademicCalendar,
  asOf?: string
): ResolvedPeriod {
  switch (ref.kind) {
    case "academic-year": {
      const year = academicYearNumber(ref.id)
      const start = academicYearStart(year, calendar)
      const end = academicYearEnd(year, calendar)
      return {
        ref,
        label: academicYearLabel(ref.id, calendar),
        start,
        end,
        academicYear: `ay-${year}`,
        inSession: true,
      }
    }

    case "ytd": {
      const year = academicYearNumber(ref.id)
      const start = academicYearStart(year, calendar)
      const end = asOf ?? academicYearEnd(year, calendar)
      return {
        ref,
        label: `${academicYearLabel(ref.id, calendar)} to date`,
        start,
        end,
        academicYear: `ay-${year}`,
        inSession: inSession(start, end, year, calendar),
      }
    }

    case "term": {
      const match = /^ay-(\d{4})-t(\d+)$/.exec(ref.id)
      if (!match) throw new TypeError(`not a term id: "${ref.id}"`)
      const year = Number(match[1])
      const term = calendar.terms[Number(match[2]) - 1]
      if (!term)
        throw new RangeError(
          `calendar "${calendar.id}" has no term ${match[2]}`
        )
      const yearStart = academicYearStart(year, calendar)
      return {
        ref,
        label: `${term.label} ${academicYearLabel(`ay-${year}`, calendar)}`,
        start: addDays(yearStart, term.startOffsetDays),
        end: addDays(yearStart, term.endOffsetDays),
        academicYear: `ay-${year}`,
        inSession: true,
      }
    }

    case "week": {
      const match = /^ay-(\d{4})-w(\d+)$/.exec(ref.id)
      if (!match) throw new TypeError(`not a week id: "${ref.id}"`)
      const year = Number(match[1])
      const week = Number(match[2])
      if (week < 1) throw new RangeError(`week must be >= 1, got ${week}`)
      const yearStart = academicYearStart(year, calendar)
      const start = addDays(yearStart, (week - 1) * 7)
      const end = addDays(start, 6)
      return {
        ref,
        label: `Week ${week}, ${academicYearLabel(`ay-${year}`, calendar)}`,
        start,
        end,
        academicYear: `ay-${year}`,
        inSession: inSession(start, end, year, calendar),
      }
    }

    case "month": {
      const match = /^(\d{4})-(\d{2})$/.exec(ref.id)
      if (!match) throw new TypeError(`not a month id: "${ref.id}"`)
      const year = Number(match[1])
      const month = Number(match[2])
      if (month < 1 || month > 12)
        throw new RangeError(`month must be 1-12, got ${month}`)
      const start = `${match[1]}-${match[2]}-01`
      const end = addDays(
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`,
        -1
      )
      const ay = academicYearFor(start, calendar)
      return {
        ref,
        label: new Date(`${start}T00:00:00Z`).toLocaleString("en", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }),
        start,
        end,
        academicYear: ay,
        inSession: inSession(start, end, academicYearNumber(ay), calendar),
      }
    }

    default: {
      const exhaustive: never = ref.kind
      throw new TypeError(`unknown period kind: ${String(exhaustive)}`)
    }
  }
}

/**
 * The period this one should be compared against — always the equivalent slot in the
 * PRIOR ACADEMIC YEAR, never the prior calendar period.
 *
 * Enrolment in September against August is meaningless; against last September it is the
 * actual signal. Week ids are academic-relative for the same reason: ISO week 40 lands
 * at a different point in the term from one year to the next (PLAN §12.1).
 */
export function comparablePriorPeriod(ref: PeriodRef): PeriodRef {
  switch (ref.kind) {
    case "academic-year":
    case "ytd":
    case "term":
    case "week": {
      const match = /^ay-(\d{4})(.*)$/.exec(ref.id)
      if (!match)
        throw new TypeError(`not an academic-year-scoped id: "${ref.id}"`)
      return { kind: ref.kind, id: `ay-${Number(match[1]) - 1}${match[2]}` }
    }
    case "month": {
      const match = /^(\d{4})-(\d{2})$/.exec(ref.id)
      if (!match) throw new TypeError(`not a month id: "${ref.id}"`)
      return { kind: "month", id: `${Number(match[1]) - 1}-${match[2]}` }
    }
    default: {
      const exhaustive: never = ref.kind
      throw new TypeError(`unknown period kind: ${String(exhaustive)}`)
    }
  }
}
