"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { quantiseWidth } from "@/lib/viz/variants"

/**
 * Measure an element's own width.
 *
 * Two deliberate behaviours, both of which the rest of the product depends on:
 *
 * 1. **Quantised and debounced.** A window drag emits hundreds of ResizeObserver
 *    callbacks. Without bucketing to 8px and trailing-debouncing, every one re-renders
 *    every chart and INP dies — the biggest performance risk in this architecture
 *    (PLAN §15).
 *
 * 2. **Starts at zero, never guesses.** Before the first measurement the width is 0,
 *    which resolves to the narrowest variant. Guessing wide renders an expanded chart
 *    into a phone for a frame, which is visible and looks broken.
 */

export interface ContainerSize {
  width: number
  height: number
  /** False until the first real measurement — lets callers render a skeleton instead. */
  measured: boolean
}

const UNMEASURED: ContainerSize = { width: 0, height: 0, measured: false }

/**
 * Trailing debounce on a resize, in ms.
 *
 * Exported because motion depends on it: every widget starts unmeasured and resolves to
 * `micro`, so the first measurement is itself a variant change. Anything that animates
 * variant changes has to wait out this window, or it animates once on every cold load —
 * see `<MotionReady>`.
 */
export const MEASUREMENT_DEBOUNCE_MS = 100

export function useContainerSize<T extends HTMLElement = HTMLDivElement>(
  debounceMs = MEASUREMENT_DEBOUNCE_MS
): [(node: T | null) => void, ContainerSize] {
  const [size, setSize] = useState<ContainerSize>(UNMEASURED)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const hasMeasured = useRef(false)

  const apply = useCallback((width: number, height: number) => {
    hasMeasured.current = true
    const next = {
      width: quantiseWidth(width),
      height: Math.round(height),
      measured: true,
    }
    // Bail out when the bucket has not changed, so a 1px drag is not a React update.
    setSize((current) =>
      current.width === next.width &&
      current.height === next.height &&
      current.measured
        ? current
        : next
    )
  }, [])

  const ref = useCallback(
    (node: T | null) => {
      observer.current?.disconnect()
      if (timer.current) clearTimeout(timer.current)

      if (!node) {
        observer.current = null
        hasMeasured.current = false
        return
      }

      // SSR-safe: on the server there is no ResizeObserver and no layout to measure.
      if (typeof ResizeObserver === "undefined") return

      observer.current = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) return
        const box = entry.contentBoxSize?.[0]
        const width = box ? box.inlineSize : entry.contentRect.width
        const height = box ? box.blockSize : entry.contentRect.height

        // The FIRST measurement is applied immediately. Debouncing it too means the
        // component renders a placeholder and then swaps, which is a layout shift —
        // and CLS caught exactly that. The debounce exists for the resize *storm*
        // during a window drag, not for finding out how big we are (PLAN §15).
        if (debounceMs <= 0 || !hasMeasured.current) {
          apply(width, height)
          return
        }
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => apply(width, height), debounceMs)
      })

      observer.current.observe(node)

      // Measure synchronously, here in the ref callback, which runs during commit and
      // therefore before the browser paints. ResizeObserver's first callback lands
      // *after* a paint, so relying on it alone shows a placeholder for one frame and
      // then swaps — a layout shift that Lighthouse CLS flagged at 0.12 against a 0.05
      // budget (PLAN §15). In jsdom this reads 0 and is skipped, so tests still drive
      // sizing explicitly through the mock.
      const rect = node.getBoundingClientRect()
      if (rect.width > 0) apply(rect.width, rect.height)
    },
    [apply, debounceMs]
  )

  useEffect(
    () => () => {
      observer.current?.disconnect()
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return [ref, size]
}
