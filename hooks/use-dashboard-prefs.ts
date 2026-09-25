"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { LocalStoragePrefsRepository } from "@/lib/prefs/local-storage"
import {
  announce as describeAction,
  defaultPrefs,
  prefsReducer,
  type PrefsAction,
} from "@/lib/prefs/reducer"
import { pruneUnknownWidgets } from "@/lib/prefs/schema"
import type { DashboardPrefs, PrefsRepository } from "@/lib/prefs/types"

/**
 * Dashboard preferences: load, apply, persist, undo.
 *
 * Starts from the role's defaults so the first render is correct without waiting on
 * storage, then adopts anything saved. Rendering the defaults briefly is right: a user
 * with no saved preferences sees their dashboard immediately, and one with saved
 * preferences sees them a tick later rather than seeing an empty box first.
 */

export interface UseDashboardPrefs {
  prefs: DashboardPrefs
  dispatch: (action: PrefsAction) => void
  /** The last thing that happened, for the live region. */
  announcement: string
  /** Present when the last action can be taken back. */
  undo: { label: string; run: () => void } | null
  dismissUndo: () => void
}

const UNDO_TIMEOUT_MS = 10_000

export function useDashboardPrefs({
  role,
  defaults,
  titleOf,
  widgetExists,
  userId = "demo",
  repository,
}: {
  role: string
  defaults: readonly string[]
  titleOf: (widgetId: string) => string
  widgetExists: (widgetId: string) => boolean
  userId?: string
  repository?: PrefsRepository
}): UseDashboardPrefs {
  const repo = useRef<PrefsRepository>(
    repository ?? new LocalStoragePrefsRepository()
  )
  const [prefs, setPrefs] = useState<DashboardPrefs>(() =>
    defaultPrefs(role, defaults)
  )
  const [announcement, setAnnouncement] = useState("")
  const [undo, setUndo] = useState<UseDashboardPrefs["undo"]>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load saved preferences for this role. Changing role loads a different dashboard,
  // which is the whole point of keying storage by role.
  useEffect(() => {
    let cancelled = false
    void repo.current.load(userId, role).then((loaded) => {
      if (cancelled) return
      // A widget can be retired between deploys; a saved id pointing at nothing would
      // throw on render and the user cannot reach the dashboard to fix it.
      if (loaded) setPrefs(pruneUnknownWidgets(loaded, widgetExists))
      else setPrefs(defaultPrefs(role, defaults))
    })
    return () => {
      cancelled = true
    }
    // `defaults` and the callbacks are stable per role in practice; re-running on every
    // render would refetch storage continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, userId])

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    },
    []
  )

  const dispatch = useCallback(
    (action: PrefsAction) => {
      setPrefs((current) => {
        const next = prefsReducer(current, action)
        // Identity means nothing changed — skip the save, the announcement and the
        // undo offer rather than telling the user something happened.
        if (next === current) return current

        void repo.current.save(next, userId)
        setAnnouncement(describeAction(action, next, titleOf))

        if (isUndoable(action)) {
          if (undoTimer.current) clearTimeout(undoTimer.current)
          setUndo({
            label: undoLabel(action, titleOf),
            run: () => {
              setPrefs(current)
              void repo.current.save(current, userId)
              setAnnouncement(`${undoLabel(action, titleOf)} undone.`)
              setUndo(null)
            },
          })
          undoTimer.current = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS)
        }

        return next
      })
    },
    [titleOf, userId]
  )

  const dismissUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndo(null)
  }, [])

  return { prefs, dispatch, announcement, undo, dismissUndo }
}

/** Resizing and switching baseline are visible and trivially repeatable; the rest are not. */
function isUndoable(action: PrefsAction): boolean {
  return (
    action.type === "remove" ||
    action.type === "add" ||
    action.type === "reset" ||
    action.type === "move"
  )
}

function undoLabel(
  action: PrefsAction,
  titleOf: (widgetId: string) => string
): string {
  switch (action.type) {
    case "add":
      return `Added ${titleOf(action.widgetId)}`
    case "remove":
      return `Removed ${titleOf(action.widgetId)}`
    case "move":
      return `Moved ${titleOf(action.widgetId)}`
    case "reset":
      return "Reset dashboard"
    default:
      return "Change"
  }
}
