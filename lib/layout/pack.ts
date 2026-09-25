import {
  type Breakpoint,
  colSpan,
  GRID_COLUMNS,
  type SizeToken,
} from "./tokens"

/**
 * The layout solver.
 *
 * Pure, and deliberately small. Given the user's ordered widget list it returns items
 * in **final render order** with explicit grid placement, which is what lets the DOM be
 * emitted in that same order.
 *
 * **Always pass the user's saved order, never this function's own output.** pack() is
 * deterministic but not idempotent: lookahead can pull a different item forward on a
 * second pass. That is harmless because preferences store the user's logical ordering
 * (PLAN §5.5), and it is asserted to converge rather than oscillate.
 *
 * That last part is the whole reason this exists instead of `grid-auto-flow: dense`.
 * Dense packing reorders items visually without reordering the DOM, so reading order
 * and tab order stop matching what is on screen — a real accessibility failure that no
 * automated checker will catch (PLAN D4, §9).
 */

export interface PackInput {
  id: string
  size: SizeToken
  rowSpan: number
}

export interface PackedItem {
  id: string
  /** 1-based, as CSS grid lines are. */
  colStart: number
  colSpan: number
  rowSpan: number
  row: number
}

export interface PackOptions {
  /**
   * How far ahead the solver may look for an item that fits the gap on the current
   * row. Bounded on purpose: unbounded lookahead fills every gap but lets a widget
   * teleport across the dashboard, which destroys the user's sense of their own
   * ordering.
   */
  lookahead?: number
}

export const DEFAULT_LOOKAHEAD = 2

export function pack(
  items: readonly PackInput[],
  breakpoint: Breakpoint,
  options: PackOptions = {}
): PackedItem[] {
  const lookahead = options.lookahead ?? DEFAULT_LOOKAHEAD
  const columns = GRID_COLUMNS[breakpoint]

  const remaining = items.map((item) => ({
    ...item,
    // An item can never be wider than the grid; clamping here keeps every downstream
    // consumer from having to think about it.
    span: Math.min(Math.max(colSpan(item.size, breakpoint), 1), columns),
    rowSpan: Math.max(item.rowSpan, 1),
  }))

  const packed: PackedItem[] = []
  let row = 1
  let cursor = 1

  while (remaining.length > 0) {
    const free = columns - (cursor - 1)

    // The next item in the user's order, if it fits.
    let index = remaining[0].span <= free ? 0 : -1

    // Otherwise look a little way ahead for something that does, rather than leaving
    // a hole. `lookahead: 0` disables this entirely and preserves order exactly.
    if (index === -1 && lookahead > 0) {
      const limit = Math.min(remaining.length, lookahead + 1)
      for (let i = 1; i < limit; i++) {
        if (remaining[i].span <= free) {
          index = i
          break
        }
      }
    }

    if (index === -1) {
      // Nothing fits: start a new row. Guaranteed to terminate because spans are
      // clamped to the column count, so the first item always fits an empty row.
      row += 1
      cursor = 1
      continue
    }

    const [item] = remaining.splice(index, 1)
    packed.push({
      id: item.id,
      colStart: cursor,
      colSpan: item.span,
      rowSpan: item.rowSpan,
      row,
    })
    cursor += item.span

    if (cursor > columns) {
      row += 1
      cursor = 1
    }
  }

  return packed
}

/**
 * Does the packed output read left-to-right, top-to-bottom in array order?
 *
 * Exported so the invariant can be asserted in tests *and* cheaply in development:
 * if this is ever false, the DOM order no longer matches the visual order.
 */
export function isReadingOrder(packed: readonly PackedItem[]): boolean {
  for (let i = 1; i < packed.length; i++) {
    const previous = packed[i - 1]
    const current = packed[i]
    if (current.row < previous.row) return false
    if (current.row === previous.row && current.colStart < previous.colStart) {
      return false
    }
  }
  return true
}

/** How far any item moved from its position in the user's ordering. */
export function maxDisplacement(
  items: readonly PackInput[],
  packed: readonly PackedItem[]
): number {
  const original = new Map(items.map((item, index) => [item.id, index]))
  return packed.reduce(
    (worst, item, index) =>
      Math.max(worst, Math.abs((original.get(item.id) ?? index) - index)),
    0
  )
}
