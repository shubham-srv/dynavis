import { meanIgnoringNulls, sumIgnoringNulls } from "@/lib/data/aggregate";
import { kpiById } from "@/lib/kpi/catalog";
import { type FxBasis, toReporting } from "@/lib/money/fx";

import { ACADEMIC_YEARS, FX } from "./fx";
import { findNode, type OrgNode, schoolsUnder, unreportedFor } from "./org";
import { seededFloat } from "./random";

/**
 * Synthetic KPI values.
 *
 * Two rules the generator follows, because they are what the UI has to survive:
 *
 *   1. Missing is `null`, never 0. A school with no senior years has no placement rate;
 *      a school that opened this year has no prior year; two countries do not report
 *      some metrics at all (PLAN §12.3).
 *   2. Money is generated in LOCAL currency and converted on the way up, so aggregating
 *      across currencies goes through the FX path rather than silently adding AED to GBP.
 *
 * The numbers also tell a story rather than being noise, because a demo of random data
 * demos badly (PLAN Phase 9):
 *   - Egypt's margin and collection are visibly weak
 *   - Pennine Valley (nor-01) is a genuine turnaround on attainment
 *   - group re-enrolment is quietly sliding — the north star nobody is watching
 */

/** Per-KPI base range for a school, before drift and narrative. */
const RANGES: Record<string, readonly [number, number]> = {
  seatUtilisation: [0.72, 0.99],
  feeCollectionRate: [0.9, 0.995],
  discountLeakage: [0.03, 0.17],
  netNewEnrolments: [-60, 180],
  studentTeacherRatio: [9.5, 22],
  classFillRate: [0.68, 0.97],
  staffTurnover: [0.05, 0.28],
  teacherAbsenceRate: [0.02, 0.09],
  facilityUtilisation: [0.55, 0.94],
  attainmentRate: [0.62, 0.96],
  progressScore: [-0.6, 0.9],
  attendanceRate: [0.87, 0.98],
  reEnrolmentRate: [0.78, 0.96],
  universityPlacement: [0.55, 0.98],
  parentNps: [-5, 72],
  // Money, per student, local currency — scaled by a rough cost-of-living multiplier.
  grossRevenue: [9_000, 26_000],
  staffCost: [4_200, 12_000],
  facilityCost: [900, 3_400],
  otherCost: [600, 2_600],
  revenuePerStudent: [9_000, 26_000],
  costPerStudent: [6_000, 17_000],
};

/** Rough local-currency scaling so converted figures land in a believable USD band. */
const CURRENCY_SCALE: Record<string, number> = {
  AED: 3.67,
  GBP: 0.78,
  EGP: 34,
  AUD: 1.5,
  SGD: 1.32,
  BRL: 5.3,
  MXN: 19,
  USD: 1,
};

const ADDITIVE = new Set(["netNewEnrolments", "grossRevenue", "staffCost", "facilityCost", "otherCost"]);

function yearIndex(ay: string): number {
  const index = ACADEMIC_YEARS.indexOf(ay as (typeof ACADEMIC_YEARS)[number]);
  if (index === -1) throw new RangeError(`no fixture data for "${ay}"`);
  return index;
}

/** Story overlays, applied after the base value. Returns a multiplier. */
function narrative(school: OrgNode, kpiId: string, ay: string): number {
  const year = yearIndex(ay);
  let factor = 1;

  // Egypt: margin under pressure, collection slipping.
  if (school.id.startsWith("sch-eg-")) {
    if (kpiId === "feeCollectionRate") factor *= 1 - 0.02 * year;
    if (kpiId === "staffCost" || kpiId === "otherCost") factor *= 1 + 0.06 * year;
  }

  // Pennine Valley: a real turnaround, visible across the linked metrics.
  if (school.id === "sch-nor-01") {
    if (kpiId === "attainmentRate") factor *= 0.82 + 0.07 * year;
    if (kpiId === "progressScore") factor *= 0.4 + 0.3 * year;
    if (kpiId === "staffTurnover") factor *= 1.3 - 0.15 * year;
  }

  // The quiet group-wide slide on the north star.
  if (kpiId === "reEnrolmentRate") factor *= 1 - 0.012 * year;

  return factor;
}

/** A school's value for a KPI, in LOCAL currency where the KPI is money. */
function schoolValue(school: OrgNode, kpiId: string, ay: string): number | null {
  const meta = school.meta!;
  const kpi = kpiById(kpiId);

  // Opened after the period in question: genuinely no data, not a zero.
  // An opening year before the fixture window indexes to -1 and imposes no restriction.
  const openedIndex = ACADEMIC_YEARS.indexOf(meta.openedAy as (typeof ACADEMIC_YEARS)[number]);
  if (openedIndex > 0 && yearIndex(ay) < openedIndex) return null;
  if (kpi.requiresSeniorYears && !meta.hasSeniorYears) return null;
  if (unreportedFor(school.id).includes(kpiId)) return null;

  const range = RANGES[kpiId];
  if (!range) throw new RangeError(`no fixture range for KPI "${kpiId}"`);

  const [min, max] = range;
  const base = seededFloat(min, max, school.id, kpiId);
  // A gentle per-school drift so trends exist and are stable run to run.
  const drift = 1 + (seededFloat(-0.03, 0.045, school.id, kpiId, "drift") * yearIndex(ay));
  let value = base * drift * narrative(school, kpiId, ay);

  if (kpi.money) value *= CURRENCY_SCALE[meta.currency] ?? 1;
  // Rates cannot exceed 1; let them saturate rather than produce 104% attendance.
  if (kpi.format === "percent") value = Math.min(value, 0.995);

  return value;
}

const cache = new Map<string, number | null>();

/**
 * A node's value for a KPI, in the reporting currency.
 *
 * Composites are recomputed from their components at every level rather than averaged,
 * so the headline number and the waterfall in the focus view always agree.
 */
export function kpiValue(
  nodeId: string,
  kpiId: string,
  ay: string,
  basis: FxBasis = "constant",
): number | null {
  const key = `${nodeId}|${kpiId}|${ay}|${basis}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const value = compute(nodeId, kpiId, ay, basis);
  cache.set(key, value);
  return value;
}

function compute(nodeId: string, kpiId: string, ay: string, basis: FxBasis): number | null {
  const node = findNode(nodeId);
  if (!node) throw new RangeError(`unknown org node: "${nodeId}"`);
  const kpi = kpiById(kpiId);

  if (kpi.components) {
    const total = kpi.components.reduce<number | null>((sum, component) => {
      const part = kpiValue(nodeId, component.kpiId, ay, basis);
      if (sum === null || part === null) return null;
      return sum + component.sign * part;
    }, 0);
    const revenue = kpiValue(nodeId, kpi.components[0].kpiId, ay, basis);
    return total === null || revenue === null || revenue === 0 ? null : total / revenue;
  }

  if (node.level === "school") {
    const raw = schoolValue(node, kpiId, ay);
    if (raw === null) return null;
    return kpi.money ? toReporting(raw, node.meta!.currency, ay, FX, basis).value : raw;
  }

  const schools = schoolsUnder(nodeId);
  const values = schools.map((s) => kpiValue(s.id, kpiId, ay, basis));

  if (ADDITIVE.has(kpiId)) return sumIgnoringNulls(values).value;

  // Enrolment-weighted, so a 200-student school does not swing a region's rate as hard
  // as a 2,000-student one. Unmeasured schools drop out of both numerator and weight.
  let weighted = 0;
  let weight = 0;
  schools.forEach((s, i) => {
    const value = values[i];
    if (value === null) return;
    weighted += value * s.meta!.enrolled;
    weight += s.meta!.enrolled;
  });
  return weight === 0 ? meanIgnoringNulls(values).value : weighted / weight;
}

/** Every academic year for which fixtures exist, oldest first. */
export { ACADEMIC_YEARS };
