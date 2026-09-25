import { describe, expect, it } from "vitest";

import { deltaContainsFx, type FxTable, toReporting } from "@/lib/money/fx";

const FX: FxTable = {
  base: "USD",
  constantBasisPeriod: "ay-2024",
  rates: {
    AED: { "ay-2024": 3.6725, "ay-2025": 3.6725 },
    GBP: { "ay-2024": 0.79, "ay-2025": 0.74 },
    EGP: { "ay-2024": 30.9, "ay-2025": 48.5 },
    ZAR: { "ay-2024": 18.6, "ay-2025": 17.9 },
  },
};

describe("toReporting", () => {
  it("passes the reporting currency through untouched", () => {
    expect(toReporting(1000, "USD", "ay-2025", FX)).toEqual({
      value: 1000,
      currency: "USD",
      rate: 1,
      basis: "constant",
      rateAsOf: "ay-2025",
    });
  });

  it("converts at the basis period's rate when constant", () => {
    const result = toReporting(36_725, "AED", "ay-2025", FX, "constant");
    expect(result.value).toBeCloseTo(10_000, 6);
    expect(result.rateAsOf).toBe("ay-2024");
    expect(result.currency).toBe("USD");
  });

  it("converts at the period's own rate when nominal", () => {
    const result = toReporting(1000, "GBP", "ay-2025", FX, "nominal");
    expect(result.rate).toBe(0.74);
    expect(result.rateAsOf).toBe("ay-2025");
  });

  it("keeps a currency collapse out of the growth story", () => {
    // EGP roughly halved against USD between the two years. Flat local revenue must
    // read as flat under constant currency, and only move under nominal.
    const localRevenue = 30_900_000;
    const priorConstant = toReporting(localRevenue, "EGP", "ay-2024", FX, "constant").value!;
    const currentConstant = toReporting(localRevenue, "EGP", "ay-2025", FX, "constant").value!;
    expect(currentConstant).toBeCloseTo(priorConstant, 6);

    const currentNominal = toReporting(localRevenue, "EGP", "ay-2025", FX, "nominal").value!;
    expect(currentNominal).toBeLessThan(priorConstant * 0.7);
  });

  it("returns null for an unmeasured amount, but still reports the rate it would use", () => {
    const result = toReporting(null, "AED", "ay-2025", FX);
    expect(result.value).toBeNull();
    expect(result.rate).toBe(3.6725);
  });

  it("defaults to constant currency", () => {
    expect(toReporting(100, "GBP", "ay-2025", FX).basis).toBe("constant");
    expect(toReporting(100, "GBP", "ay-2025", FX).rateAsOf).toBe("ay-2024");
  });

  it("throws rather than guess when a rate is unknown", () => {
    expect(() => toReporting(100, "JPY", "ay-2025", FX)).toThrow(/no FX rates for "JPY"/);
    expect(() => toReporting(100, "GBP", "ay-2099", FX, "nominal")).toThrow(/no GBP rate for period/);
  });

  it("rejects a corrupt rate instead of producing Infinity", () => {
    const broken: FxTable = { ...FX, rates: { ...FX.rates, BAD: { "ay-2025": 0 } } };
    expect(() => toReporting(100, "BAD", "ay-2025", broken, "nominal")).toThrow(RangeError);
  });
});

describe("deltaContainsFx", () => {
  it("is false under constant currency — that is the entire point of it", () => {
    expect(deltaContainsFx("GBP", "ay-2025", "ay-2024", FX, "constant")).toBe(false);
  });

  it("is false for the reporting currency", () => {
    expect(deltaContainsFx("USD", "ay-2025", "ay-2024", FX, "nominal")).toBe(false);
  });

  it("flags a nominal delta across a rate move, so the UI can caveat it", () => {
    expect(deltaContainsFx("GBP", "ay-2025", "ay-2024", FX, "nominal")).toBe(true);
    // A peg does not move, so a nominal AED delta is clean.
    expect(deltaContainsFx("AED", "ay-2025", "ay-2024", FX, "nominal")).toBe(false);
  });
});
