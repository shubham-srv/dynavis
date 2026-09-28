import type { Pillar } from "@/lib/kpi/types"

import { isAtOrAbove } from "./levels"
import type { ScopeLookup } from "./resolve"

/**
 * A role is a root scope plus a depth cap — not a permission list.
 *
 * That is the simplification the whole product rests on: there is one dashboard, and the
 * role decides where in the tree you start and how far down you may go. Four dashboards
 * collapse into one code path (PLAN §1.4).
 *
 * Everything here is *advisory*. The client uses it to hide affordances it would be rude
 * to show. The server re-checks every request, because a scope in a URL is a request and
 * not a grant.
 */

export type PeerVisibility = "none" | "anonymised-band" | "named-group"

export interface Role {
  id: string
  label: string
  /** Where this role's tree starts. More than one ⇒ a synthetic "My regions" root. */
  rootIds: readonly string[]
  /** The deepest level this role may reach. */
  maxLevel: string
  pillars: readonly Pillar[] | "all"
  peerVisibility: PeerVisibility
}

export const ROLES: readonly Role[] = [
  {
    id: "super-admin",
    label: "Super admin",
    rootIds: ["group"],
    maxLevel: "school",
    pillars: "all",
    peerVisibility: "named-group",
  },
  {
    id: "regional-manager",
    label: "Regional manager",
    rootIds: ["emea"],
    maxLevel: "school",
    pillars: "all",
    peerVisibility: "named-group",
  },
  {
    id: "principal",
    label: "Principal",
    rootIds: ["sch-dxb-01"],
    maxLevel: "school",
    pillars: "all",
    // The recommended default: rank without naming (PLAN §1.5).
    peerVisibility: "anonymised-band",
  },
]

const BY_ID = new Map(ROLES.map((role) => [role.id, role]))

export function roleById(id: string): Role {
  const role = BY_ID.get(id)
  if (!role) throw new RangeError(`unknown role: "${id}"`)
  return role
}

export const DEFAULT_ROLE_ID = "super-admin"

/**
 * Is this role allowed to see this path?
 *
 * Two independent conditions, and both must hold:
 *   1. the path passes through one of the role's roots (subtree containment), and
 *   2. no level on it is deeper than the role's cap.
 *
 * A hand-edited URL that fails either is a 403, and there is an e2e test that does
 * exactly that (PLAN §6.4).
 */
export function isAuthorisedScope(
  role: Role,
  ids: readonly string[],
  lookup: ScopeLookup
): boolean {
  const fullPath = [lookup.rootId, ...ids]

  const rootIndex = fullPath.findIndex((id) => role.rootIds.includes(id))
  if (rootIndex === -1) return false

  // Everything at or below the role's root must respect the depth cap. Levels above it
  // are on the path by construction and are never rendered.
  for (const id of fullPath.slice(rootIndex)) {
    const level = lookup.levelOf(id)
    if (level === null) return false
    if (!isAtOrAbove(level, role.maxLevel)) return false
  }
  return true
}

/**
 * Where this role lands with no scope in the URL.
 *
 * A role with several roots gets the tree root instead, so the breadcrumb always has a
 * single home; the UI labels that "My regions" (PLAN §1.4).
 */
export function homeScopeIds(role: Role, lookup: ScopeLookup): string[] {
  if (role.rootIds.length !== 1) return []
  const [root] = role.rootIds
  if (root === lookup.rootId) return []

  // Walk down from the tree root to the role's root so the URL is a real path.
  const path = findPath(lookup.rootId, root, lookup)
  return path ?? []
}

function findPath(
  from: string,
  to: string,
  lookup: ScopeLookup
): string[] | null {
  if (from === to) return []
  for (const child of lookup.childrenOf(from) ?? []) {
    const rest = findPath(child.id, to, lookup)
    if (rest) return [child.id, ...rest]
  }
  return null
}

/** Can this role drill one more level, from a node at `level`? */
export function canDrillFrom(role: Role, level: string | null): boolean {
  return level !== null && isAtOrAbove(level, role.maxLevel)
}

export function rolePillars(role: Role): readonly Pillar[] {
  return role.pillars === "all"
    ? ["revenue", "efficiency", "academic"]
    : role.pillars
}

/**
 * Where a role should actually land, given a requested path.
 *
 * Two distinct situations were being conflated, and that was the bug (`homeScopeIds` was
 * written for this and never called):
 *
 *   - **`/dashboard` with no scope** means "my dashboard". For a role whose root is not
 *     the tree root that is *not* a request for the group view, so resolving it against
 *     the tree root denied a principal access to their own landing page — and the denial
 *     page then linked back to `/dashboard`, which denied them again. A dead end.
 *   - **a hand-edited deep link** outside the subtree is a real 403 and stays one
 *     (PLAN §6.4). This never rescues it.
 *
 * So: the requested path if it is allowed, else the deepest allowed prefix of it, else
 * the role's own home. The prefix step is what makes the role switcher keep your place
 * where that is legal — a regional manager at `/emea/uae/dubai` switching to super admin
 * stays there rather than being thrown to the root.
 */
export function roleLandingIds(
  role: Role,
  ids: readonly string[],
  lookup: ScopeLookup
): string[] {
  for (let end = ids.length; end > 0; end--) {
    const candidate = ids.slice(0, end)
    if (isAuthorisedScope(role, candidate, lookup)) return candidate
  }
  return homeScopeIds(role, lookup)
}

/** `/dashboard/a/b?role=x` — the one place this URL is built. */
export function dashboardHref(
  ids: readonly string[],
  roleId?: string
): string {
  const path = ids.length ? `/${ids.join("/")}` : ""
  return `/dashboard${path}${roleId ? `?role=${roleId}` : ""}`
}
