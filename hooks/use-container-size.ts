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

export function useContainerSize<T extends HTMLElement = HTMLDivElement>(
  debounceMs = 100
): [(node: T | null) => void, ContainerSize] {
  const [size, setSize] = useState<ContainerSize>(UNMEASURED)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const observer = useRef<ResizeObserver | null>(null)

  const apply = useCallback((width: number, height: number) => {
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

        if (debounceMs <= 0) {
          apply(width, height)
          return
        }
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => apply(width, height), debounceMs)
      })

      observer.current.observe(node)
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
