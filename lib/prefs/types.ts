import type { BaselineKind } from "@/lib/data/envelope"
import type { SizeToken } from "@/lib/layout/tokens"

/**
 * What a user has chosen to see.
 *
 * An ordered list of ids and nothing else — no x/y coordinates, no pixel sizes. Position
 * is derived by the layout, never stored (PLAN D3, §5.5). That is what keeps this
 * trivially serialisable, diffable and migratable, and what lets the same preferences
 * render correctly at three breakpoints.
 *
 * Preferences are **per role**: a principal's dashboard is not a regional manager's, and
 * storing one blob for both would show a principal widgets they cannot use.
 */
export interface DashboardPrefs {
  version: 3
  role: string
  /** Order IS the array order. */
  widgets: { id: string; sizeOverride?: SizeToken }[]
  /**
   * Default widgets this dashboard has already been offered.
   *
   * Without it, a widget added to `DEFAULT_WIDGET_IDS` in a new release never reaches
   * anyone who has ever customised their dashboard: their saved list is complete as far
   * as the loader is concerned, so the new widget is simply invisible. That is exactly
   * what happened when the quadrant chart shipped — it appeared for roles with no saved
   * preferences and for nobody else, which looked like a rendering bug.
   *
   * Comparing against the defaults directly would not work, because it cannot tell "never
   * offered" from "offered and removed" — it would resurrect a widget every time the user
   * deleted it. This records what has been offered, so a new default is added once and a
   * removed one stays removed.
   */
  seenDefaults: string[]
  matrix?: {
    visibleKpis?: string[]
    baselineMode?: BaselineKind
  }
}

export interface PrefsRepository {
  load(userId: string, role: string): Promise<DashboardPrefs | null>
  save(prefs: DashboardPrefs, userId: string): Promise<void>
  clear(userId: string, role: string): Promise<void>
}
