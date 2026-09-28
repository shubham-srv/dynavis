"use client"

import { useEffect } from "react"

import { MEASUREMENT_DEBOUNCE_MS } from "@/hooks/use-container-size"

/**
 * Marks the document as ready to animate, once the first layout has settled.
 *
 * The problem this solves: an animation that should play when content *changes* must not
 * play when content first *appears*. Every component could track its own first render, and
 * the first two attempts at that did — one with `useState` in an effect, one with a ref
 * mutated during render. Both were rejected by the React Compiler lint, and both were the
 * same mistake: asking twelve components to each remember something that is true of the
 * page as a whole.
 *
 * So the gate is global and lives in CSS. Animations are declared inside
 * `:root[data-motion-ready] { … }`, components emit their animation class unconditionally,
 * and until this effect runs those classes do nothing.
 *
 * **Why it waits rather than firing on the next frame.** Every widget starts unmeasured,
 * resolves to `micro`, and then jumps to its real variant when its container reports a
 * width — so the first measurement is itself a variant change, and a gate that opened on
 * the next frame animated all twelve widgets on every cold page load. That is the exact
 * mount animation the gate exists to prevent, arriving in disguise. It also made the axe
 * suite flaky: a fading element has a fractional opacity, and contrast measured through it
 * fails.
 *
 * The delay is the measurement debounce plus a frame, imported rather than guessed so the
 * two cannot drift.
 */
const SETTLE_MS = MEASUREMENT_DEBOUNCE_MS + 32

export function MotionReady() {
  useEffect(() => {
    const timer = setTimeout(() => {
      document.documentElement.setAttribute("data-motion-ready", "")
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [])

  return null
}
