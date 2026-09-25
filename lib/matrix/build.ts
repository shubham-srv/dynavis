import { comparablePriorPeriod } from "@/lib/calendar/academic"
import type { PeriodRef } from "@/lib/calendar/types"
import { computeVsBaseline, resolveBaseline } from "@/lib/baseline/resolve"
import type { Baseline, BaselineKind } from "@/lib/data/envelope"
import { ACADEMIC_YEARS } from "@/lib/data/fixtures/fx"
import { findNode, unreportedFor } from "@/lib/data/fixtures/org"
import { kpiValue } from "@/lib/data/fixtures/values"
import { toleranceFor } from "@/lib/data/widget-data"
import { kpiById } from "@/lib/kpi/catalog"
import type { DeltaFormat, Pillar } from "@/lib/kpi/types"
import type { FxBasis } from "@/lib/money/fx"
import type { ValueFormat } from "@/lib/data/envelope"
import type { Direction } from "@/lib/data/envelope"
import { computeDelta } from "@/lib/viz/format"

/**
 * The matrix navigator's data.
 *
 * Rows are always **the children of the current scope** (PLAN D15). That one decision
 * bounds the row count at every level — regions, then countries, then schools — so the
 * "500-school matrix" problem never arises, and it makes the matrix the drill mechanism
 * rather than a separate view to keep in sync.
 */

export interface MatrixColumn {
  kpiId: string
  label: string
  shortLabel: string
  pillar: Pillar
  format: ValueFormat
  deltaFormat: DeltaFormat
  precision: number
  direction: Direction
  money: boolean
  /**
   * Which baseline this column actually resolved to. Columns in one matrix legitimately
   * differ — with partial targets some read "vs. target" and others "vs. last year" — so
   * this is labelled per column, never per matrix (PLAN §8.4).
   */
  baselineKind: BaselineKind
  baselineLabel: string
}

export interface MatrixCell {
  /** `null` means not measured. Never 0, never blank (PLAN §12.3). */
  value: number | null
  baseline: Baseline
  /** Signed change in display units — percentage points for rates. */
  delta: number | null
  /** Direction-aware, normalised to [-1, 1]. The colour input. */
  vsBaseline: number | null
  /** Why a value is missing, when we know. */
  note?: string
}

export interface MatrixRow {
  id: string
  label: string
  canDrill: boolean
  /** New this period: every prior-period baseline is empty, which is not a bad score. */
  isNew: boolean
}

export interface MatrixEnvelope {
  scopeId: string
  rowLevel: string | null
  rows: readonly MatrixRow[]
  columns: readonly MatrixColumn[]
  /** cells[rowIndex][columnIndex] */
  cells: readonly (readonly MatrixCell[])[]
  period: PeriodRef
  baselineMode: BaselineKind
}

export interface BuildMatrixOptions {
  scopeId: string
  kpiIds: readonly string[]
  period: PeriodRef
  baselineMode?: BaselineKind
  basis?: FxBasis
}

export function buildMatrix({
  scopeId,
  kpiIds,
  period,
  baselineMode = "target",
  basis = "constant",
}: BuildMatrixOptions): MatrixEnvelope {
  const node = findNode(scopeId)
  if (!node) throw new RangeError(`unknown org node: "${scopeId}"`)

  const children = node.children
  const prior = comparablePriorPeriod(period)
  const priorExists = ACADEMIC_YEARS.includes(
    prior.id as (typeof ACADEMIC_YEARS)[number]
  )

  const rows: MatrixRow[] = children.map((child) => ({
    id: child.id,
    label: child.label,
    canDrill: child.children.length > 0,
    isNew: child.meta?.openedAy === period.id,
  }))

  // The peer set for a column IS the column — the other children on screen.
  const columnValues = kpiIds.map((kpiId) =>
    children.map((child) => kpiValue(child.id, kpiId, period.id, basis))
  )

  const cells = children.map((child, rowIndex) =>
    kpiIds.map((kpiId, columnIndex) => {
      const kpi = kpiById(kpiId)
      const value = columnValues[columnIndex][rowIndex]
      const priorValue = priorExists
        ? kpiValue(child.id, kpiId, prior.id, basis)
        : null

      const baseline = resolveBaseline(baselineMode, {
        target: kpi.target,
        band: kpi.band,
        priorValue,
        priorPeriod: prior,
        peerValues: columnValues[columnIndex],
        peerBandLabel: child.meta?.peerBand,
      })

      const baseValue =
        baseline.kind === "none" ? null : (baseline.value ?? null)

      return {
        value,
        baseline,
        delta: computeDelta(value, baseValue, kpi.deltaFormat),
        vsBaseline: computeVsBaseline(
          value,
          baseline,
          kpi.direction,
          toleranceFor(kpiId)
        ),
        note: noteFor(child.id, kpiId, value),
      }
    })
  )

  const columns: MatrixColumn[] = kpiIds.map((kpiId, columnIndex) => {
    const kpi = kpiById(kpiId)
    const kinds = cells.map((row) => row[columnIndex].baseline.kind)
    const kind = dominantKind(kinds)
    return {
      kpiId,
      label: kpi.label,
      shortLabel: kpi.shortLabel,
      pillar: kpi.pillar,
      format: kpi.format,
      deltaFormat: kpi.deltaFormat,
      precision: kpi.precision,
      direction: kpi.direction,
      money: Boolean(kpi.money),
      baselineKind: kind,
      baselineLabel: labelForKind(kind, prior),
    }
  })

  return {
    scopeId,
    rowLevel: children[0]?.level ?? null,
    rows,
    columns,
    cells,
    period,
    baselineMode,
  }
}

/** A number whose baseline is ambiguous is worse than no number (PLAN §8.4). */
function labelForKind(kind: BaselineKind, prior: PeriodRef): string {
  switch (kind) {
    case "target":
      return "vs. target"
    case "prior-period":
      return `vs. ${prior.id}`
    case "peer-median":
      return "vs. peer median"
    case "none":
      return "no baseline"
  }
}

function dominantKind(kinds: readonly BaselineKind[]): BaselineKind {
  if (kinds.length === 0) return "none"
  const tally = new Map<BaselineKind, number>()
  for (const kind of kinds) tally.set(kind, (tally.get(kind) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

/** Say *why* a cell is empty where we can — "—" with no explanation is a dead end. */
function noteFor(
  nodeId: string,
  kpiId: string,
  value: number | null
): string | undefined {
  if (value !== null) return undefined
  if (unreportedFor(nodeId).includes(kpiId))
    return "Not reported in this country"
  const node = findNode(nodeId)
  if (node?.meta && !node.meta.hasSeniorYears) return "No senior year groups"
  if (node?.meta?.openedAy) return "Opened this academic year"
  return "Not measured"
}
