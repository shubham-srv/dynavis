import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * The reduced-motion guarantee, read off the stylesheet.
 *
 * jsdom does not evaluate media queries, so no rendering test can prove that
 * `prefers-reduced-motion` actually disables anything. Asserting against the CSS source is
 * the honest alternative: it cannot prove the browser honours the rule, but it does catch
 * the thing that would realistically break — someone adding an animation with a hardcoded
 * duration, which escapes the switch entirely.
 *
 * PLAN §7 has promised this since the responsive spec was written. For most of the
 * project's life it held only because there were no animations at all.
 */

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8")

describe("motion tokens", () => {
  it("defines the three durations every animation reads", () => {
    for (const token of ["--motion-fast", "--motion-base", "--motion-slow"]) {
      expect(css).toContain(`${token}:`)
    }
  })

  it("zeroes all three under prefers-reduced-motion", () => {
    const block = css.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/
    )
    expect(block).not.toBeNull()
    for (const token of ["--motion-fast", "--motion-base", "--motion-slow"]) {
      expect(block![0]).toMatch(new RegExp(`${token}:\\s*0s`))
    }
  })

  it("also zeroes durations it did not author, as a backstop", () => {
    // Covers third-party CSS and any future component that forgets the token. Belt and
    // braces on an accessibility guarantee is proportionate.
    const block = css.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/
    )!
    expect(block[0]).toMatch(/animation-duration:\s*0s\s*!important/)
    expect(block[0]).toMatch(/transition-duration:\s*0s\s*!important/)
  })

  it("routes every animation through a token rather than a literal duration", () => {
    /*
      The rule that keeps the switch above meaningful. A rule like `animation: fade 200ms`
      would keep animating for a reader who asked for stillness, and would do it silently.
    */
    const animations = css.match(/^\s*animation:[^;]+;/gm) ?? []
    expect(animations.length).toBeGreaterThan(0)
    for (const rule of animations) {
      expect(rule).toMatch(/var\(--motion-(fast|base|slow)\)/)
    }

    const transitions = css.match(/^\s*transition:[^;]+;/gm) ?? []
    for (const rule of transitions) {
      expect(rule).toMatch(/var\(--motion-(fast|base|slow)\)/)
    }
  })

  it("never animates the opacity of anything that carries text", () => {
    /*
      The rule that turned twenty-one intermittent axe failures into zero. A widget's first
      measurement is itself a variant change, so this animation can still be running when
      something inspects the page — and text at a fractional opacity fails a contrast check.
      A transform cannot: it is composited and never changes a computed colour.

      Opacity is still allowed for the scatter marks, which carry no text.
    */
    const variantIn = css.match(
      /@keyframes\s+dynavis-variant-in\s*\{[\s\S]*?\n\}/
    )
    expect(variantIn).not.toBeNull()
    expect(variantIn![0]).not.toMatch(/opacity/)
  })

  it("gates the mount-triggered animations behind the first-paint marker", () => {
    /*
      `.flip-move` and `.mark-in` fire when an element appears or moves, so without the gate
      a cold page load animates.

      `.variant-enter` is deliberately absent from this list: it is applied by
      `useVariantTransition` only on a real threshold crossing. Gating it as well was the
      bug — the attribute is set once and never cleared, so from the second navigation
      onwards it suppressed nothing, and every drill slid every widget up at once.
    */
    for (const klass of [".flip-move", ".mark-in"]) {
      const rule = new RegExp(
        `:root\\[data-motion-ready\\][^{]*\\${klass}\\s*\\{`
      )
      expect(css).toMatch(rule)
    }
  })
})
