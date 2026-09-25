/**
 * A matchMedia tests can set.
 *
 * jsdom ships no matchMedia at all, and the two queries this product actually branches
 * on — `prefers-reduced-motion` and `prefers-color-scheme` — both change what renders.
 * Reduced motion in particular must be assertable: it disables chart animation, which
 * is what makes visual tests deterministic (PLAN §13).
 */

let matches: Record<string, boolean> = {};
const listeners = new Set<{ query: string; fn: (e: MediaQueryListEvent) => void }>();

/** Set which media queries currently match. Substring match, so `setMedia({ "reduced-motion": true })` works. */
export function setMedia(next: Record<string, boolean>): void {
  matches = { ...matches, ...next };
  for (const listener of listeners) {
    if (matchesQuery(listener.query)) {
      listener.fn({ matches: true, media: listener.query } as MediaQueryListEvent);
    }
  }
}

export function resetMedia(): void {
  matches = {};
  listeners.clear();
}

function matchesQuery(query: string): boolean {
  return Object.entries(matches).some(([key, value]) => value && query.includes(key));
}

export function installMatchMediaMock(): void {
  window.matchMedia = ((query: string) => {
    const list = {
      matches: matchesQuery(query),
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
        listeners.add({ query, fn });
      },
      removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
        for (const listener of listeners) {
          if (listener.fn === fn) listeners.delete(listener);
        }
      },
      // Deprecated pair, still called by some libraries.
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
    return list as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}
