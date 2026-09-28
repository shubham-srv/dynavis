"use client"

import { useEffect, useRef, useState } from "react"

import { useReducedMotion } from "@/hooks/use-reduced-motion"

/**
 * A number that tweens to its new value when the scope changes.
 *
 * Cheap, and disproportionately effective: drilling from a region to a school currently
 * repaints six numbers instantly, which reads as a page reload. Counting them gives the
 * drill continuity and makes it obvious *which* figures moved.
 *
 * Three things this must not get wrong:
 *
 * 1. **The final frame is the exact input.** A tween that lands on an interpolated value
 *    would show a figure nobody computed. The last step assigns `value` itself, and a
 *    formatter is applied to the tweened number rather than the number being pre-rendered
 *    to text, so precision and currency rules still come from one place.
 * 2. **It never animates from nothing.** First paint renders the value outright — an
 *    initial count-up from zero is a loading animation, and claims the data arrived later
 *    than it did.
 * 3. **`null` does not tween.** "Not measured" is not a quantity, and sliding into it
 *    from a real number implies a value that was never recorded (PLAN §12.3).
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number | null
  format: (value: number | null) => string
  className?: string
}) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    // Nothing to interpolate between: either end being absent means we swap, not tween.
    if (reduced || value === null || from.current === null) {
      from.current = value
      setShown(value)
      return
    }

    const start = from.current
    if (start === value) return
    from.current = value

    const DURATION = 320
    /*
      The clock is taken from the first frame's own timestamp, not from
      `performance.now()`.

      Those are not guaranteed to share a time origin, and where they do not the elapsed
      fraction comes out negative — cubed by the easing, that rendered -2896 for a tween
      between 100 and 200. Reading the start from the same clock that reports progress
      makes the two agree by construction.
    */
    let began: number | null = null

    const step = (now: number) => {
      if (began === null) began = now
      // Clamped at both ends. Capping only the top left a negative elapsed fraction free
      // to run through the easing curve and produce a value far outside the range.
      const t = Math.max(0, Math.min(1, (now - began) / DURATION))
      // easeOutCubic: fast enough to feel responsive, settling rather than stopping.
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(t === 1 ? value : start + (value - start) * eased)
      if (t < 1) frame.current = requestAnimationFrame(step)
    }

    frame.current = requestAnimationFrame(step)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      // Whatever interrupted us, the committed value is the truth.
      setShown(value)
    }
  }, [value, reduced])

  return (
    // tabular-nums is load-bearing, not decorative: proportional digits change width as
    // they count, and the widget's whole header reflows on every frame.
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(shown)}
    </span>
  )
}
