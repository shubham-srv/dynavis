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
  version: 2
  role: string
  /** Order IS the array order. */
  widgets: { id: string; sizeOverride?: SizeToken }[]
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
