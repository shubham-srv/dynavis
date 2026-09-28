import { beforeEach, describe, expect, it } from "vitest"

import {
  LocalStoragePrefsRepository,
  MemoryPrefsRepository,
  storageKey,
} from "@/lib/prefs/local-storage"
import {
  announce,
  defaultPrefs,
  isSelected,
  prefsReducer,
  type PrefsAction,
} from "@/lib/prefs/reducer"
import { parsePrefs, pruneUnknownWidgets } from "@/lib/prefs/schema"
import { adoptNewDefaults } from "@/lib/prefs/reducer"
import type { DashboardPrefs } from "@/lib/prefs/types"

const base = (): DashboardPrefs =>
  defaultPrefs("super-admin", ["card.a", "card.b", "card.c"])

const titleOf = (id: string) => id.replace("card.", "").toUpperCase()

describe("prefsReducer", () => {
  it("appends a widget to the end", () => {
    const next = prefsReducer(base(), { type: "add", widgetId: "card.d" })
    expect(next.widgets.map((w) => w.id)).toEqual([
      "card.a",
      "card.b",
      "card.c",
      "card.d",
    ])
  })

  it("ignores adding something already there", () => {
    const state = base()
    // Same object back, so callers can skip a save and a re-render.
    expect(prefsReducer(state, { type: "add", widgetId: "card.b" })).toBe(state)
  })

  it("removes a widget and leaves the rest in order", () => {
    const next = prefsReducer(base(), { type: "remove", widgetId: "card.b" })
    expect(next.widgets.map((w) => w.id)).toEqual(["card.a", "card.c"])
  })

  it("ignores removing something that is not there", () => {
    const state = base()
    expect(prefsReducer(state, { type: "remove", widgetId: "nope" })).toBe(
      state
    )
  })

  it("swaps neighbours when moving", () => {
    const next = prefsReducer(base(), {
      type: "move",
      widgetId: "card.c",
      direction: "up",
    })
    expect(next.widgets.map((w) => w.id)).toEqual([
      "card.a",
      "card.c",
      "card.b",
    ])
  })

  it("clamps at the ends rather than wrapping", () => {
    // A widget silently jumping from first to last is disorienting.
    const state = base()
    expect(
      prefsReducer(state, { type: "move", widgetId: "card.a", direction: "up" })
    ).toBe(state)
    expect(
      prefsReducer(state, {
        type: "move",
        widgetId: "card.c",
        direction: "down",
      })
    ).toBe(state)
  })

  it("is reversible: up then down returns the original order", () => {
    const state = base()
    const moved = prefsReducer(state, {
      type: "move",
      widgetId: "card.b",
      direction: "up",
    })
    const back = prefsReducer(moved, {
      type: "move",
      widgetId: "card.b",
      direction: "down",
    })
    expect(back.widgets).toEqual(state.widgets)
  })

  it("records a size override without touching order", () => {
    const next = prefsReducer(base(), {
      type: "resize",
      widgetId: "card.b",
      size: "lg",
    })
    expect(next.widgets[1]).toEqual({ id: "card.b", sizeOverride: "lg" })
    expect(next.widgets.map((w) => w.id)).toEqual([
      "card.a",
      "card.b",
      "card.c",
    ])
  })

  it("stores the matrix baseline mode", () => {
    const next = prefsReducer(base(), {
      type: "set-baseline",
      mode: "peer-median",
    })
    expect(next.matrix?.baselineMode).toBe("peer-median")
    expect(
      prefsReducer(next, { type: "set-baseline", mode: "peer-median" })
    ).toBe(next)
  })

  it("resets to the role's defaults, keeping the role", () => {
    const edited = prefsReducer(base(), { type: "remove", widgetId: "card.a" })
    const reset = prefsReducer(edited, {
      type: "reset",
      defaults: ["card.x", "card.y"],
    })
    expect(reset.widgets.map((w) => w.id)).toEqual(["card.x", "card.y"])
    expect(reset.role).toBe("super-admin")
  })

  it("never mutates the state it was given", () => {
    const state = base()
    const snapshot = structuredClone(state)
    for (const action of [
      { type: "add", widgetId: "card.z" },
      { type: "remove", widgetId: "card.a" },
      { type: "move", widgetId: "card.b", direction: "up" },
      { type: "resize", widgetId: "card.b", size: "lg" },
    ] as PrefsAction[]) {
      prefsReducer(state, action)
    }
    expect(state).toEqual(snapshot)
  })

  it("throws on an unknown action rather than silently doing nothing", () => {
    expect(() =>
      prefsReducer(base(), { type: "teleport" } as unknown as PrefsAction)
    ).toThrow(TypeError)
  })
})

describe("announce", () => {
  it("names the widget and its new position", () => {
    // Reordering moves something on screen without moving focus, so it is silent to a
    // screen reader unless said out loud (WCAG 4.1.3).
    const state = base()
    const action: PrefsAction = {
      type: "move",
      widgetId: "card.c",
      direction: "up",
    }
    expect(announce(action, prefsReducer(state, action), titleOf)).toBe(
      "C moved to position 2 of 3."
    )
  })

  it("reports the resulting count on add and remove", () => {
    const state = base()
    const add: PrefsAction = { type: "add", widgetId: "card.d" }
    expect(announce(add, prefsReducer(state, add), titleOf)).toBe(
      "D added. 4 widgets on your dashboard."
    )
    const remove: PrefsAction = { type: "remove", widgetId: "card.a" }
    expect(announce(remove, prefsReducer(state, remove), titleOf)).toContain(
      "2 widgets"
    )
  })

  it("uses the singular for one widget", () => {
    const one = defaultPrefs("r", ["card.a"])
    const remove: PrefsAction = { type: "remove", widgetId: "card.a" }
    const two = defaultPrefs("r", ["card.a", "card.b"])
    expect(announce(remove, prefsReducer(two, remove), titleOf)).toContain(
      "1 widget on"
    )
    expect(one.widgets).toHaveLength(1)
  })

  it("is derived from the resulting state, so it cannot claim a move that did not happen", () => {
    const state = base()
    const action: PrefsAction = {
      type: "move",
      widgetId: "missing",
      direction: "up",
    }
    expect(announce(action, prefsReducer(state, action), titleOf)).toBe("")
  })

  it("describes baseline and reset in words", () => {
    const state = base()
    expect(
      announce({ type: "set-baseline", mode: "prior-period" }, state, titleOf)
    ).toBe("Comparing against prior period.")
    expect(announce({ type: "reset", defaults: [] }, state, titleOf)).toContain(
      "Dashboard reset"
    )
  })
})

describe("isSelected", () => {
  it("reports membership", () => {
    expect(isSelected(base(), "card.b")).toBe(true)
    expect(isSelected(base(), "card.z")).toBe(false)
  })
})

describe("parsePrefs", () => {
  it("accepts current preferences unchanged", () => {
    const prefs = base()
    expect(parsePrefs(prefs, "super-admin")).toEqual(prefs)
  })

  it("migrates v1, adopting the current role it never had", () => {
    const v1 = { version: 1, widgets: ["card.a", "card.b"] }
    expect(parsePrefs(v1, "principal")).toEqual({
      seenDefaults: ["card.a", "card.b"],
      version: 3,
      role: "principal",
      widgets: [{ id: "card.a" }, { id: "card.b" }],
    })
  })

  it("returns null for anything unrecoverable, and never throws", () => {
    // A corrupt entry must not make the dashboard un-loadable — the user has no way
    // to clear it if it does.
    for (const bad of [
      null,
      undefined,
      42,
      "nonsense",
      {},
      { version: 3, widgets: [] },
      { version: 3, role: "", widgets: [] },
      { version: 3, role: "r", widgets: [{ id: "" }] },
      { version: 3, role: "r", widgets: [{ id: "a", sizeOverride: "huge" }] },
    ]) {
      expect(parsePrefs(bad, "r")).toBeNull()
    }
  })

  it("rejects an unknown baseline mode rather than storing it", () => {
    expect(
      parsePrefs(
        {
          version: 3,
          role: "r",
          widgets: [],
          matrix: { baselineMode: "vibes" },
        },
        "r"
      )
    ).toBeNull()
  })
})

describe("pruneUnknownWidgets", () => {
  const exists = (id: string) => id !== "card.retired"

  it("drops ids the registry no longer has", () => {
    // A saved id pointing at nothing would throw on the next render, and the user
    // cannot reach the dashboard to fix it.
    const prefs: DashboardPrefs = {
      version: 3,
      role: "r",
      widgets: [{ id: "card.a" }, { id: "card.retired" }, { id: "card.b" }],
      seenDefaults: ["card.a", "card.retired", "card.b"],
    }
    expect(pruneUnknownWidgets(prefs, exists).widgets.map((w) => w.id)).toEqual(
      ["card.a", "card.b"]
    )
  })

  it("returns the same object when nothing was dropped", () => {
    const prefs = base()
    expect(pruneUnknownWidgets(prefs, exists)).toBe(prefs)
  })
})

describe("repositories", () => {
  beforeEach(() => globalThis.localStorage?.clear())

  it("keys storage by user AND role, so dashboards do not bleed between roles", () => {
    expect(storageKey("u1", "principal")).not.toBe(
      storageKey("u1", "super-admin")
    )
  })

  it.each([
    ["localStorage", () => new LocalStoragePrefsRepository()],
    ["memory", () => new MemoryPrefsRepository()],
  ])("%s round-trips, isolates roles, and clears", async (_name, make) => {
    const repo = make()
    const prefs = base()

    expect(await repo.load("u1", "super-admin")).toBeNull()
    await repo.save(prefs, "u1")
    expect(await repo.load("u1", "super-admin")).toEqual(prefs)

    // A different role must not see it.
    expect(await repo.load("u1", "principal")).toBeNull()

    await repo.clear("u1", "super-admin")
    expect(await repo.load("u1", "super-admin")).toBeNull()
  })

  it("treats a corrupt entry as no preferences at all", async () => {
    globalThis.localStorage.setItem(storageKey("u1", "r"), "{not json")
    expect(await new LocalStoragePrefsRepository().load("u1", "r")).toBeNull()
  })

  it("migrates a v1 entry found in storage", async () => {
    globalThis.localStorage.setItem(
      storageKey("u1", "principal"),
      JSON.stringify({ version: 1, widgets: ["card.a"] })
    )
    const loaded = await new LocalStoragePrefsRepository().load(
      "u1",
      "principal"
    )
    expect(loaded).toEqual({
      version: 3,
      role: "principal",
      widgets: [{ id: "card.a" }],
      seenDefaults: ["card.a"],
    })
  })

  it("survives storage being unavailable", async () => {
    // Private windows and blocked site data both throw on access. Losing a layout
    // preference is acceptable; refusing to render a dashboard is not.
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked")
      },
    })
    const repo = new LocalStoragePrefsRepository()
    await expect(repo.load("u1", "r")).resolves.toBeNull()
    await expect(repo.save(base(), "u1")).resolves.toBeUndefined()
    await expect(repo.clear("u1", "r")).resolves.toBeUndefined()
    if (original) Object.defineProperty(globalThis, "localStorage", original)
  })
})

describe("adoptNewDefaults — shipping a new default widget", () => {
  const base = (
    widgets: string[],
    seenDefaults: string[]
  ): DashboardPrefs => ({
    version: 3,
    role: "super-admin",
    widgets: widgets.map((id) => ({ id })),
    seenDefaults,
  })

  it("delivers a widget added to the defaults after the user last saved", () => {
    /*
      The bug this exists for. The quadrant chart was added to `DEFAULT_WIDGET_IDS`, and it
      appeared only for roles with no saved preferences — for everyone else the saved list
      already looked complete, so the widget was simply absent. It read as a chart that
      failed to render.
    */
    const prefs = base(["card.a", "card.b"], ["card.a", "card.b"])
    const next = adoptNewDefaults(prefs, ["card.a", "card.b", "chart.new"])
    expect(next.widgets.map((w) => w.id)).toEqual([
      "card.a",
      "card.b",
      "chart.new",
    ])
  })

  it("appends, so a new arrival never displaces the user's top metric", () => {
    const prefs = base(["card.b", "card.a"], ["card.a", "card.b"])
    const next = adoptNewDefaults(prefs, ["chart.new", "card.a", "card.b"])
    expect(next.widgets.map((w) => w.id)).toEqual([
      "card.b",
      "card.a",
      "chart.new",
    ])
  })

  it("does not resurrect a default the user deliberately removed", () => {
    // The whole reason `seenDefaults` exists rather than comparing against the defaults
    // directly: that comparison cannot tell "never offered" from "offered and deleted",
    // and would put the widget back every time the user removed it.
    const prefs = base(["card.a"], ["card.a", "card.b"])
    const next = adoptNewDefaults(prefs, ["card.a", "card.b"])
    expect(next.widgets.map((w) => w.id)).toEqual(["card.a"])
  })

  it("records what it adopted, so it only ever arrives once", () => {
    const prefs = base(["card.a"], ["card.a"])
    const once = adoptNewDefaults(prefs, ["card.a", "chart.new"])
    expect(once.seenDefaults).toContain("chart.new")

    // The user removes it again; a second load must leave it removed.
    const removed = { ...once, widgets: [{ id: "card.a" }] }
    const twice = adoptNewDefaults(removed, ["card.a", "chart.new"])
    expect(twice.widgets.map((w) => w.id)).toEqual(["card.a"])
  })

  it("returns the same object when there is nothing new", () => {
    const prefs = base(["card.a"], ["card.a", "card.b"])
    expect(adoptNewDefaults(prefs, ["card.a", "card.b"])).toBe(prefs)
  })

  it("seeds a migrated v2 dashboard from what it already holds", () => {
    /*
      v2 had no record of what had been offered, so it is seeded from the current widgets.
      The stated consequence: a v2 user who removed a default gets it back once. Re-offering
      a widget once is a much smaller harm than never delivering a new one, and from v3 the
      distinction is kept properly.
    */
    const migrated = parsePrefs(
      { version: 2, role: "super-admin", widgets: [{ id: "card.a" }] },
      "super-admin"
    )!
    expect(migrated.seenDefaults).toEqual(["card.a"])
    expect(
      adoptNewDefaults(migrated, ["card.a", "chart.new"]).widgets.map(
        (w) => w.id
      )
    ).toEqual(["card.a", "chart.new"])
  })
})
