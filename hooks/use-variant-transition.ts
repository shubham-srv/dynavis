"use client"

import { useEffect, useRef } from "react"

import type { Variant } from "@/lib/viz/variants"

import { useReducedMotion } from "./use-reduced-motion"

/**
 * Animates a widget's body when its *variant* changes, and at no other time.
 *
 * A widget crossing 336/560/896 swaps one form for a different one, and without a
 * transition that substitution reads as a glitch rather than as the product's central
 * behaviour.
 *
 * **Why this is a ref and an effect rather than a class name.** The previous version
 * returned `"variant-enter"` unconditionally and relied on a global `data-motion-ready`
 * attribute to suppress the first paint. That worked for exactly one page load. The
 * attribute is set on `<html>` and stays set, so from the second navigation onwards every
 * widget mounted with the class already live — and drilling into a scope re-mounted all of
 * them at once. Six cards sliding up together on every drill is the "clunky reshuffle" the
 * animation was supposed to prevent.
 *
 * The mistake was scope: "has the page painted once" is not "has this widget changed form".
 * Only the widget knows the second, so the widget tracks it — in a ref, read and written
 * inside an effect, which is both correct and what the React Compiler lint allows.
 *
 * A fresh mount therefore never animates: navigating, drilling, and the first measurement
 * settling all leave `previous` null or unchanged. Only a real threshold crossing on a
 * widget that is already on screen plays the animation.
 */
export function useVariantTransition<T extends HTMLElement>(
  variant: Variant
): (node: T | null) => void {
  const node = useRef<T | null>(null)
  const previous = useRef<Variant | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const element = node.current
    const before = previous.current
    previous.current = variant

    // `null` means this is the widget's first render: a mount is not a change.
    if (before === null || before === variant || reduced || !element) return

    // Removed, reflowed, re-added so the animation restarts. The caller keys the element
    // on the variant so it is usually a fresh node anyway, but a caller that does not
    // would otherwise see the animation play only once.
    element.classList.remove("variant-enter")
    void element.offsetWidth
    element.classList.add("variant-enter")
  }, [variant, reduced])

  return (element: T | null) => {
    node.current = element
  }
}
