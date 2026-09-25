"use client"

import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useRef, useState } from "react"

import type { MatrixCell, MatrixEnvelope } from "@/lib/matrix/build"
import {
  ariaSortFor,
  DEFAULT_SORT,
  nextSortState,
  sortedRowOrder,
  type SortState,
  topAndBottom,
} from "@/lib/matrix/sort"
import { cn } from "@/lib/utils"
import { formatDelta, formatValue, NOT_MEASURED } from "@/lib/viz/format"
import { directionGlyph, matrixTint, matrixTintVar } from "@/lib/viz/palette"
import type { Variant } from "@/lib/viz/variants"

/**
 * The matrix navigator.
 *
 * Not a widget — the *navigator* (PLAN D15, §8.1). Rows are the children of the current
 * scope, so a row click is the drill-down, and the row count stays bounded at every
 * level. One component is the matrix view, the navigation, and the source of the
 * breadcrumb trail.
 *
 * Below `standard` it becomes a **ranked list** rather than a shrunken grid. That is a
 * better phone experience, not a degraded one: a 12-column grid is unreadable at 375px
 * at any font size that fits (PLAN §8.7).
 */

export interface MatrixNavigatorProps {
  matrix: MatrixEnvelope
  variant: Variant
  hrefFor: (rowId: string) => string
  /** KPI shown when the viewport is too narrow for a grid. */
  initialFocusKpi?: string
}

export function MatrixNavigator({
  matrix,
  variant,
  hrefFor,
  initialFocusKpi,
}: MatrixNavigatorProps) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [focusKpi, setFocusKpi] = useState(
    initialFocusKpi ?? matrix.columns[0]?.kpiId
  )

  if (matrix.rows.length === 0 || matrix.columns.length === 0) return null

  const narrow = variant === "micro" || variant === "compact"
  return narrow ? (
    <RankedList
      matrix={matrix}
      hrefFor={hrefFor}
      focusKpi={focusKpi}
      onFocusKpi={setFocusKpi}
      limit={variant === "micro" ? 5 : matrix.rows.length}
    />
  ) : (
    <MatrixTable
      matrix={matrix}
      hrefFor={hrefFor}
      sort={sort}
      onSort={setSort}
      maxColumns={variant === "standard" ? 4 : matrix.columns.length}
    />
  )
}

/* ------------------------------------------------------------------ table */

function MatrixTable({
  matrix,
  hrefFor,
  sort,
  onSort,
  maxColumns,
}: {
  matrix: MatrixEnvelope
  hrefFor: (rowId: string) => string
  sort: SortState
  onSort: (next: SortState) => void
  maxColumns: number
}) {
  const columns = matrix.columns.slice(0, maxColumns)
  const order = useMemo(() => sortedRowOrder(matrix, sort), [matrix, sort])
  const gridRef = useRef<HTMLTableElement>(null)
  const [active, setActive] = useState<[number, number]>([0, -1])

  /**
   * Roving tabindex: one tab stop for the whole grid, arrows to move within it.
   * Analysts expect arrow navigation in a table, and 6 rows x 6 columns of individually
   * tabbable cells would otherwise bury the rest of the page (PLAN §8.8).
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableElement>) => {
      const [row, col] = active
      const lastCol = columns.length - 1
      let next: [number, number] | null = null

      if (event.key === "ArrowRight") next = [row, Math.min(col + 1, lastCol)]
      else if (event.key === "ArrowLeft") next = [row, Math.max(col - 1, -1)]
      else if (event.key === "ArrowDown")
        next = [Math.min(row + 1, order.length - 1), col]
      else if (event.key === "ArrowUp") next = [Math.max(row - 1, 0), col]
      else if (event.key === "Home") next = [row, -1]
      else if (event.key === "End") next = [row, lastCol]
      else if (event.key === "Enter" && col >= 0) {
        // The caption promises Enter opens a row, so a focused *cell* drills too —
        // otherwise the only way in is to arrow back to column -1 first.
        event.preventDefault()
        gridRef.current
          ?.querySelector<HTMLAnchorElement>(`[data-cell="${row}--1"]`)
          ?.click()
        return
      }
      if (!next) return

      event.preventDefault()
      setActive(next)
      const selector = `[data-cell="${next[0]}-${next[1]}"]`
      gridRef.current?.querySelector<HTMLElement>(selector)?.focus()
    },
    [active, columns.length, order.length]
  )

  return (
    <div
      // Wide matrices scroll inside their own container, never the page (PLAN §7).
      className="relative -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <table
        ref={gridRef}
        onKeyDown={onKeyDown}
        className="w-full border-collapse text-sm"
      >
        <caption className="sr-only">
          {matrix.columns.length} metrics for {matrix.rows.length}{" "}
          {pluralise(matrix.rowLevel ?? "child", matrix.rows.length)},{" "}
          {matrix.columns[0]?.baselineLabel}. Use the arrow keys to move between
          cells and Enter to open a row.
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-background py-2 pr-3 text-left text-xs font-medium text-muted-foreground"
            >
              Name
            </th>
            {columns.map((column) => (
              <th
                key={column.kpiId}
                scope="col"
                aria-sort={ariaSortFor(sort, column.kpiId)}
                className="border-b border-border px-2 py-2 text-right align-bottom"
              >
                <button
                  type="button"
                  onClick={() => onSort(nextSortState(sort, column.kpiId))}
                  className="inline-flex min-h-11 flex-col items-end justify-end gap-0.5 rounded-md px-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex items-center gap-1 text-xs font-medium">
                    {column.shortLabel}
                    <SortIcon state={ariaSortFor(sort, column.kpiId)} />
                  </span>
                  {/* A number whose baseline is ambiguous is worse than no number. */}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {column.baselineLabel}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((rowIndex, displayIndex) => {
            const row = matrix.rows[rowIndex]
            return (
              <tr key={row.id} className="group border-b border-border/60">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[12rem] bg-background py-1.5 pr-3 text-left font-normal group-hover:bg-accent/40"
                >
                  <Link
                    href={hrefFor(row.id)}
                    data-cell={`${displayIndex}--1`}
                    tabIndex={
                      active[0] === displayIndex && active[1] === -1 ? 0 : -1
                    }
                    onFocus={() => setActive([displayIndex, -1])}
                    className="flex min-h-11 items-center gap-1 truncate rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="truncate">{row.label}</span>
                    {row.isNew ? (
                      <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                        new
                      </span>
                    ) : null}
                    {row.canDrill ? (
                      <ChevronRight
                        aria-hidden
                        className="size-3 shrink-0 text-muted-foreground"
                      />
                    ) : null}
                  </Link>
                </th>

                {columns.map((column, columnIndex) => (
                  <Cell
                    key={column.kpiId}
                    cell={matrix.cells[rowIndex][columnIndex]}
                    column={column}
                    rowLabel={row.label}
                    dataCell={`${displayIndex}-${columnIndex}`}
                    tabIndex={
                      active[0] === displayIndex && active[1] === columnIndex
                        ? 0
                        : -1
                    }
                    onFocus={() => setActive([displayIndex, columnIndex])}
                  />
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Cell({
  cell,
  column,
  rowLabel,
  dataCell,
  tabIndex,
  onFocus,
}: {
  cell: MatrixCell
  column: MatrixEnvelope["columns"][number]
  rowLabel: string
  dataCell: string
  tabIndex: number
  onFocus: () => void
}) {
  const tint = matrixTintVar(matrixTint(cell.vsBaseline))
  const valueText = formatValue(cell.value, {
    format: column.format,
    precision: column.precision,
    currency: column.money ? "USD" : undefined,
    compact: column.money,
  })
  const deltaText = formatDelta(cell.delta, {
    deltaFormat: column.deltaFormat,
    precision: 1,
    valueFormat: column.format,
    currency: column.money ? "USD" : undefined,
    compact: true,
  })

  return (
    <td
      data-cell={dataCell}
      tabIndex={tabIndex}
      onFocus={onFocus}
      // The announcement carries row, column, value, delta AND the baseline — a number
      // whose comparison is unstated is not a fact (PLAN §8.8).
      aria-label={
        cell.value === null
          ? `${rowLabel}, ${column.label}, ${cell.note ?? "not measured"}`
          : `${rowLabel}, ${column.label}, ${valueText}, ${
              cell.delta === null
                ? "no comparison"
                : `${deltaText} ${column.baselineLabel}`
            }`
      }
      style={tint ? { backgroundColor: tint } : undefined}
      className="px-2 py-1.5 text-right align-middle tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
    >
      {cell.value === null ? (
        <span className="text-muted-foreground" title={cell.note}>
          {NOT_MEASURED}
          <span className="sr-only"> {cell.note ?? "not measured"}</span>
        </span>
      ) : (
        <span className="flex flex-col items-end leading-tight">
          <span>{valueText}</span>
          {cell.delta === null ? null : (
            <span
              className={cn(
                "text-[11px]",
                // Muted ink is legible on the card surface (4.67:1) and NOT on a tint
                // (1.76:1). Measured, not assumed — axe caught this one.
                tint ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {/* The glyph is the CVD / forced-colors / deadband channel. Mandatory. */}
              <span aria-hidden>{directionGlyph(cell.vsBaseline)} </span>
              {deltaText}
            </span>
          )}
        </span>
      )}
    </td>
  )
}

/** Crude but sufficient: every level key here is a regular noun except "child". */
function pluralise(word: string, count: number): string {
  if (count === 1) return word
  return word === "child"
    ? "children"
    : word === "country"
      ? "countries"
      : `${word}s`
}

function SortIcon({ state }: { state: "ascending" | "descending" | "none" }) {
  const className = "size-3 shrink-0"
  if (state === "ascending")
    return <ArrowUp aria-hidden className={className} />
  if (state === "descending")
    return <ArrowDown aria-hidden className={className} />
  return (
    <ChevronsUpDown
      aria-hidden
      className={cn(className, "text-muted-foreground/50")}
    />
  )
}

/* ------------------------------------------------------------ ranked list */

function RankedList({
  matrix,
  hrefFor,
  focusKpi,
  onFocusKpi,
  limit,
}: {
  matrix: MatrixEnvelope
  hrefFor: (rowId: string) => string
  focusKpi: string
  onFocusKpi: (kpiId: string) => void
  limit: number
}) {
  const column = matrix.columns.find(
    (candidate) => candidate.kpiId === focusKpi
  )
  const columnIndex = matrix.columns.findIndex(
    (candidate) => candidate.kpiId === focusKpi
  )
  // Show every row when they all fit. Only split into two ends when there are more
  // rows than the limit — and then take half the rows at most, so the two groups
  // cannot overlap and show the same school twice.
  const showBothEnds = matrix.rows.length > limit
  const groupSize = showBothEnds
    ? Math.min(limit, Math.floor(matrix.rows.length / 2))
    : matrix.rows.length

  const { top, bottom } = useMemo(
    () => topAndBottom(matrix, focusKpi, groupSize),
    [matrix, focusKpi, groupSize]
  )

  if (!column || columnIndex === -1) return null

  const values = matrix.cells
    .map((row) => row[columnIndex].value)
    .filter((value): value is number => value !== null)
  const max = values.length ? Math.max(...values.map(Math.abs)) : 1

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Ranked by
        <select
          value={focusKpi}
          onChange={(event) => onFocusKpi(event.target.value)}
          className="min-h-11 rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {matrix.columns.map((candidate) => (
            <option key={candidate.kpiId} value={candidate.kpiId}>
              {candidate.label}
            </option>
          ))}
        </select>
      </label>

      <RankGroup
        heading={showBothEnds ? "Top" : undefined}
        indices={top}
        matrix={matrix}
        columnIndex={columnIndex}
        column={column}
        hrefFor={hrefFor}
        max={max}
      />
      {showBothEnds && bottom.length ? (
        <RankGroup
          heading="Bottom"
          indices={bottom}
          matrix={matrix}
          columnIndex={columnIndex}
          column={column}
          hrefFor={hrefFor}
          max={max}
        />
      ) : null}
    </div>
  )
}

function RankGroup({
  heading,
  indices,
  matrix,
  columnIndex,
  column,
  hrefFor,
  max,
}: {
  heading?: string
  indices: readonly number[]
  matrix: MatrixEnvelope
  columnIndex: number
  column: MatrixEnvelope["columns"][number]
  hrefFor: (rowId: string) => string
  max: number
}) {
  return (
    <div className="flex flex-col gap-1">
      {heading ? (
        <h3 className="text-xs font-medium text-muted-foreground">{heading}</h3>
      ) : null}
      <ul className="flex flex-col">
        {indices.map((rowIndex) => {
          const row = matrix.rows[rowIndex]
          const cell = matrix.cells[rowIndex][columnIndex]
          const valueText = formatValue(cell.value, {
            format: column.format,
            precision: column.precision,
            currency: column.money ? "USD" : undefined,
            compact: column.money,
          })
          const width =
            cell.value === null
              ? 0
              : Math.min((Math.abs(cell.value) / max) * 100, 100)

          return (
            <li
              key={row.id}
              className="border-b border-border/60 last:border-0"
            >
              <Link
                href={hrefFor(row.id)}
                className="flex min-h-11 items-center gap-3 rounded-md py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {row.label}
                </span>
                <span
                  aria-hidden
                  className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:block"
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      backgroundColor:
                        matrixTintVar(matrixTint(cell.vsBaseline)) ??
                        "var(--muted-foreground)",
                    }}
                  />
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {valueText}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
