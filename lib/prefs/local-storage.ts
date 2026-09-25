import { parsePrefs } from "./schema"
import type { DashboardPrefs, PrefsRepository } from "./types"

/**
 * Preferences in `localStorage`, behind the interface the .NET endpoint will implement.
 *
 * The POC persists locally; the real product stores per user server-side. Because both
 * sit behind `PrefsRepository`, swapping is a constructor change rather than a rewrite
 * of every caller (PLAN D11, §16).
 *
 * Every access is wrapped: `localStorage` throws in a private window, when site data is
 * blocked, and during some prerender paths. A dashboard must still render when it does.
 */

const PREFIX = "dynavis.prefs"

export function storageKey(userId: string, role: string): string {
  return `${PREFIX}.${userId}.${role}`
}

export class LocalStoragePrefsRepository implements PrefsRepository {
  async load(userId: string, role: string): Promise<DashboardPrefs | null> {
    const raw = read(storageKey(userId, role))
    if (raw === null) return null
    try {
      return parsePrefs(JSON.parse(raw), role)
    } catch {
      // Malformed JSON is treated exactly like no preferences at all.
      return null
    }
  }

  async save(prefs: DashboardPrefs, userId: string): Promise<void> {
    write(storageKey(userId, prefs.role), JSON.stringify(prefs))
  }

  async clear(userId: string, role: string): Promise<void> {
    remove(storageKey(userId, role))
  }
}

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Quota exceeded or storage blocked. Losing a layout preference is an acceptable
    // failure; refusing to let the user rearrange their dashboard is not.
  }
}

function remove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key)
  } catch {
    /* see write() */
  }
}

/** An in-memory repository for tests and for server rendering. */
export class MemoryPrefsRepository implements PrefsRepository {
  private readonly store = new Map<string, DashboardPrefs>()

  async load(userId: string, role: string): Promise<DashboardPrefs | null> {
    return this.store.get(storageKey(userId, role)) ?? null
  }

  async save(prefs: DashboardPrefs, userId: string): Promise<void> {
    this.store.set(storageKey(userId, prefs.role), prefs)
  }

  async clear(userId: string, role: string): Promise<void> {
    this.store.delete(storageKey(userId, role))
  }
}
