import type { Direction, ValueFormat } from "@/lib/data/envelope";

export type Pillar = "revenue" | "efficiency" | "academic";

export const PILLARS: Record<Pillar, { label: string; question: string }> = {
  revenue: { label: "Profitable revenue", question: "Are we growing revenue profitably?" },
  efficiency: { label: "Operational efficiency", question: "Are we running schools efficiently?" },
  academic: { label: "Academic outcomes", question: "Are students doing better?" },
};

/** How a change on this KPI is expressed. Getting it wrong is a credibility bug (PLAN §8.6). */
export type DeltaFormat = "absolute" | "percent" | "percentage-points";

export interface KpiDefinition {
  id: string;
  label: string;
  /** For narrow matrix column headers. */
  shortLabel: string;
  pillar: Pillar;
  /** The single question it answers. If you cannot write one, cut the KPI (PLAN §1.1). */
  question: string;

  direction: Direction;
  /**
   * Required for a meaningful `band` direction. A band KPI *without* one degrades to
   * `neutral` — movement shown, no judgement — rather than guessing which way is good
   * (PLAN §8.5).
   */
  band?: { min: number; max: number };

  format: ValueFormat;
  deltaFormat: DeltaFormat;
  precision: number;
  unit?: string;

  /**
   * Present only where the client has agreed a target. Deliberately partial: most KPIs
   * have none, which is the realistic case and the one that breaks per-column baseline
   * labelling (PLAN §8.4).
   */
  target?: number;

  /** Reported in local currency; needs FX conversion before comparison (PLAN §12.2). */
  money?: boolean;

  /** Decomposition for the focus view's waterfall axis, in order (PLAN §6.6). */
  components?: readonly { kpiId: string; label: string; sign: 1 | -1 }[];

  /** An input to a composite — available for decomposition, never offered in the picker. */
  componentOnly?: boolean;

  /** Meaningless for a school with no senior year groups. */
  requiresSeniorYears?: boolean;
}
