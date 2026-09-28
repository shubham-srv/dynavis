"use client"

import type { Variant } from "@/lib/viz/variants"

/**
 * The class name and key for a widget whose form changes with its width.
 *
 * This is the animation that earns its place: a widget crossing 336/560/896 swaps one form
 * for a different one, and without a transition that substitution reads as a glitch rather
 * than as the product's central behaviour. It is the thing the demo is for.
 *
 * **No state, no effect, no refs.** Two earlier versions tried to remember whether this
 * widget had changed variant yet — one with `useState` inside an effect, one with a ref
 * mutated during render — and the React Compiler lint rejected both. It was right twice:
 * "has anything changed since first paint" is a fact about the page, not about a widget, so
 * twelve widgets were each storing a copy of it. It now lives in one attribute on `<html>`
 * (see `<MotionReady>`), and CSS reads it.
 *
 * What is left is the part that genuinely belongs to the widget: the `key`. Returning a
 * class alone would not animate anything, because React reconciles the old form's DOM into
 * the new one — same element, no mount, no animation, and the transition would play over a
 * half-updated mixture of both forms. Keying on the variant forces a real swap, which is
 * also what makes the animation replay when a window drag crosses a threshold back the
 * other way.
 */
export function useVariantTransition(variant: Variant): {
  className: string
  key: string
} {
  return { className: "variant-enter", key: variant }
}
