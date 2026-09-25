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

beforeEach(() => {
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
