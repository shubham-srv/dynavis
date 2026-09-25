import type { KpiDefinition, Pillar } from "./types";

/**
 * The KPI catalog — six per pillar, not sixty.
 *
 * This list is the anti-clutter mechanism in PLAN §1.1 made concrete: every entry
 * carries the question it answers, and one that ladders to no pillar has nowhere to go.
 * Proposed in discovery, to be confirmed with the client (PLAN §21.4).
 *
 * Note how few `target`s there are. That is deliberate and realistic — see PLAN §8.4.
 */

const REVENUE: KpiDefinition[] = [
  {
    id: "seatUtilisation",
    label: "Seat utilisation",
    shortLabel: "Seats",
    pillar: "revenue",
    question: "How full are the schools we have already paid for?",
    direction: "higher-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
    target: 0.92,
  },
  {
    id: "revenuePerStudent",
    label: "Revenue per student",
    shortLabel: "Rev/student",
    pillar: "revenue",
    question: "What is each enrolled student worth to us?",
    direction: "higher-is-better",
    format: "currency",
    deltaFormat: "percent",
    precision: 0,
    money: true,
  },
  {
    id: "contributionMargin",
    label: "Contribution margin",
    shortLabel: "Margin",
    pillar: "revenue",
    question: "Is the revenue we are winning actually profitable?",
    direction: "higher-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
    target: 0.22,
    // The composite that makes the focus view's waterfall axis worth building (PLAN §6.6).
    components: [
      { kpiId: "grossRevenue", label: "Gross revenue", sign: 1 },
      { kpiId: "staffCost", label: "Staff cost", sign: -1 },
      { kpiId: "facilityCost", label: "Facility cost", sign: -1 },
      { kpiId: "otherCost", label: "Other cost", sign: -1 },
    ],
  },
  {
    id: "feeCollectionRate",
    label: "Fee collection rate",
    shortLabel: "Collection",
    pillar: "revenue",
    question: "Are we actually collecting the fees we billed?",
    direction: "higher-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
    target: 0.97,
  },
  {
    id: "discountLeakage",
    label: "Discount & scholarship leakage",
    shortLabel: "Leakage",
    pillar: "revenue",
    question: "How much of list-price revenue are we giving away?",
    direction: "lower-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
  },
  {
    id: "netNewEnrolments",
    label: "Net new enrolments",
    shortLabel: "Net new",
    pillar: "revenue",
    question: "Are we growing, once withdrawals are counted?",
    direction: "higher-is-better",
    format: "number",
    deltaFormat: "absolute",
    precision: 0,
  },
];

const EFFICIENCY: KpiDefinition[] = [
  {
    id: "studentTeacherRatio",
    label: "Student:teacher ratio",
    shortLabel: "S:T ratio",
    pillar: "efficiency",
    question: "Are we staffed for both quality and cost?",
    // Both directions are bad: too low is expensive, too high hurts outcomes.
    direction: "band",
    band: { min: 12, max: 18 },
    format: "ratio",
    deltaFormat: "absolute",
    precision: 1,
  },
  {
    id: "classFillRate",
    label: "Class fill rate",
    shortLabel: "Class fill",
    pillar: "efficiency",
    question: "Where is utilisation leaking, class by class?",
    // Band direction with NO agreed band — degrades to neutral until the client sets
    // one. The case PLAN §8.5 exists for; left unresolved on purpose.
    direction: "band",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
  },
  {
    id: "costPerStudent",
    label: "Cost per student",
    shortLabel: "Cost/student",
    pillar: "efficiency",
    question: "What does it cost us to educate one student?",
    direction: "lower-is-better",
    format: "currency",
    deltaFormat: "percent",
    precision: 0,
    money: true,
  },
  {
    id: "staffTurnover",
    label: "Staff turnover",
    shortLabel: "Turnover",
    pillar: "efficiency",
    question: "Are we keeping the people who deliver the outcomes?",
    direction: "lower-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
    target: 0.12,
  },
  {
    id: "teacherAbsenceRate",
    label: "Teacher absence rate",
    shortLabel: "Absence",
    pillar: "efficiency",
    question: "How much teaching is being covered by substitutes?",
    direction: "lower-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
  },
  {
    id: "facilityUtilisation",
    label: "Facility utilisation",
    shortLabel: "Facilities",
    pillar: "efficiency",
    question: "Are we using the estate we are paying for?",
    direction: "higher-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
  },
];

const ACADEMIC: KpiDefinition[] = [
  {
    id: "attainmentRate",
    label: "Attainment",
    shortLabel: "Attainment",
    pillar: "academic",
    question: "What results are students achieving?",
    direction: "higher-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
    target: 0.85,
  },
  {
    id: "progressScore",
    label: "Progress (value-added)",
    shortLabel: "Progress",
    pillar: "academic",
    question: "How much did the school add, given who it enrolled?",
    // Fairer than attainment: raw results largely rank intake quality (PLAN §1.2).
    direction: "higher-is-better",
    format: "number",
    deltaFormat: "absolute",
    precision: 2,
  },
  {
    id: "attendanceRate",
    label: "Student attendance",
    shortLabel: "Attendance",
    pillar: "academic",
    question: "Are students in class?",
    direction: "higher-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
    target: 0.95,
  },
  {
    id: "reEnrolmentRate",
    label: "Re-enrolment rate",
    shortLabel: "Re-enrolment",
    pillar: "academic",
    question: "Are families choosing to stay with us?",
    // Proposed north star: sits across all three pillars and leads rather than lags.
    direction: "higher-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
    target: 0.9,
  },
  {
    id: "universityPlacement",
    label: "University placement",
    shortLabel: "Placement",
    pillar: "academic",
    question: "Where do our leavers go?",
    direction: "higher-is-better",
    format: "percent",
    deltaFormat: "percentage-points",
    precision: 1,
    requiresSeniorYears: true,
  },
  {
    id: "parentNps",
    label: "Parent NPS",
    shortLabel: "Parent NPS",
    pillar: "academic",
    question: "Would parents recommend us?",
    direction: "higher-is-better",
    format: "number",
    deltaFormat: "absolute",
    precision: 0,
  },
];

/** Inputs to composites. Available for decomposition, never offered in the picker. */
const COMPONENTS: KpiDefinition[] = [
  {
    id: "grossRevenue",
    label: "Gross revenue",
    shortLabel: "Gross rev",
    pillar: "revenue",
    question: "What did we bill before costs?",
    direction: "higher-is-better",
    format: "currency",
    deltaFormat: "percent",
    precision: 0,
    money: true,
    componentOnly: true,
  },
  {
    id: "staffCost",
    label: "Staff cost",
    shortLabel: "Staff",
    pillar: "revenue",
    question: "What do we spend on people?",
    direction: "lower-is-better",
    format: "currency",
    deltaFormat: "percent",
    precision: 0,
    money: true,
    componentOnly: true,
  },
  {
    id: "facilityCost",
    label: "Facility cost",
    shortLabel: "Facilities",
    pillar: "revenue",
    question: "What do we spend on the estate?",
    direction: "lower-is-better",
    format: "currency",
    deltaFormat: "percent",
    precision: 0,
    money: true,
    componentOnly: true,
  },
  {
    id: "otherCost",
    label: "Other cost",
    shortLabel: "Other",
    pillar: "revenue",
    question: "What else are we spending?",
    direction: "lower-is-better",
    format: "currency",
    deltaFormat: "percent",
    precision: 0,
    money: true,
    componentOnly: true,
  },
];

export const KPIS: readonly KpiDefinition[] = [...REVENUE, ...EFFICIENCY, ...ACADEMIC, ...COMPONENTS];

const BY_ID = new Map(KPIS.map((kpi) => [kpi.id, kpi]));

export function kpiById(id: string): KpiDefinition {
  const kpi = BY_ID.get(id);
  if (!kpi) throw new RangeError(`unknown KPI: "${id}"`);
  return kpi;
}

/** The KPIs a user can actually choose — composites' inputs are excluded. */
export function selectableKpis(pillar?: Pillar): readonly KpiDefinition[] {
  return KPIS.filter((kpi) => !kpi.componentOnly && (pillar === undefined || kpi.pillar === pillar));
}

/** The proposed north star (PLAN §1.2). */
export const NORTH_STAR_KPI_ID = "reEnrolmentRate";
