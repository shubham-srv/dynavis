import { describe, expect, it } from "vitest";
import {
  assertSeriesBudget,
  directionGlyph,
  MATRIX_DEADBAND,
  MATRIX_LEVEL_2,
  matrixTint,
  matrixTintVar,
  SERIES_BUDGET,
  SERIES_SLOT_COUNT,
  seriesVar,
} from "@/lib/viz/palette";

describe("seriesVar", () => {
  it("maps 0-based indices onto 1-based tokens in fixed order", () => {
    expect(seriesVar(0)).toBe("var(--chart-1)");
    expect(seriesVar(7)).toBe("var(--chart-8)");
  });

  it("never cycles — two series must never share a colour", () => {
    const all = Array.from({ length: SERIES_SLOT_COUNT }, (_, i) => seriesVar(i));
    expect(new Set(all).size).toBe(SERIES_SLOT_COUNT);
    expect(() => seriesVar(SERIES_SLOT_COUNT)).toThrow(/do not cycle/i);
  });

  it("rejects indices that are not non-negative integers", () => {
    expect(() => seriesVar(-1)).toThrow(RangeError);
    expect(() => seriesVar(1.5)).toThrow(RangeError);
  });
});

describe("assertSeriesBudget", () => {
  it("allows all eight slots when a legend orders the series", () => {
    expect(() => assertSeriesBudget(SERIES_BUDGET.adjacent, "adjacent")).not.toThrow();
    expect(() => assertSeriesBudget(SERIES_BUDGET.adjacent + 1, "adjacent")).toThrow(/Other/);
  });

  it("caps all-pairs comparison at three, and says what to do instead", () => {
    expect(SERIES_BUDGET.all).toBe(3);
    expect(() => assertSeriesBudget(3, "all")).not.toThrow();
    expect(() => assertSeriesBudget(4, "all")).toThrow(/small multiples/i);
  });
});

describe("matrixTint", () => {
  it("returns null for values that were never measured", () => {
    expect(matrixTint(null)).toBeNull();
    expect(matrixTint(Number.NaN)).toBeNull();
  });

  it("leaves near-baseline cells untinted", () => {
    expect(matrixTint(0)).toBeNull();
    expect(matrixTint(MATRIX_DEADBAND - 0.001)).toBeNull();
    expect(matrixTint(-(MATRIX_DEADBAND - 0.001))).toBeNull();
  });

  it("tints at the deadband edge, escalating at the level-2 threshold", () => {
    expect(matrixTint(MATRIX_DEADBAND)).toBe("pos-1");
    expect(matrixTint(MATRIX_LEVEL_2 - 0.001)).toBe("pos-1");
    expect(matrixTint(MATRIX_LEVEL_2)).toBe("pos-2");
  });

  it("is symmetric about the baseline", () => {
    for (const v of [0.2, 0.49, 0.5, 0.9, 1]) {
      expect(matrixTint(-v)).toBe(matrixTint(v)!.replace("pos", "neg"));
    }
  });

  it("clamps outliers rather than throwing — one bad row must not kill the matrix", () => {
    expect(matrixTint(42)).toBe("pos-2");
    expect(matrixTint(-42)).toBe("neg-2");
    expect(matrixTint(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("matrixTintVar", () => {
  it("resolves tints to tokens and null to no tint", () => {
    expect(matrixTintVar("pos-2")).toBe("var(--matrix-pos-2)");
    expect(matrixTintVar("neg-1")).toBe("var(--matrix-neg-1)");
    expect(matrixTintVar(null)).toBeNull();
  });
});

describe("directionGlyph", () => {
  it("carries direction where colour cannot", () => {
    expect(directionGlyph(0.6)).toBe("▲");
    expect(directionGlyph(-0.6)).toBe("▼");
    expect(directionGlyph(0)).toBe("●");
    expect(directionGlyph(null)).toBe("—");
  });

  it("marks every untinted-but-measured cell, so the deadband is never silent", () => {
    expect(directionGlyph(MATRIX_DEADBAND / 2)).toBe("●");
    expect(matrixTint(MATRIX_DEADBAND / 2)).toBeNull();
  });
});
