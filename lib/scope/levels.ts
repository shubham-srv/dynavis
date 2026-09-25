import type { ScopeLevel } from "./types"

/**
 * The levels this deployment knows about.
 *
 * Ordered, but **not** a proxy for depth: the tree is deliberately non-uniform, so a
 * school in Egypt sits at depth 3 and a school in Dubai at depth 4. Anything that needs
 * "how far down is this" must ask the *level*, never count path segments (PLAN §1.3).
 */
export const LEVELS: readonly ScopeLevel[] = [
  { key: "group", label: "Group", pluralLabel: "Group", depth: 0 },
  { key: "region", label: "Region", pluralLabel: "Regions", depth: 1 },
  { key: "country", label: "Country", pluralLabel: "Countries", depth: 2 },
  { key: "cluster", label: "Cluster", pluralLabel: "Clusters", depth: 3 },
  { key: "school", label: "School", pluralLabel: "Schools", depth: 4 },
]

const BY_KEY = new Map(LEVELS.map((level) => [level.key, level]))

export function levelByKey(key: string): ScopeLevel {
  const level = BY_KEY.get(key)
  if (!level) throw new RangeError(`unknown scope level: "${key}"`)
  return level
}

export function levelRank(key: string): number {
  return levelByKey(key).depth
}

/** Is `key` at or above `limit` in the hierarchy? Used for role depth caps (PLAN §1.4). */
export function isAtOrAbove(key: string, limit: string): boolean {
  return levelRank(key) <= levelRank(limit)
}
