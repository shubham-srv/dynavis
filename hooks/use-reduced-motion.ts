"use client"

import { useSyncExternalStore } from "react"

/**
 * Does this reader want motion reduced?
 *
 * The CSS tokens in `globals.css` already zero every *authored* duration, so this hook is
 * not how the guarantee is kept — it is for the cases CSS cannot express: a JS-driven
 * tween has to be skipped outright rather than run at zero duration, and a
 * `requestAnimationFrame` loop has to not be started at all.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`, because a media query is
 * precisely an external store: the subscribe/snapshot pair is what it was added for, and
 * it removes the render-then-correct flash that the effect version had.
 *
 * **The server snapshot is `true`.** The honest default for an accessibility preference is
 * the safe one: a reader who asked for no motion must not get one frame of it before we
 * work out what they asked for. Motion-tolerant readers lose the animation on the very
 * first paint, which is the paint we did not want to animate anyway.
 */
const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const list = window.matchMedia(QUERY)

  // addListener is the deprecated form, and some shipping versions of Safari still only
  // have that one.
  if (list.addEventListener) {
    list.addEventListener("change", onChange)
    return () => list.removeEventListener("change", onChange)
  }
  list.addListener(onChange)
  return () => list.removeListener(onChange)
}

function getSnapshot(): boolean {
  // A missing matchMedia — old Safari, jsdom without a stub — is not a stated preference,
  // so it reads as "no preference" rather than as "reduce".
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  return true
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
