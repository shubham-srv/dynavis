import type { AcademicCalendar } from "./types"

/**
 * The calendars in play across the group.
 *
 * Real deployments will read these from the backend per country — term dates differ by
 * country and shift year to year. They live here as reference data so the POC has both
 * hemispheres from day one, which is the only way the comparison logic gets exercised
 * (PLAN §12.1).
 */

/** September start. UK, UAE, Egypt, most of the northern group. */
export const NORTHERN: AcademicCalendar = {
  id: "northern",
  label: "September start",
  startMonth: 9,
  startDay: 1,
  labelStyle: "span",
  terms: [
    { id: "t1", label: "Autumn", startOffsetDays: 0, endOffsetDays: 106 },
    { id: "t2", label: "Spring", startOffsetDays: 130, endOffsetDays: 235 },
    { id: "t3", label: "Summer", startOffsetDays: 250, endOffsetDays: 320 },
  ],
}

/** Mid-January start, four terms. Australia, South Africa. */
export const SOUTHERN: AcademicCalendar = {
  id: "southern",
  label: "January start",
  startMonth: 1,
  startDay: 15,
  labelStyle: "single",
  terms: [
    { id: "t1", label: "Term 1", startOffsetDays: 0, endOffsetDays: 75 },
    { id: "t2", label: "Term 2", startOffsetDays: 90, endOffsetDays: 160 },
    { id: "t3", label: "Term 3", startOffsetDays: 175, endOffsetDays: 245 },
    { id: "t4", label: "Term 4", startOffsetDays: 260, endOffsetDays: 330 },
  ],
}

export const CALENDARS = { northern: NORTHERN, southern: SOUTHERN } as const
export type CalendarId = keyof typeof CALENDARS

export function calendarById(id: string): AcademicCalendar {
  const calendar = CALENDARS[id as CalendarId]
  if (!calendar) throw new RangeError(`unknown academic calendar: "${id}"`)
  return calendar
}
