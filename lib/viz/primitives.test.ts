import { describe, expect, it } from "vitest";

import type { DataEnvelope } from "@/lib/data/envelope";
import { envelopeToTable, summariseSeries, tableToCsv } from "@/lib/a11y/table";
import {
  computeDelta,
  formatDelta,
  formatValue,
  isDeltaMeaningful,
  NOT_MEASURED,
  thinTicks,
} from "@/lib/viz/format";
import { isAtMost, quantiseWidth, resolveVariant, VARIANT_MIN_WIDTH } from "@/lib/viz/variants";

describe("resolveVariant", () => {
  const all = ["micro", "compact", "standard", "expanded"] as const;

  it("picks the richest variant that fits", () => {
    expect(resolveVariant(320, all)).toBe("micro");
    expect(resolveVariant(336, all)).toBe("compact");
    expect(resolveVariant(559, all)).toBe("compact");
    expect(resolveVariant(560, all)).toBe("standard");
    expect(resolveVariant(1600, all)).toBe("expanded");
  });

  it("switches exactly at each documented threshold", () => {
    for (const [variant, min] of Object.entries(VARIANT_MIN_WIDTH)) {
      if (min === 0) continue;
      expect(resolveVariant(min, all)).toBe(variant);
      expect(resolveVariant(min - 1, all)).not.toBe(variant);
    }
  });

  it("only ever returns a variant the widget implements", () => {
    expect(resolveVariant(1600, ["micro", "standard"])).toBe("standard");
    expect(resolveVariant(400, ["micro", "expanded"])).toBe("micro");
  });

  it("falls back to the narrowest supported rather than crashing a dashboard", () => {
    // A widget that only implements `expanded`, rendered into a phone.
    expect(resolveVariant(320, ["expanded"])).toBe("expanded");
  });

  it("treats an unmeasured width as narrow, never as wide", () => {
    // Guessing wide renders an expanded chart into a phone for one frame.
    expect(resolveVariant(0, all)).toBe("micro");
    expect(resolveVariant(Number.NaN, all)).toBe("micro");
    expect(resolveVariant(-100, all)).toBe("micro");
  });

  it("refuses a widget that declares no variants", () => {
    expect(() => resolveVariant(500, [])).toThrow(RangeError);
    expect(() => resolveVariant(500, ["nonsense" as never])).toThrow(RangeError);
  });
});

describe("quantiseWidth", () => {
  it("buckets widths so a window drag does not re-render every chart", () => {
    expect(quantiseWidth(801)).toBe(800);
    expect(quantiseWidth(807)).toBe(800);
    expect(quantiseWidth(808)).toBe(808);
  });

  it("never changes which variant is chosen at a threshold", () => {
    for (const min of Object.values(VARIANT_MIN_WIDTH)) {
      expect(quantiseWidth(min)).toBe(min);
    }
  });

  it("clamps nonsense to zero", () => {
    expect(quantiseWidth(-5)).toBe(0);
    expect(quantiseWidth(Number.NaN)).toBe(0);
  });
});

describe("isAtMost", () => {
  it("orders variants by richness", () => {
    expect(isAtMost("compact", "standard")).toBe(true);
    expect(isAtMost("standard", "standard")).toBe(true);
    expect(isAtMost("expanded", "standard")).toBe(false);
  });
});

describe("formatValue", () => {
  it("shows a marker, not a zero, for anything unmeasured", () => {
    expect(formatValue(null, { format: "number" })).toBe(NOT_MEASURED);
    expect(formatValue(undefined, { format: "number" })).toBe(NOT_MEASURED);
    expect(formatValue(Number.NaN, { format: "number" })).toBe(NOT_MEASURED);
  });

  it("renders rates from fractions", () => {
    expect(formatValue(0.874, { format: "percent", precision: 1 })).toBe("87.4%");
    expect(formatValue(0.874, { format: "percent", precision: 0 })).toBe("87%");
  });

  it("renders money with its currency", () => {
    expect(formatValue(12_500, { format: "currency", currency: "USD" })).toBe("$12,500");
    expect(formatValue(12_500, { format: "currency", currency: "USD", compact: true })).toBe("$12.5K");
  });

  it("refuses money with no currency rather than guessing one", () => {
    expect(() => formatValue(100, { format: "currency" })).toThrow(TypeError);
  });

  it("abbreviates large counts when space is short", () => {
    expect(formatValue(1_240_000, { format: "number", compact: true })).toBe("1.2M");
    expect(formatValue(847_000, { format: "number", compact: true })).toBe("847K");
    expect(formatValue(1_240_000, { format: "number" })).toBe("1,240,000");
  });

  it("renders ratios the way people say them", () => {
    expect(formatValue(14.23, { format: "ratio", precision: 1 })).toBe("14.2:1");
  });
});

describe("computeDelta — the percentage-point trap", () => {
  it("expresses a rate change in percentage points, not percent", () => {
    // 80% → 85% is +5pp. Calling it "+5%" is wrong, and it is the error a numerate
    // client spots in the first five minutes.
    expect(computeDelta(0.85, 0.8, "percentage-points")).toBeCloseTo(5, 10);
  });

  it("expresses the same change relatively when that is what the KPI declares", () => {
    expect(computeDelta(0.85, 0.8, "percent")).toBeCloseTo(6.25, 10);
  });

  it("subtracts directly for absolute KPIs", () => {
    expect(computeDelta(180, 140, "absolute")).toBe(40);
  });

  it("returns null when either side was never measured", () => {
    expect(computeDelta(null, 0.8, "percentage-points")).toBeNull();
    expect(computeDelta(0.8, null, "percentage-points")).toBeNull();
    expect(computeDelta(0.8, Number.NaN, "absolute")).toBeNull();
  });

  it("refuses a relative change against a zero baseline", () => {
    expect(computeDelta(10, 0, "percent")).toBeNull();
    // ...but an absolute change from zero is a fact.
    expect(computeDelta(10, 0, "absolute")).toBe(10);
  });

  it("keeps the sign of a decline", () => {
    expect(computeDelta(0.78, 0.8, "percentage-points")).toBeCloseTo(-2, 10);
  });

  it("rejects an unknown delta format", () => {
    expect(() => computeDelta(1, 2, "sideways" as never)).toThrow(TypeError);
  });
});

describe("formatDelta", () => {
  it("always carries an explicit sign", () => {
    expect(formatDelta(2.1, { deltaFormat: "percentage-points" })).toBe("+2.1pp");
    expect(formatDelta(-2.1, { deltaFormat: "percentage-points" })).toBe("−2.1pp");
    expect(formatDelta(0, { deltaFormat: "percentage-points" })).toBe("±0.0pp");
  });

  it("labels relative change as percent", () => {
    expect(formatDelta(6.25, { deltaFormat: "percent", precision: 2 })).toBe("+6.25%");
  });

  it("formats absolute deltas in the KPI's own units", () => {
    expect(formatDelta(40, { deltaFormat: "absolute", precision: 0 })).toBe("+40");
    expect(formatDelta(-1500, { deltaFormat: "absolute", valueFormat: "currency", currency: "USD" })).toBe(
      "−$1,500",
    );
  });

  it("shows the marker for an uncomputable delta", () => {
    expect(formatDelta(null, { deltaFormat: "absolute" })).toBe(NOT_MEASURED);
  });
});

describe("isDeltaMeaningful", () => {
  it("greys out deltas from tiny denominators", () => {
    // A 3-student cohort going 2/3 → 3/3 is "+33pp" and means nothing.
    expect(isDeltaMeaningful(3)).toBe(false);
    expect(isDeltaMeaningful(10)).toBe(true);
    expect(isDeltaMeaningful(null)).toBe(false);
  });
});

describe("thinTicks", () => {
  const point = (x: number, y: number | null) => ({ x, y });

  it("leaves short series alone", () => {
    const series = [point(1, 5), point(2, 7)];
    expect(thinTicks(series, (p) => p.y)).toEqual(series);
  });

  it("keeps first, last and the peak", () => {
    const series = [point(1, 5), point(2, 9), point(3, 40), point(4, 8), point(5, 12)];
    expect(thinTicks(series, (p) => p.y).map((p) => p.x)).toEqual([1, 3, 5]);
  });

  it("does not duplicate an endpoint that is also the peak", () => {
    const series = [point(1, 99), point(2, 9), point(3, 4), point(4, 8)];
    expect(thinTicks(series, (p) => p.y).map((p) => p.x)).toEqual([1, 4]);
  });

  it("ignores unmeasured points when finding the peak", () => {
    const series = [point(1, 5), point(2, null), point(3, 20), point(4, 8)];
    expect(thinTicks(series, (p) => p.y).map((p) => p.x)).toEqual([1, 3, 4]);
  });
});

describe("envelopeToTable", () => {
  const envelope: DataEnvelope = {
    meta: {
      format: "percent",
      deltaFormat: "percentage-points",
      precision: 1,
      xType: "time",
      period: { kind: "academic-year", id: "ay-2025" },
      asOf: "2026-03-31",
    },
    series: [
      {
        id: "uae",
        label: "UAE",
        direction: "higher-is-better",
        points: [
          { x: "ay-2024", y: 0.88 },
          { x: "ay-2025", y: 0.91 },
        ],
      },
      {
        id: "uk",
        label: "UK",
        direction: "higher-is-better",
        // Deliberately sparse: no ay-2024 reading.
        points: [{ x: "ay-2025", y: 0.84 }],
      },
    ],
  };

  it("builds one column per series and one row per x value", () => {
    const table = envelopeToTable(envelope, "Attendance by country");
    expect(table.columns).toEqual(["Period", "UAE", "UK"]);
    expect(table.rows).toHaveLength(2);
  });

  it("puts null in the gaps rather than shifting the column", () => {
    const table = envelopeToTable(envelope, "Attendance");
    expect(table.rows[0]).toEqual(["ay-2024", 0.88, null]);
    expect(table.rows[1]).toEqual(["ay-2025", 0.91, 0.84]);
  });

  it("preserves first-seen axis order across sparse series", () => {
    const table = envelopeToTable(envelope, "Attendance");
    expect(table.rows.map((row) => row[0])).toEqual(["ay-2024", "ay-2025"]);
  });
});

describe("tableToCsv", () => {
  it("writes blanks for missing cells, not the display marker", () => {
    const csv = tableToCsv({ caption: "x", columns: ["Period", "UAE"], rows: [["ay-2024", null]] });
    expect(csv).toBe("Period,UAE\r\nay-2024,");
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    const csv = tableToCsv({
      caption: "x",
      columns: ["School"],
      rows: [['Smith, "The" School'], ["line\nbreak"]],
    });
    expect(csv).toContain('"Smith, ""The"" School"');
    expect(csv).toContain('"line\nbreak"');
  });
});

describe("summariseSeries", () => {
  const format = { format: "percent" as const, precision: 1 };

  it("states the takeaway, not the geometry", () => {
    const summary = summariseSeries(
      "Attendance",
      [
        { x: "ay-2023", y: 0.9 },
        { x: "ay-2024", y: 0.95 },
        { x: "ay-2025", y: 0.93 },
      ],
      format,
    );
    expect(summary).toContain("rose from 90.0% at ay-2023 to 93.0% at ay-2025");
    expect(summary).toContain("peaking at 95.0% at ay-2024");
  });

  it("names a decline as a decline", () => {
    const summary = summariseSeries(
      "Re-enrolment",
      [
        { x: "ay-2024", y: 0.92 },
        { x: "ay-2025", y: 0.88 },
      ],
      format,
    );
    expect(summary).toContain("fell from");
  });

  it("caveats missing periods instead of glossing over them", () => {
    const summary = summariseSeries(
      "Progress",
      [
        { x: "ay-2023", y: 0.8 },
        { x: "ay-2024", y: null },
        { x: "ay-2025", y: 0.85 },
      ],
      format,
    );
    expect(summary).toContain("1 period not measured.");
  });

  it("handles no data and a single reading without pretending to a trend", () => {
    expect(summariseSeries("Placement", [{ x: "ay-2025", y: null }], format)).toBe(
      "Placement: no data recorded.",
    );
    expect(summariseSeries("Placement", [{ x: "ay-2025", y: 0.7 }], format)).toBe(
      "Placement: 70.0% at ay-2025.",
    );
  });
});
