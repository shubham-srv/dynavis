import type { ScopeChild, ScopeNode, ScopeRef } from "./types";

/**
 * Turning ids into a scope.
 *
 * `lib/scope` stays free of fixtures and of the API client: it takes a lookup and knows
 * nothing about where the tree came from. That is what lets the same code run against
 * fixtures today and the .NET `/scope` endpoint later (PLAN §16).
 */
export interface ScopeLookup {
  rootId: string;
  /** `null` when the node does not exist at all. */
  childrenOf(id: string): readonly ScopeChild[] | null;
  labelOf(id: string): string | null;
  levelOf(id: string): string | null;
  /** The level of a node's children, or `null` at a leaf. */
  childLevelOf(id: string): string | null;
}

/**
 * Resolve validated ids into a full scope, or `null` if the path does not exist.
 *
 * Every step must be a *child of the previous one*. Accepting ids that exist somewhere
 * in the tree but not on this path would let `/dashboard/emea/sch-au-01` resolve, which
 * would render a Sydney school under EMEA's breadcrumb trail.
 */
export function resolveScope(ids: readonly string[], lookup: ScopeLookup): ScopeRef | null {
  const rootLabel = lookup.labelOf(lookup.rootId);
  const rootLevel = lookup.levelOf(lookup.rootId);
  if (rootLabel === null || rootLevel === null) return null;

  const scope: { level: string; id: string; label: string }[] = [
    { level: rootLevel, id: lookup.rootId, label: rootLabel },
  ];

  let currentId = lookup.rootId;
  for (const id of ids) {
    const children = lookup.childrenOf(currentId);
    if (!children?.some((child) => child.id === id)) return null;

    const level = lookup.levelOf(id);
    const label = lookup.labelOf(id);
    if (level === null || label === null) return null;

    scope.push({ level, id, label });
    currentId = id;
  }
  return scope;
}

/** The node a scope points at, with its children — what the matrix renders (PLAN D15). */
export function describeScope(scope: ScopeRef, lookup: ScopeLookup, canDrill = true): ScopeNode {
  const current = scope.at(-1);
  if (!current) throw new RangeError("scope must contain at least the root");

  const children = lookup.childrenOf(current.id) ?? [];
  const childLevel = lookup.childLevelOf(current.id);

  return {
    ref: scope,
    childLevel: children.length ? childLevel : null,
    children: canDrill ? children : [],
    canDrill: canDrill && children.length > 0,
  };
}

/** Append a child to a scope. Returns `null` if it is not actually a child. */
export function drillInto(scope: ScopeRef, childId: string, lookup: ScopeLookup): ScopeRef | null {
  const current = scope.at(-1);
  if (!current) return null;

  const child = lookup.childrenOf(current.id)?.find((candidate) => candidate.id === childId);
  const level = lookup.levelOf(childId);
  if (!child || level === null) return null;

  return [...scope, { level, id: childId, label: child.label }];
}

/** Drop back to an ancestor. Index 0 is the root; out-of-range yields the root. */
export function drillUpTo(scope: ScopeRef, index: number): ScopeRef {
  return scope.slice(0, Math.max(1, Math.min(index + 1, scope.length)));
}
