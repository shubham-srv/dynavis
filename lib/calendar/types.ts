/**
 * The academic calendar.
 *
 * A multinational school group has schools in both hemispheres, so "this year" is not
 * one date range: northern academic years start in September, southern ones in January.
 * Comparisons must default to the comparable prior *academic* period — September vs.
 * August is noise, September vs. last September is the signal (PLAN §12.1).
 *
 * The calendar is a property of the country/school, never of the group.
 */

export type PeriodKind = "week" | "month" | "term" | "academic-year" | "ytd"

/**
 * A period, by stable id. Ids are designed so the comparable prior period is a pure
 * string transform — no date maths needed to find it.
 *
 *   academic-year  `ay-2025`          → 2025/26 northern, 2025 southern
 *   term           `ay-2025-t2`
 *   month          `2025-09`          calendar month; September is September in both hemispheres
 *   week           `ay-2025-w06`      6th week OF THE ACADEMIC YEAR, not ISO week 6 —
 *                                     term start dates shift, so ISO weeks compare
 *                                     different points in the term year to year
 *   ytd            `ay-2025-ytd`      academic year start → as-of date
 */
export interface PeriodRef {
  kind: PeriodKind
  id: string
}

export interface TermDefinition {
  id: string
  label: string
  /** Offset in days from the start of the academic year. */
  startOffsetDays: number
  /** Inclusive. Offset in days from the start of the academic year. */
  endOffsetDays: number
}

export interface AcademicCalendar {
  id: string
  label: string
  /** Month the academic year opens, 1-12. Northern: 9. Southern: 1. */
  startMonth: number
  startDay: number
  /**
   * How the year reads to a human. A northern year spanning two calendar years is
   * "2025/26"; a southern year inside one calendar year is just "2025".
   */
  labelStyle: "span" | "single"
  terms: readonly TermDefinition[]
}

export interface ResolvedPeriod {
  ref: PeriodRef
  label: string
  /** Inclusive ISO dates, `YYYY-MM-DD`. */
  start: string
  end: string
  /** The academic year this period belongs to, e.g. `ay-2025`. */
  academicYear: string
  /**
   * False when the period contains no teaching days — a week in the summer break.
   * Attendance "last week" over the break is *not applicable*, not 0% (PLAN §12.1).
   */
  inSession: boolean
}
