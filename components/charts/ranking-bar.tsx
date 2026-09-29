"use client"

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"

import { useContainerSize } from "@/hooks/use-container-size"
import type { ValueFormat } from "@/lib/data/envelope"
import { formatValue } from "@/lib/viz/format"
import { matrixTintVar, matrixTint, seriesVar } from "@/lib/viz/palette"
import { foldToOther } from "@/lib/viz/series"
import { isAtMost, type Variant } from "@/lib/viz/variants"

/**
 * Ranked comparison across the children of a scope.
 *
 * **Horizontal below `expanded`.** Category names read as left-aligned text with no
 * rotation and no truncation, and the natural overflow direction becomes vertical
 * scroll, which phones already do (PLAN §7). Vertical bars are the exception here, not
 * the default.
 *
 * **And horizontal above it too, whenever the names will not fit.** Columns put every
 * label on one line under the axis, so "United Arab Emirates" and "United Kingdom" simply
 * overlapped each other. Rotating them is banned by §7 — it is the thing that made the
 * original dashboard unreadable — and truncating leaves two labels that both read
 * "United…". So the chart measures itself, and where the names do not fit it turns
 * horizontal regardless of variant. Substitution again, for the same reason as everywhere
 * else: the alternative is a chart that is drawn but cannot be read.
 */

/** Rough advance width per character at the axis font size, in CSS px. */
const CHAR_PX = 5.6
/** Breathing room between two adjacent category labels. */
const LABEL_GUTTER = 10
/**
 * How much width one column is worth.
 *
 * A column chart stretched over a width it does not need is mostly whitespace: three
 * countries across an 1100px card put three narrow bars at opposite ends of the page with
 * nothing between them, which reads as broken rather than as sparse. Columns take the room
 * they need and no more; twelve of them still fill the card.
 */
const COLUMN_PX = 150
const COLUMN_AXIS_PX = 60
/** Widest the category-name gutter is allowed to get when the bars are rows. */
const ROW_AXIS_MAX_PX = 132
/** ...and the narrowest, below which a school name is no longer worth printing. */
const ROW_AXIS_MIN_PX = 104

/**
 * The name gutter, as a share of the card.
 *
 * Fixed at 132px it swallowed 42% of a 311px card, leaving the bars and both value labels
 * to share what was left — which is why the labels had nowhere to go at 375px.
 */
export function rowAxisWidth(chartWidth: number): number {
  if (chartWidth <= 0) return ROW_AXIS_MAX_PX
  return Math.round(
    Math.max(ROW_AXIS_MIN_PX, Math.min(ROW_AXIS_MAX_PX, chartWidth * 0.34))
  )
}
/** Rough advance width per character of a value label, at 11px with tabular digits. */
const VALUE_CHAR_PX = 6.2
/** Clearance between a bar's end and its value label. */
const VALUE_GAP_PX = 6
/**
 * Extra room beyond the label itself, at the plot's edges.
 *
 * Reserving exactly one label's width leaves the label flush against whatever is next to
 * it — on the left that is the category name, so "-38.5%" ended up touching "Adelaide
 * Hills School" with no gap at all. Two adjacent pieces of text with no space between
 * them read as one.
 */
const EDGE_CLEARANCE_PX = 14

/**
 * Should this chart lay its bars out as rows rather than columns?
 *
 * Exported and pure so the rule can be tested against real widths — the component
 * measures itself, and a test that cannot inject a width can only re-assert the
 * arithmetic back at itself.
 *
 * `width <= 0` means "not measured yet", and the variant alone decides.
 */
export function prefersRows(
  variant: Variant,
  labels: readonly string[],
  width: number
): boolean {
  if (isAtMost(variant, "standard")) return true
  if (width <= 0 || labels.length === 0) return false

  const capped = labels.length * COLUMN_PX + COLUMN_AXIS_PX
  const band = (Math.min(width, capped) - COLUMN_AXIS_PX) / labels.length
  const longest = labels.reduce(
    (most, label) => Math.max(most, label.length),
    0
  )
  return longest * CHAR_PX + LABEL_GUTTER > band
}

/**
 * How much value-space to reserve at each end so a value label has somewhere to go.
 *
 * Labels sit outside the bar, at the end away from zero. With no reservation a negative
 * bar runs to the left edge of the plot and its label is drawn on top of the category
 * name — "-38.5%" printed straight through "Adelaide Hills School".
 *
 * Converted from pixels to value units against the measured plot, so the reservation is
 * exactly one label wide whatever the card's size. Returns `undefined` before the first
 * measurement, which leaves Recharts' own domain in charge.
 */
export function labelDomain(
  values: readonly number[],
  longestLabelChars: number,
  chartWidth: number
): [number, number] | undefined {
  if (values.length === 0 || chartWidth <= 0) return undefined

  // Bars grow from zero, so zero is always in the domain — a ranking whose bars started
  // at the smallest value would make a 2% gap look like a tenfold difference.
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || Math.abs(max) || 1

  const plotPx = Math.max(chartWidth - rowAxisWidth(chartWidth), 80)
  const labelPx =
    longestLabelChars * VALUE_CHAR_PX + VALUE_GAP_PX + EDGE_CLEARANCE_PX

  // Only the ends that actually have bars need the room.
  const ends = (min < 0 ? 1 : 0) + (max > 0 ? 1 : 0)
  if (ends === 0) return undefined

  /*
    Solve for the padding rather than estimating it.

    The obvious version — `pad = (labelPx / plotPx) * range` — is wrong, and wrong in the
    direction that hides the bug: adding the padding widens the domain, so the same number
    of value units now maps to *fewer* pixels than were asked for. At 375px that shortfall
    was about 20px, which is exactly how much "-38.5%" overlapped the school name by.

    Wanting `labelPx` pixels at each padded end, with a final span of `range + ends·pad`
    mapped across `plotPx`:

        labelPx = pad / (range + ends·pad) · plotPx
      ⇒ pad     = labelPx · range / (plotPx − ends·labelPx)
  */
  const denominator = plotPx - ends * labelPx
  const pad =
    denominator > plotPx * 0.35
      ? (labelPx * range) / denominator
      : // The labels want more room than the bars can spare. Cap it: a chart whose bars
        // have been squeezed into a tenth of the plot has stopped being a ranking, and a
        // slightly tight label is the lesser failure.
        range * 0.45

  return [min < 0 ? min - pad : min, max > 0 ? max + pad : max]
}

/** Rough advance width per character of a category name, at 11px. */
const NAME_CHAR_PX = 5.9

/**
 * Break a category name across at most two lines, truncating rather than spilling.
 *
 * Recharts wraps axis labels on word boundaries with no line cap, so narrowing the gutter
 * turned "Port Melbourne Academy" into three stacked lines that ran into the rows above
 * and below. PLAN §7 is explicit: truncate with a title attribute, never wrap to three
 * lines.
 *
 * A word longer than the line is broken rather than left to overflow — some school names
 * are a single long word, and one that ignored the gutter would sit on top of the bars.
 */
export function wrapName(
  name: string,
  maxChars: number,
  maxLines = 2
): string[] {
  const limit = Math.max(4, maxChars)
  const lines: string[] = []
  let current = ""

  for (const word of name.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= limit) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word
    // A single word wider than the gutter: break it, do not let it overflow.
    while (current.length > limit && lines.length < maxLines - 1) {
      lines.push(current.slice(0, limit))
      current = current.slice(limit)
    }
  }
  if (current) lines.push(current)

  const kept = lines.slice(0, maxLines)
  if (kept.length === 0) return kept

  const lastIndex = kept.length - 1
  /*
    Two ways to overflow, and both end the same way.

    Either there were more lines than fit, or the last line is itself wider than the
    gutter — which the word-breaking branch above can produce, since it leaves whatever
    remains of a broken word as the final line. Checking only the first condition let
    "Aussenhandelsakademie" spill an 11-character remainder into a 10-character gutter.
  */
  if (lines.length > maxLines || kept[lastIndex].length > limit) {
    kept[lastIndex] = `${kept[lastIndex].slice(0, Math.max(1, limit - 1))}…`
  }
  return kept
}

export interface RankingDatum {
  id: string
  label: string
  value: number | null
  /** Direction-aware score in [-1, 1]; tints the bar when material. */
  vsBaseline?: number | null
}

export function RankingBar({
  data,
  variant,
  format,
  precision,
  currency,
  label,
  limit,
  height,
}: {
  data: readonly RankingDatum[]
  variant: Variant
  format: ValueFormat
  precision: number
  currency?: string
  label: string
  limit?: number
  height?: number
}) {
  const [sizeRef, box] = useContainerSize<HTMLDivElement>()

  const withValue = data.filter(
    (row): row is RankingDatum & { value: number } => row.value !== null
  )

  const cap =
    limit ?? (variant === "micro" ? 3 : variant === "compact" ? 5 : 12)
  // `foldToOther` drops unmeasured rows and folds the tail into "Other", so everything it
  // returns has a value — narrowed here so the label and domain maths below need no
  // null checks of their own.
  const rows = foldToOther(withValue, cap) as (RankingDatum & {
    value: number
  })[]

  /*
    Would every category label fit under its own column?

    Until the first measurement `box.width` is 0, which reads as "assume they fit" and
    keeps the variant rule in charge — the same not-yet-measured convention the rest of the
    app uses. Both layouts are the same height, so correcting after measurement costs no
    layout shift.
  */
  const horizontal = prefersRows(
    variant,
    rows.map((row) => row.label),
    box.width
  )

  const fmt = (value: number | null) =>
    formatValue(value, { format, precision, currency, compact: true })

  const valueTexts = rows.map((row) => fmt(row.value))
  const longestValue = valueTexts.reduce(
    (most, text) => Math.max(most, text.length),
    0
  )
  const hasNegative = rows.some((row) => row.value < 0)
  const axisPx = rowAxisWidth(box.width)
  const nameChars = Math.floor((axisPx - 10) / NAME_CHAR_PX)
  const domain = horizontal
    ? labelDomain(
        rows.map((row) => row.value),
        longestValue,
        box.width
      )
    : undefined

  const barSize = 18
  const computed = height ?? Math.max(rows.length * (barSize + 10) + 16, 80)

  // After the hooks, so the hook order cannot change between renders.
  if (withValue.length === 0) return null

  return (
    <div
      ref={sizeRef}
      role="img"
      aria-label={label}
      style={{ height: computed }}
      className="w-full"
    >
      {/*
        Left-aligned and no wider than the columns need. `maxWidth` rather than `width`, so
        a narrow card still shrinks it, and only in the vertical case — horizontal bars are
        rows and should always use the full width available for their value labels.
      */}
      <div
        className="h-full w-full"
        style={
          horizontal
            ? undefined
            : { maxWidth: rows.length * COLUMN_PX + COLUMN_AXIS_PX }
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={rows}
            layout={horizontal ? "vertical" : "horizontal"}
            /*
              Columns put their value label above the bar, and a 4px top margin clipped it
              off — the tallest bar's figure was cut in half. The gutter is on whichever
              side the labels actually sit.
            */
            margin={{
              top: horizontal ? 4 : 18,
              right: horizontal ? 8 : 8,
              // Columns put a negative value's label below the bar, so the gutter has to
              // be on the side the labels are actually on.
              bottom: !horizontal && hasNegative ? 16 : 0,
              left: 0,
            }}
            // Keeps a two-category chart from stranding two thin bars at opposite ends of
            // a 1100px card: the bars grow into their bands, up to a sane cap.
            barCategoryGap="18%"
          >
            {horizontal ? (
              <>
                {/*
                  An explicit domain, so there is always one label's worth of room beyond
                  the longest bar at each end that has one.
                */}
                <XAxis type="number" hide domain={domain ?? undefined} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={axisPx}
                  tickLine={false}
                  axisLine={false}
                  // Rendered by hand: Recharts wraps on word boundaries with no line cap,
                  // and a third line runs into the neighbouring rows (PLAN §7). The full
                  // name stays available as a tooltip, and in the accessible table, which
                  // is the authority for this chart anyway.
                  tick={(props) => {
                    const tickX = Number(props.x ?? 0)
                    const tickY = Number(props.y ?? 0)
                    const name = String(props.payload?.value ?? "")
                    const lines = wrapName(name, nameChars)
                    // Shifted up by half the block so a two-line name stays centred on
                    // its own bar rather than hanging below it.
                    const top = tickY - ((lines.length - 1) * 12) / 2
                    return (
                      <text
                        x={tickX}
                        y={top}
                        textAnchor="end"
                        fontSize={11}
                        fill="var(--muted-foreground)"
                      >
                        <title>{name}</title>
                        {lines.map((line, index) => (
                          <tspan
                            key={line + index}
                            x={tickX}
                            dy={index === 0 ? 4 : 12}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    )
                  }}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(value: number) => fmt(value)}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                />
              </>
            )}

            <Bar
              dataKey="value"
              // Fixed height per row when horizontal, because rows stack and the chart's
              // height is computed from their count. When vertical the band decides, so
              // few categories give wide bars instead of thin marooned ones.
              {...(horizontal ? { barSize } : { maxBarSize: 64 })}
              // 4px rounded data-ends, anchored to the baseline (PLAN §11.4).
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell
                  key={row.id}
                  fill={
                    matrixTintVar(matrixTint(row.vsBaseline ?? null)) ??
                    seriesVar(0)
                  }
                />
              ))}
              {/*
                Direct labels: with values on the marks the legend is unnecessary.

                Rendered by hand rather than with `position`, because a single position is
                wrong for half the data. A bar grows from zero, so its far end is on the
                right when the value is positive and on the left when it is negative —
                "right" put every negative label back at the axis, printed over the school
                name. The end away from zero is the only placement that reads for both.
              */}
              <LabelList
                dataKey="value"
                content={(props) => {
                  const value = Number(props.value)
                  if (!Number.isFinite(value)) return null
                  const x = Number(props.x ?? 0)
                  const y = Number(props.y ?? 0)
                  const w = Number(props.width ?? 0)
                  const h = Number(props.height ?? 0)
                  const negative = value < 0

                  /*
                    Derived with min/max rather than assuming `x` is the left edge.

                    Recharts anchors a bar at the zero line and reports a *negative*
                    width for a negative value, so `x + w` is the left edge there and the
                    right edge elsewhere. Taking the arithmetic at face value put every
                    negative label inside its own bar, at the end nearest zero.
                  */
                  const left = Math.min(x, x + w)
                  const right = Math.max(x, x + w)
                  const top = Math.min(y, y + h)
                  const bottom = Math.max(y, y + h)

                  const position = horizontal
                    ? {
                        // The end away from zero, always outside the bar.
                        x: negative
                          ? left - VALUE_GAP_PX
                          : right + VALUE_GAP_PX,
                        y: top + Math.abs(h) / 2 + 4,
                        anchor: negative ? ("end" as const) : ("start" as const),
                      }
                    : {
                        x: left + Math.abs(w) / 2,
                        y: negative ? bottom + 13 : top - 5,
                        anchor: "middle" as const,
                      }

                  return (
                    <text
                      x={position.x}
                      y={position.y}
                      textAnchor={position.anchor}
                      fontSize={11}
                      fill="var(--foreground)"
                      className="tabular-nums"
                    >
                      {fmt(value)}
                    </text>
                  )
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
