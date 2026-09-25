"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { useContainerSize } from "@/hooks/use-container-size";
import { resolveVariant, type Variant } from "@/lib/viz/variants";

/**
 * Container size as context.
 *
 * The reason this is context rather than each chart measuring itself: tests can provide
 * a width directly. jsdom has no layout, so anything relying on a real measurement
 * renders 0×0 and asserts nothing — the usual reason chart test suites get abandoned
 * (PLAN §14). With this, a test says `width={320}` and asserts the micro variant.
 */

export interface ContainerContextValue {
  width: number;
  height: number;
  measured: boolean;
}

const ContainerSizeContext = createContext<ContainerContextValue | null>(null);

export function useContainerWidth(): ContainerContextValue {
  const value = useContext(ContainerSizeContext);
  if (!value) {
    throw new Error("useContainerWidth must be used inside a <ContainerSizeProvider>");
  }
  return value;
}

/** Resolve the variant for the current container, restricted to what a widget supports. */
export function useVariant(supported: readonly Variant[]): Variant {
  const { width } = useContainerWidth();
  return useMemo(() => resolveVariant(width, supported), [width, supported]);
}

/**
 * Measures its own box and publishes it.
 *
 * Pass `width` to override measurement entirely — that is the test seam, and it is also
 * how the kitchen-sink route renders one widget at every variant side by side without
 * needing four differently-sized frames.
 */
export function ContainerSizeProvider({
  children,
  width,
  height,
  className,
  debounceMs,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  className?: string;
  debounceMs?: number;
}) {
  const [ref, measured] = useContainerSize<HTMLDivElement>(debounceMs);

  const value = useMemo<ContainerContextValue>(
    () =>
      width === undefined
        ? measured
        : { width, height: height ?? measured.height, measured: true },
    [width, height, measured],
  );

  return (
    <div ref={width === undefined ? ref : undefined} className={className}>
      <ContainerSizeContext.Provider value={value}>{children}</ContainerSizeContext.Provider>
    </div>
  );
}
