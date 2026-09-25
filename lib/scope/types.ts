/**
 * Where you are in the organisation.
 *
 * The hierarchy is data, not an enum: a multinational group always has exceptions — a
 * country with one school and no cluster tier, a school with no senior years. Hardcoding
 * an eight-level union is the most likely source of rework when real org data lands
 * (PLAN §1.3, D13).
 */

export interface ScopeLevel {
  key: string;
  label: string;
  pluralLabel: string;
  depth: number;
}

/** A position in the org tree. The array *is* the breadcrumb trail. */
export type ScopeRef = readonly { level: string; id: string; label: string }[];

export interface ScopeChild {
  id: string;
  label: string;
  canDrill: boolean;
}

export interface ScopeNode {
  ref: ScopeRef;
  /** The level of this node's children, or `null` at a leaf — the matrix renders nothing below. */
  childLevel: string | null;
  children: readonly ScopeChild[];
  /** Role-derived hint. The client hides affordances with it; the SERVER still enforces. */
  canDrill: boolean;
}
