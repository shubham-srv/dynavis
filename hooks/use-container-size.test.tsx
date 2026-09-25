import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useContainerSize } from "@/hooks/use-container-size";
import { resizeTo } from "../tests/mocks/resize-observer";

/**
 * The hook that makes the responsive strategy work, and the perf risk that comes with
 * it: a window drag emits hundreds of callbacks, and without bucketing every one of
 * them re-renders every chart (PLAN §15).
 */

// Commits are the thing worth counting — a commit is what costs layout and paint —
// and an effect with no dependency array is the legitimate way to observe them.
const onCommit = vi.fn();

function Probe({ debounceMs }: { debounceMs?: number }) {
  const [ref, size] = useContainerSize<HTMLDivElement>(debounceMs);
  useEffect(() => onCommit());

  return (
    <div ref={ref} data-testid="box">
      <span data-testid="width">{size.width}</span>
      <span data-testid="measured">{String(size.measured)}</span>
    </div>
  );
}

const width = () => Number(screen.getByTestId("width").textContent);
const commits = () => onCommit.mock.calls.length;

beforeEach(() => {
  onCommit.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

describe("useContainerSize", () => {
  it("reports nothing measured until the first callback", () => {
    render(<Probe />);
    // Never guess wide: an unmeasured container resolves to the narrowest variant.
    expect(width()).toBe(0);
    expect(screen.getByTestId("measured")).toHaveTextContent("false");
  });

  it("publishes a quantised width once the debounce elapses", () => {
    render(<Probe />);
    act(() => {
      resizeTo(screen.getByTestId("box"), { width: 803, height: 200 });
    });
    expect(width()).toBe(0); // still debouncing

    act(() => void vi.advanceTimersByTime(100));
    expect(width()).toBe(800);
    expect(screen.getByTestId("measured")).toHaveTextContent("true");
  });

  it("coalesces a burst of resizes into a single update", () => {
    render(<Probe />);
    const box = screen.getByTestId("box");
    const before = commits();

    act(() => {
      // What a window drag actually looks like.
      for (let w = 700; w < 900; w += 1) resizeTo(box, { width: w, height: 200 });
      vi.advanceTimersByTime(100);
    });

    expect(width()).toBe(896);
    expect(commits() - before).toBe(1);
  });

  it("does not commit for movement inside one 8px bucket", () => {
    render(<Probe />);
    const box = screen.getByTestId("box");

    act(() => {
      resizeTo(box, { width: 800, height: 200 });
      vi.advanceTimersByTime(100);
    });
    const settled = commits();

    act(() => {
      resizeTo(box, { width: 805, height: 200 });
      vi.advanceTimersByTime(100);
    });
    expect(width()).toBe(800);
    expect(commits()).toBe(settled);
  });

  it("commits when the bucket genuinely changes", () => {
    render(<Probe />);
    const box = screen.getByTestId("box");

    act(() => {
      resizeTo(box, { width: 800, height: 200 });
      vi.advanceTimersByTime(100);
    });
    const settled = commits();

    act(() => {
      resizeTo(box, { width: 812, height: 200 });
      vi.advanceTimersByTime(100);
    });
    expect(width()).toBe(808);
    expect(commits()).toBeGreaterThan(settled);
  });

  it("applies immediately when debouncing is switched off", () => {
    render(<Probe debounceMs={0} />);
    act(() => {
      resizeTo(screen.getByTestId("box"), { width: 640, height: 200 });
    });
    expect(width()).toBe(640);
  });

  it("stops observing on unmount, so a late callback cannot update a dead tree", () => {
    const { unmount } = render(<Probe />);
    const box = screen.getByTestId("box");

    act(() => {
      resizeTo(box, { width: 900, height: 200 });
    });
    unmount();
    // No act() warning and no error means the observer and timer were torn down.
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
  });

  it("is SSR-safe when ResizeObserver does not exist", () => {
    const original = globalThis.ResizeObserver;
    // @ts-expect-error — deliberately removing it to simulate the server.
    delete globalThis.ResizeObserver;
    expect(() => render(<Probe />)).not.toThrow();
    globalThis.ResizeObserver = original;
  });
});
