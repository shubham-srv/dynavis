/**
 * A ResizeObserver that tests can drive.
 *
 * jsdom has no layout engine, so every element measures 0x0 and any chart wired to a
 * real ResizeObserver renders nothing and asserts nothing. This is the single most
 * common reason chart test suites get abandoned (PLAN §14).
 *
 * Usage:
 *   const { container } = render(<WidgetShell />);
 *   resizeTo(container.firstElementChild!, { width: 320, height: 200 });
 *   expect(screen.getByRole("table")).toBeInTheDocument();
 */

type Size = { width: number; height: number };

const observers = new Set<MockResizeObserver>();
const sizes = new WeakMap<Element, Size>();

class MockResizeObserver implements ResizeObserver {
  readonly targets = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.add(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
    // Real observers fire once on observe. Components that set state from the first
    // callback break if the mock stays silent, so mirror that behaviour.
    const size = sizes.get(target);
    if (size) this.emit(target, size);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    observers.delete(this);
  }

  emit(target: Element, size: Size): void {
    const box: ResizeObserverSize = { inlineSize: size.width, blockSize: size.height };
    const entry = {
      target,
      contentRect: { ...size, top: 0, left: 0, right: size.width, bottom: size.height, x: 0, y: 0 },
      borderBoxSize: [box],
      contentBoxSize: [box],
      devicePixelContentBoxSize: [box],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this);
  }
}

/**
 * Resize an element and notify anything observing it.
 *
 * Also stubs `getBoundingClientRect`, so a component that measures directly and one
 * that observes see the same number — disagreement between the two is a real bug we
 * do not want tests to hide.
 */
export function resizeTo(target: Element, size: Size): void {
  sizes.set(target, size);
  target.getBoundingClientRect = () =>
    ({
      ...size,
      top: 0,
      left: 0,
      right: size.width,
      bottom: size.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  for (const observer of observers) {
    if (observer.targets.has(target)) observer.emit(target, size);
  }
}

export function installResizeObserverMock(): void {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

export function resetResizeObservers(): void {
  observers.clear();
}
