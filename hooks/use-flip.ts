"use client"

import { useEffect, useRef } from "react"

import { useReducedMotion } from "./use-reduced-motion"

/**
 * Animate children to their new positions after a reorder (First-Last-Invert-Play).
 *
 * Keyboard reordering already exists and currently teleports: a row jumps and the reader
 * has to work out what moved from the announcement alone. FLIP answers "what moved" with
 * the movement itself.
 *
 * Why FLIP rather than transitioning layout: the grid places items with CSS, and
 * animating `top`/`left`/`width` would force layout on every frame for every widget. FLIP
 * measures twice and then animates a `transform`, which the compositor handles — the only
 * version of this that survives twelve widgets on a phone (PLAN §15).
 *
 * `order` is the dependency rather than the DOM: an effect cannot tell that children
 * swapped, so the caller passes the identity list it reordered.
 */
export function useFlip<T extends HTMLElement>(
  order: readonly string[]
): (node: T | null) => void {
  const container = useRef<T | null>(null)
  const positions = useRef(new Map<string, DOMRect>())
  const reduced = useReducedMotion()

  const setRef = (node: T | null) => {
    container.current = node
  }

  useEffect(() => {
    const node = container.current
    if (!node) return

    const children = Array.from(
      node.querySelectorAll<HTMLElement>("[data-flip-key]")
    )

    // Measure where everything is now, before deciding whether to animate anything.
    const next = new Map<string, DOMRect>()
    for (const child of children) {
      const key = child.dataset.flipKey
      if (key) next.set(key, child.getBoundingClientRect())
    }

    const previous = positions.current
    positions.current = next
    // First pass after mount has nothing to compare against, and mount must not animate.
    if (reduced || previous.size === 0) return

    for (const child of children) {
      const key = child.dataset.flipKey
      if (!key) continue
      const was = previous.get(key)
      const is = next.get(key)
      if (!was || !is) continue

      const dx = was.left - is.left
      const dy = was.top - is.top
      // Sub-pixel movement is layout noise, not a reorder. Animating it produces a
      // visible shimmer on every unrelated re-render.
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue

      // Invert: put it back where it was, with no transition...
      child.classList.remove("flip-move")
      child.style.transform = `translate(${dx}px, ${dy}px)`

      // ...then, on the next frame, let it travel to where it now belongs.
      requestAnimationFrame(() => {
        child.classList.add("flip-move")
        child.style.transform = ""
      })
    }
  }, [order, reduced])

  return setRef
}
