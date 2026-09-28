import type { BaselineKind } from "@/lib/data/envelope"
import type { SizeToken } from "@/lib/layout/tokens"

import type { DashboardPrefs } from "./types"

/**
 * Every change a user can make to their dashboard, as a pure function.
 *
 * Pure because this is where the bugs would be and because it is the cheapest thing in
 * the product to test exhaustively (PLAN §14, tier 1). The reducer also produces the
 * sentence the live region announces, so what a screen reader hears cannot drift from
 * what actually happened.
 */

export type PrefsAction =
  | { type: "add"; widgetId: string }
  | { type: "remove"; widgetId: string }
  | { type: "move"; widgetId: string; direction: "up" | "down" }
  | { type: "resize"; widgetId: string; size: SizeToken }
  | { type: "set-baseline"; mode: BaselineKind }
  | { type: "reset"; defaults: readonly string[] }

export function defaultPrefs(
  role: string,
  defaults: readonly string[]
): DashboardPrefs {
  return {
    version: 3,
    role,
    widgets: defaults.map((id) => ({ id })),
    // A fresh dashboard has been offered everything it contains, so removing a widget
    // here does not bring it back on the next load.
    seenDefaults: [...defaults],
  }
}

/**
 * Adopt default widgets this dashboard has never been offered.
 *
 * Runs once per load, after storage. A widget added to the defaults in a new release is
 * appended — at the end, never in the middle, because a user's order is theirs and a new
 * arrival must not push their top metric down the page. One that was offered before and
 * is no longer present was removed on purpose and stays gone.
 */
export function adoptNewDefaults(
  prefs: DashboardPrefs,
  defaults: readonly string[]
): DashboardPrefs {
  const seen = new Set(prefs.seenDefaults)
  const unseen = defaults.filter((id) => !seen.has(id))
  if (unseen.length === 0) return prefs

  const present = new Set(prefs.widgets.map((widget) => widget.id))
  return {
    ...prefs,
    widgets: [
      ...prefs.widgets,
      ...unseen.filter((id) => !present.has(id)).map((id) => ({ id })),
    ],
    seenDefaults: [...prefs.seenDefaults, ...unseen],
  }
}

/**
 * Apply an action. Returns the SAME object when nothing changed, so callers can skip a
 * save and a re-render on a no-op (moving the first widget up, say).
 */
export function prefsReducer(
  state: DashboardPrefs,
  action: PrefsAction
): DashboardPrefs {
  switch (action.type) {
    case "add": {
      if (state.widgets.some((w) => w.id === action.widgetId)) return state
      return { ...state, widgets: [...state.widgets, { id: action.widgetId }] }
    }

    case "remove": {
      const widgets = state.widgets.filter((w) => w.id !== action.widgetId)
      return widgets.length === state.widgets.length
        ? state
        : { ...state, widgets }
    }

    case "move": {
      const index = state.widgets.findIndex((w) => w.id === action.widgetId)
      if (index === -1) return state
      const target = action.direction === "up" ? index - 1 : index + 1
      // Clamping rather than wrapping: a widget silently jumping from first to last is
      // disorienting, and the button is hidden at the ends anyway.
      if (target < 0 || target >= state.widgets.length) return state

      const widgets = [...state.widgets]
      ;[widgets[index], widgets[target]] = [widgets[target], widgets[index]]
      return { ...state, widgets }
    }

    case "resize": {
      const index = state.widgets.findIndex((w) => w.id === action.widgetId)
      if (index === -1 || state.widgets[index].sizeOverride === action.size) {
        return state
      }
      const widgets = [...state.widgets]
      widgets[index] = { ...widgets[index], sizeOverride: action.size }
      return { ...state, widgets }
    }

    case "set-baseline": {
      if (state.matrix?.baselineMode === action.mode) return state
      return {
        ...state,
        matrix: { ...state.matrix, baselineMode: action.mode },
      }
    }

    case "reset":
      return defaultPrefs(state.role, action.defaults)

    default: {
      const exhaustive: never = action
      throw new TypeError(`unknown prefs action: ${JSON.stringify(exhaustive)}`)
    }
  }
}

/**
 * What to say out loud after an action.
 *
 * Reordering with a button moves something on screen without moving focus, so it is
 * silent to a screen reader unless announced (WCAG 4.1.3, PLAN §10). Derived from the
 * resulting state rather than passed in, so the announcement cannot claim a move that
 * did not happen.
 */
export function announce(
  action: PrefsAction,
  next: DashboardPrefs,
  titleOf: (widgetId: string) => string
): string {
  const total = next.widgets.length

  switch (action.type) {
    case "add":
      return `${titleOf(action.widgetId)} added. ${total} ${plural(total)} on your dashboard.`
    case "remove":
      return `${titleOf(action.widgetId)} removed. ${total} ${plural(total)} on your dashboard.`
    case "move": {
      const index = next.widgets.findIndex((w) => w.id === action.widgetId)
      if (index === -1) return ""
      return `${titleOf(action.widgetId)} moved to position ${index + 1} of ${total}.`
    }
    case "resize":
      return `${titleOf(action.widgetId)} resized to ${action.size}.`
    case "set-baseline":
      return `Comparing against ${action.mode.replace("-", " ")}.`
    case "reset":
      return `Dashboard reset. ${total} ${plural(total)} restored.`
    default:
      return ""
  }
}

function plural(count: number): string {
  return count === 1 ? "widget" : "widgets"
}

/** Is this widget currently on the dashboard? */
export function isSelected(prefs: DashboardPrefs, widgetId: string): boolean {
  return prefs.widgets.some((w) => w.id === widgetId)
}
