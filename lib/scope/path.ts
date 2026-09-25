import type { ScopeRef } from "./types";

/**
 * Scope ⇄ URL.
 *
 * Scope lives in the URL path (PLAN D14), so this pair is on the critical path for every
 * deep link, every shared view and the back button. `parse(serialise(s)) === s` is
 * property-tested over the whole fixture tree.
 *
 * Only ids go in the URL. Labels come from the server at render time, because a label
 * in a URL goes stale the moment a school is renamed and cannot be trusted anyway.
 */

/** Ids are lowercase kebab. Anything else is a hand-edited URL, not one we produced. */
const SEGMENT = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Guard against a pathological URL producing unbounded work before validation. */
export const MAX_SCOPE_DEPTH = 8;

export function serialiseScope(scope: ScopeRef): string[] {
  return scope.map((step) => step.id);
}

/**
 * Validate raw URL segments into scope ids.
 *
 * Returns `null` — never throws, never a partial result — so a malformed URL becomes a
 * 404 rather than a crash or, worse, a dashboard silently scoped somewhere else
 * (PLAN §6.4). This only checks *shape*; whether the ids exist and nest correctly is
 * `resolveScope`'s job, and whether the caller may see them is the server's.
 */
export function parseScopeSegments(segments: readonly string[] | undefined): string[] | null {
  if (segments === undefined) return [];
  if (!Array.isArray(segments)) return null;
  if (segments.length > MAX_SCOPE_DEPTH) return null;

  const seen = new Set<string>();
  for (const segment of segments) {
    if (typeof segment !== "string" || !SEGMENT.test(segment)) return null;
    // A repeated id means a cycle, which the tree cannot produce.
    if (seen.has(segment)) return null;
    seen.add(segment);
  }
  return [...segments];
}

/** The href for a scope, with query preserved by the caller. */
export function scopeHref(scope: ScopeRef, basePath = "/dashboard"): string {
  const ids = serialiseScope(scope);
  return ids.length ? `${basePath}/${ids.join("/")}` : basePath;
}
