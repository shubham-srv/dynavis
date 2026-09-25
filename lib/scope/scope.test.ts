import { describe, expect, it } from "vitest";

import { fixtureLookup } from "@/lib/data/fixtures/lookup";
import { allNodes, pathTo } from "@/lib/data/fixtures/org";
import {
  buildBreadcrumbs,
  collapseTrail,
  scopeAnnouncement,
} from "@/lib/scope/breadcrumbs";
import { isAtOrAbove, levelByKey, levelRank, LEVELS } from "@/lib/scope/levels";
import { MAX_SCOPE_DEPTH, parseScopeSegments, scopeHref, serialiseScope } from "@/lib/scope/path";
import { describeScope, drillInto, drillUpTo, resolveScope } from "@/lib/scope/resolve";
import {
  canDrillFrom,
  DEFAULT_ROLE_ID,
  homeScopeIds,
  isAuthorisedScope,
  roleById,
  rolePillars,
} from "@/lib/scope/roles";

const lookup = fixtureLookup;

/** Ids from the tree root down to (and including) `id`, excluding the root itself. */
function idsFor(id: string): string[] {
  return [...pathTo(id).slice(1).map((node) => node.id), id];
}

describe("levels", () => {
  it("orders the hierarchy without using it as a depth proxy", () => {
    expect(levelRank("group")).toBeLessThan(levelRank("school"));
    expect(isAtOrAbove("country", "school")).toBe(true);
    expect(isAtOrAbove("school", "country")).toBe(false);
  });

  it("rejects unknown levels loudly", () => {
    expect(() => levelByKey("planet")).toThrow(RangeError);
  });

  it("is internally consistent", () => {
    expect(LEVELS.map((level) => level.depth)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("parseScopeSegments", () => {
  it("treats a missing catch-all param as the root", () => {
    expect(parseScopeSegments(undefined)).toEqual([]);
  });

  it("accepts well-formed ids", () => {
    expect(parseScopeSegments(["emea", "uae", "sch-dxb-01"])).toEqual(["emea", "uae", "sch-dxb-01"]);
  });

  it("returns null — never throws — for a hand-edited URL", () => {
    expect(parseScopeSegments(["EMEA"])).toBeNull();
    expect(parseScopeSegments(["../etc/passwd"])).toBeNull();
    expect(parseScopeSegments(["a b"])).toBeNull();
    expect(parseScopeSegments([""])).toBeNull();
    expect(parseScopeSegments(["x".repeat(64)])).toBeNull();
    expect(parseScopeSegments("emea" as unknown as string[])).toBeNull();
  });

  it("rejects repeats, which the tree cannot produce", () => {
    expect(parseScopeSegments(["emea", "uae", "emea"])).toBeNull();
  });

  it("bounds depth so a pathological URL cannot cause unbounded work", () => {
    expect(parseScopeSegments(Array.from({ length: MAX_SCOPE_DEPTH + 1 }, (_, i) => `n${i}`))).toBeNull();
  });

  it("does not alias its input", () => {
    const input = ["emea"];
    const parsed = parseScopeSegments(input)!;
    parsed.push("uae");
    expect(input).toEqual(["emea"]);
  });
});

describe("serialise / parse round-trip", () => {
  it("holds for every node in the tree", () => {
    // The property every deep link in the product depends on (PLAN §5.1).
    for (const node of allNodes()) {
      const ids = idsFor(node.id).filter((id) => id !== lookup.rootId);
      const scope = resolveScope(ids, lookup);
      expect(scope, node.id).not.toBeNull();
      expect(parseScopeSegments(serialiseScope(scope!).slice(1))).toEqual(ids);
    }
  });
});

describe("resolveScope", () => {
  it("resolves the root for an empty path", () => {
    const scope = resolveScope([], lookup)!;
    expect(scope).toHaveLength(1);
    expect(scope[0]).toMatchObject({ id: "group", level: "group" });
  });

  it("resolves a full path with labels from the tree, not the URL", () => {
    const scope = resolveScope(["emea", "uae", "dubai", "sch-dxb-01"], lookup)!;
    expect(scope.map((step) => step.level)).toEqual(["group", "region", "country", "cluster", "school"]);
    expect(scope.at(-1)!.label).toBe("Al Barsha International School");
  });

  it("handles the non-uniform branch, where a country has no cluster tier", () => {
    const scope = resolveScope(["emea", "eg", "sch-eg-01"], lookup)!;
    expect(scope.map((step) => step.level)).toEqual(["group", "region", "country", "school"]);
  });

  it("rejects a path whose steps are not parent-and-child", () => {
    // Both ids exist, but the school is not under EMEA — this must not render a Sydney
    // school beneath EMEA's breadcrumb trail.
    expect(resolveScope(["emea", "sch-au-01"], lookup)).toBeNull();
    expect(resolveScope(["uae", "dubai"], lookup)).toBeNull();
    expect(resolveScope(["nope"], lookup)).toBeNull();
  });

  it("returns null when the root itself is unknown", () => {
    expect(resolveScope([], { ...lookup, rootId: "missing" })).toBeNull();
  });
});

describe("describeScope", () => {
  it("reports the children the matrix will render", () => {
    const node = describeScope(resolveScope(["emea"], lookup)!, lookup);
    expect(node.childLevel).toBe("country");
    expect(node.children.map((child) => child.id)).toEqual(["uae", "uk", "eg"]);
    expect(node.canDrill).toBe(true);
  });

  it("reports a leaf as undrillable, so no matrix is offered below it", () => {
    const node = describeScope(resolveScope(["emea", "eg", "sch-eg-01"], lookup)!, lookup);
    expect(node.childLevel).toBeNull();
    expect(node.canDrill).toBe(false);
  });

  it("withholds children when the caller may not drill", () => {
    const node = describeScope(resolveScope(["emea"], lookup)!, lookup, false);
    expect(node.children).toEqual([]);
    expect(node.canDrill).toBe(false);
  });

  it("refuses an empty scope rather than inventing a root", () => {
    expect(() => describeScope([], lookup)).toThrow(RangeError);
  });
});

describe("drillInto / drillUpTo", () => {
  const emea = resolveScope(["emea"], lookup)!;

  it("appends a genuine child", () => {
    const next = drillInto(emea, "uae", lookup)!;
    expect(serialiseScope(next)).toEqual(["group", "emea", "uae"]);
  });

  it("refuses a node that is not a child of the current scope", () => {
    expect(drillInto(emea, "sch-au-01", lookup)).toBeNull();
    expect(drillInto(emea, "nope", lookup)).toBeNull();
    expect(drillInto([], "emea", lookup)).toBeNull();
  });

  it("walks back up to any ancestor, clamping at the root", () => {
    const deep = resolveScope(["emea", "uae", "dubai"], lookup)!;
    expect(serialiseScope(drillUpTo(deep, 1))).toEqual(["group", "emea"]);
    expect(serialiseScope(drillUpTo(deep, 0))).toEqual(["group"]);
    expect(serialiseScope(drillUpTo(deep, -5))).toEqual(["group"]);
    expect(serialiseScope(drillUpTo(deep, 99))).toEqual(["group", "emea", "uae", "dubai"]);
  });
});

describe("scopeHref", () => {
  it("drops the root segment so the group view is the bare base path", () => {
    expect(scopeHref([])).toBe("/dashboard");
    expect(scopeHref(resolveScope(["emea"], lookup)!.slice(1))).toBe("/dashboard/emea");
  });
});

describe("buildBreadcrumbs", () => {
  const scope = resolveScope(["emea", "uae", "dubai"], lookup)!;
  const crumbs = buildBreadcrumbs(scope, lookup);

  it("mirrors the scope exactly — there is no second source of truth", () => {
    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      "Nova Schools Group",
      "EMEA",
      "United Arab Emirates",
      "Dubai",
    ]);
  });

  it("marks only the last crumb as current", () => {
    expect(crumbs.filter((crumb) => crumb.isCurrent)).toHaveLength(1);
    expect(crumbs.at(-1)!.isCurrent).toBe(true);
  });

  it("offers siblings so a user can move laterally without going back up", () => {
    const uae = crumbs.find((crumb) => crumb.id === "uae")!;
    expect(uae.siblings.map((sibling) => sibling.id)).toEqual(["uae", "uk", "eg"]);
    expect(uae.siblings.find((sibling) => sibling.id === "uae")!.isCurrent).toBe(true);
    // Jumping sideways replaces that crumb and drops everything below it.
    expect(uae.siblings.find((sibling) => sibling.id === "uk")!.href).toBe("/dashboard/emea/uk");
  });

  it("gives the root no siblings and a home href", () => {
    expect(crumbs[0].siblings).toEqual([]);
    expect(crumbs[0].href).toBe("/dashboard");
  });
});

describe("collapseTrail", () => {
  const crumbs = buildBreadcrumbs(resolveScope(["emea", "uae", "dubai", "sch-dxb-01"], lookup)!, lookup);

  it("leaves a short trail alone", () => {
    expect(collapseTrail(crumbs.slice(0, 2)).head).toBeNull();
    expect(collapseTrail(crumbs.slice(0, 2)).tail).toHaveLength(2);
  });

  it("keeps the root and the tail, eliding the middle rather than dropping it", () => {
    const { head, elided, tail } = collapseTrail(crumbs, 3);
    expect(head!.id).toBe("group");
    expect(tail).toHaveLength(2);
    expect(tail.at(-1)!.id).toBe("sch-dxb-01");
    expect(elided.map((crumb) => crumb.id)).toEqual(["emea", "uae"]);
    expect([head!, ...elided, ...tail]).toHaveLength(crumbs.length);
  });
});

describe("scopeAnnouncement", () => {
  it("says where you now are and how much is on screen", () => {
    const scope = resolveScope(["emea", "uae"], lookup)!;
    expect(scopeAnnouncement(scope, 8)).toBe("Now viewing United Arab Emirates. 8 widgets.");
    expect(scopeAnnouncement(scope, 1)).toContain("1 widget.");
  });

  it("is empty for an empty scope rather than announcing nonsense", () => {
    expect(scopeAnnouncement([], 3)).toBe("");
  });
});

describe("roles", () => {
  const superAdmin = roleById("super-admin");
  const regional = roleById("regional-manager");
  const principal = roleById("principal");

  it("exposes a default role and rejects unknown ones", () => {
    expect(roleById(DEFAULT_ROLE_ID)).toBeDefined();
    expect(() => roleById("janitor")).toThrow(RangeError);
  });

  it("lets a super admin anywhere", () => {
    expect(isAuthorisedScope(superAdmin, ["emea", "uae", "dubai", "sch-dxb-01"], lookup)).toBe(true);
    expect(isAuthorisedScope(superAdmin, [], lookup)).toBe(true);
  });

  it("confines a regional manager to their own subtree", () => {
    expect(isAuthorisedScope(regional, ["emea", "uae"], lookup)).toBe(true);
    // APAC is a real path, and still a 403 for this role.
    expect(isAuthorisedScope(regional, ["apac", "au"], lookup)).toBe(false);
  });

  it("confines a principal to their own school", () => {
    expect(isAuthorisedScope(principal, ["emea", "uae", "dubai", "sch-dxb-01"], lookup)).toBe(true);
    expect(isAuthorisedScope(principal, ["emea", "uae", "dubai", "sch-dxb-02"], lookup)).toBe(false);
    expect(isAuthorisedScope(principal, ["emea", "uae"], lookup)).toBe(false);
  });

  it("refuses a path containing an unknown node", () => {
    expect(isAuthorisedScope(superAdmin, ["emea", "ghost"], lookup)).toBe(false);
  });

  it("sends each role home to its own root", () => {
    expect(homeScopeIds(superAdmin, lookup)).toEqual([]);
    expect(homeScopeIds(regional, lookup)).toEqual(["emea"]);
    expect(homeScopeIds(principal, lookup)).toEqual(["emea", "uae", "dubai", "sch-dxb-01"]);
  });

  it("falls back to the tree root for a multi-root role", () => {
    const multi = { ...regional, rootIds: ["emea", "apac"] };
    expect(homeScopeIds(multi, lookup)).toEqual([]);
  });

  it("returns no path when a role's root is not in the tree", () => {
    expect(homeScopeIds({ ...regional, rootIds: ["atlantis"] }, lookup)).toEqual([]);
  });

  it("stops offering drill affordances at the role's cap", () => {
    const countryCapped = { ...regional, maxLevel: "country" };
    expect(canDrillFrom(countryCapped, "country")).toBe(true);
    expect(canDrillFrom(countryCapped, "cluster")).toBe(false);
    expect(canDrillFrom(countryCapped, null)).toBe(false);
  });

  it("expands 'all' pillars", () => {
    expect(rolePillars(superAdmin)).toEqual(["revenue", "efficiency", "academic"]);
    expect(rolePillars({ ...superAdmin, pillars: ["academic"] })).toEqual(["academic"]);
  });
});
