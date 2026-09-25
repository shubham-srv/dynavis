import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach } from "vitest"

import { installMatchMediaMock, resetMedia } from "./mocks/match-media"
import {
  installResizeObserverMock,
  resetResizeObservers,
} from "./mocks/resize-observer"

/**
 * jsdom provides none of these, and all three gate what this product renders:
 * ResizeObserver drives variant selection, IntersectionObserver gates offscreen
 * widget mounting, matchMedia carries reduced-motion. See PLAN §14.
 */
class NoopIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ""
  readonly thresholds: readonly number[] = []
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

/**
 * jsdom (29) implements <dialog> but not showModal()/close().
 *
 * The picker uses the native element deliberately — it brings a real focus trap,
 * Escape-to-close and an inert background that a hand-rolled modal would have to
 * reimplement worse. This stub only toggles the `open` attribute so the dialog enters
 * the accessibility tree and can be queried; it does NOT emulate focus trapping or
 * inertness, and does not try to. Those are verified in a real browser by the
 * Playwright suite.
 */
function installDialogStub(): void {
  const proto = globalThis.HTMLDialogElement?.prototype
  if (!proto || typeof proto.showModal === "function") return

  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "")
  }
  proto.show = function show(this: HTMLDialogElement) {
    this.setAttribute("open", "")
  }
  proto.close = function close(this: HTMLDialogElement, returnValue?: string) {
    this.removeAttribute("open")
    if (returnValue !== undefined) this.returnValue = returnValue
    this.dispatchEvent(new Event("close"))
  }
}

beforeEach(() => {
  installDialogStub()
  installResizeObserverMock()
  installMatchMediaMock()
  globalThis.IntersectionObserver =
    NoopIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  cleanup()
  resetResizeObservers()
  resetMedia()
})
