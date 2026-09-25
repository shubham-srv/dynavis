import type { FxTable } from "@/lib/money/fx";

/**
 * Invented rates, but shaped like the real problem: a hard peg (AED), a currency that
 * drifted (GBP), and one that collapsed (EGP). The EGP series is what makes constant
 * currency visibly matter in the demo — under nominal rates Egypt looks like it lost
 * half its revenue while local trading was flat (PLAN §12.2).
 */
export const FX: FxTable = {
  base: "USD",
  constantBasisPeriod: "ay-2025",
  rates: {
    AED: { "ay-2022": 3.6725, "ay-2023": 3.6725, "ay-2024": 3.6725, "ay-2025": 3.6725 },
    GBP: { "ay-2022": 0.82, "ay-2023": 0.8, "ay-2024": 0.79, "ay-2025": 0.74 },
    EGP: { "ay-2022": 19.2, "ay-2023": 24.6, "ay-2024": 30.9, "ay-2025": 48.5 },
    AUD: { "ay-2022": 1.44, "ay-2023": 1.5, "ay-2024": 1.52, "ay-2025": 1.49 },
    SGD: { "ay-2022": 1.36, "ay-2023": 1.34, "ay-2024": 1.33, "ay-2025": 1.29 },
    BRL: { "ay-2022": 5.2, "ay-2023": 4.95, "ay-2024": 5.45, "ay-2025": 5.82 },
    MXN: { "ay-2022": 20.1, "ay-2023": 17.8, "ay-2024": 18.4, "ay-2025": 19.9 },
    USD: { "ay-2022": 1, "ay-2023": 1, "ay-2024": 1, "ay-2025": 1 },
  },
};

export const ACADEMIC_YEARS = ["ay-2022", "ay-2023", "ay-2024", "ay-2025"] as const;
