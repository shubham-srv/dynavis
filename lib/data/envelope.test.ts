import { describe, expect, it } from "vitest";

import { BASELINE_FALLBACK } from "@/lib/data/envelope";

describe("BASELINE_FALLBACK", () => {
  /**
   * The order is the spec, not an implementation detail (PLAN §8.4, D21): target
   * answers "who is failing", prior-period "who is moving", peer-median "who is behind
   * their peers". Reordering silently changes what every untinted cell in the matrix
   * means, so it should have to be a deliberate edit here.
   */
  it("falls through from the strongest claim to the weakest", () => {
    expect(BASELINE_FALLBACK).toEqual(["target", "prior-period", "peer-median", "none"]);
  });

  it("ends in 'none', so resolution always terminates", () => {
    expect(BASELINE_FALLBACK.at(-1)).toBe("none");
  });
});
