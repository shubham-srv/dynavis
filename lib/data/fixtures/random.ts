/**
 * Deterministic pseudo-randomness.
 *
 * Fixtures must be identical on every machine and every CI run, or visual regression
 * baselines are worthless and "it only fails in CI" becomes a way of life. mulberry32 is
 * small, fast and has no dependencies.
 */

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable 32-bit hash, so a seed can be derived from an id rather than a counter. */
export function hashSeed(...parts: (string | number)[]): number {
  let hash = 2166136261
  for (const part of parts.join("|")) {
    hash ^= part.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Deterministic value in [min, max) derived from the given key parts. */
export function seededFloat(
  min: number,
  max: number,
  ...key: (string | number)[]
): number {
  return min + mulberry32(hashSeed(...key))() * (max - min)
}

export function seededInt(
  min: number,
  max: number,
  ...key: (string | number)[]
): number {
  return Math.floor(seededFloat(min, max + 1, ...key))
}

/** Deterministic true/false with the given probability. */
export function seededChance(
  probability: number,
  ...key: (string | number)[]
): boolean {
  return mulberry32(hashSeed(...key))() < probability
}
