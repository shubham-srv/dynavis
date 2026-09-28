"use client"

import { useId, useMemo, useState } from "react"

import { QuadrantPlot } from "@/components/charts/scatter-chart"
import { useContainerWidth } from "@/components/dashboard/container-size"
import type { WidgetRenderProps } from "@/lib/registry/types"
import { kpiById } from "@/lib/kpi/catalog"
import { cn } from "@/lib/utils"
import { formatValue } from "@/lib/viz/format"
import { seriesVar } from "@/lib/viz/palette"
import {
  describeStrength,
  favourabilityOf,
  groupByQuadrant,
  outliers,
  pearson,
  quadrantSplit,
  type Favourability,
  type QuadrantKey,
} from "@/lib/viz/quadrant"

/**
 * Two KPIs against each other — the widget that proves the responsive thesis.
 *
 * Every other widget demonstrates substitution weakly: a card drops a sparkline, a bar
 * chart turns horizontal. Those are the same chart with less in it. This one changes what
 * kind of object it is at each rung (PLAN §7, D1):
 *
 *   micro     a sentence. No chart, no hidden chart DOM — the finding in words, plus a
 *             link to the focus view for anyone who wants the marks.
 *   compact   four quadrant tiles with counts. Keeps the insight (which group a school is
 *             in) and discards the geometry entirely. This is the rung that makes the
 *             argument: it is not a small scatter, it is a different chart of the same
 *             fact.
 *   standard  a real scatter with the median crosshair. No radius channel.
 *   expanded  radius encodes enrolment, quadrants get verdicts, outliers get named.
 *
 * §7 originally specified "binned hexes or top-N" for compact. Hexbin addresses
 * overplotting above roughly a thousand marks; this chart has fourteen to forty, so
 * binning would hide structure to solve a problem that does not exist here. The plan has
 * been amended and the reason recorded there.
 */

/** Human wording for a quadrant, given which way each axis points. */
function quadrantLabel(
  key: QuadrantKey,
  xLabel: string,
  yLabel: string
): string {
  const [xSide, ySide] = key.split("-")
  return `${xSide === "high" ? "High" : "Low"} ${xLabel.toLowerCase()} · ${
    ySide === "high" ? "high" : "low"
  } ${yLabel.toLowerCase()}`
}

const TINT: Record<Favourability, string | null> = {
  good: "var(--matrix-pos-1)",
  poor: "var(--matrix-neg-1)",
  mixed: null,
  unknown: null,
}

export function QuadrantWidget({ datum, variant, scope }: WidgetRenderProps) {
  const pair = datum.pair
  // Hooks run before any early return, so the empty and too-few branches below cannot
  // change the hook order between renders.
  const points = useMemo(() => pair?.points ?? [], [pair])
  // The chart needs the real width, not just the variant: an SVG viewBox letterboxes
  // against a fixed height, so a 480-wide box centred in an 860-wide widget left a third
  // of the card empty on each side.
  const { width } = useContainerWidth()
  /*
    Which quadrant tile is open.

    A count answers "how many"; the next question is always "which ones", and on a phone
    there is nowhere else to go and ask it — the scatter that would show you is exactly
    what this rung replaced. So the tile expands.
  */
  const [openQuadrant, setOpenQuadrant] = useState<QuadrantKey | null>(null)
  const panelId = useId()

  const stats = useMemo(() => {
    const split = quadrantSplit(points)
    return {
      r: pearson(points),
      split,
      groups: split ? groupByQuadrant(points, split) : null,
      exceptions: outliers(points),
    }
  }, [points])

  // A widget with no paired loader wired is a registry mistake, not a data gap — say so
  // rather than rendering an empty box someone will debug as missing fixtures.
  if (!pair) {
    return (
      <p className="text-sm text-muted-foreground">
        This widget needs a paired KPI. Set <code>pairKpiId</code> on its
        registry entry.
      </p>
    )
  }

  const xKpi = kpiById(pair.xKpiId)
  const yKpi = kpiById(pair.yKpiId)

  if (points.length < 3) {
    return (
      <p className="text-sm text-muted-foreground">
        {points.length === 0
          ? `No schools below ${scope.at(-1)?.label ?? "this level"} report both measures.`
          : `Only ${points.length} school${points.length === 1 ? "" : "s"} report${points.length === 1 ? "s" : ""} both measures — too few to compare.`}
      </p>
    )
  }

  const strength = describeStrength(stats.r)
  const direction = (stats.r ?? 0) > 0 ? "higher" : "lower"

  /*
    The sentence, and the reason the whole ladder works.

    Stated in the KPIs' own words rather than as a coefficient, and stated as *no*
    relationship below r = 0.3 — with fourteen schools, a weak correlation is
    indistinguishable from chance and a phone-sized card is the last place to imply
    otherwise.
  */
  const sentence =
    strength === "none"
      ? `Across ${points.length} schools, ${xKpi.label.toLowerCase()} and ${yKpi.label.toLowerCase()} move independently — spending more is not buying a better result here.`
      : `Across ${points.length} schools, ${strength} relationship: higher ${xKpi.label.toLowerCase()} tracks ${direction} ${yKpi.label.toLowerCase()}.`

  const exceptionSentence =
    stats.exceptions.length > 0
      ? `${stats.exceptions.length === 1 ? "One school breaks" : `${stats.exceptions.length} schools break`} the pattern: ${stats.exceptions
          .map((point) => point.label)
          .join(", ")}.`
      : null

  const missingNote =
    pair.unmeasured.length > 0
      ? `${points.length} of ${points.length + pair.unmeasured.length} schools report both measures.`
      : null

  // ── micro ────────────────────────────────────────────────────────────────────────
  // A sentence and a link. Deliberately no chart in the DOM at all: rendering one and
  // hiding it would still cost the layout, the a11y tree and the paint.
  if (variant === "micro") {
    return (
      <div className="flex h-full flex-col justify-between gap-2">
        <p className="text-sm">{sentence}</p>
        {exceptionSentence ? (
          <p className="text-xs text-muted-foreground">{exceptionSentence}</p>
        ) : null}
        {missingNote ? (
          <p className="text-xs text-muted-foreground">{missingNote}</p>
        ) : null}
      </div>
    )
  }

  // ── compact ──────────────────────────────────────────────────────────────────────
  // Four counts. The scatter's conclusion without the scatter.
  if (variant === "compact" && stats.groups) {
    // Reading order: best first, worst last. A grid ordered by geometry (low-low, then
    // high-low…) puts "needs attention" in the middle of the card, which buries it.
    const ordered: QuadrantKey[] = ["low-high", "high-high", "low-low", "high-low"]
    const open = openQuadrant ? stats.groups[openQuadrant] : null

    const fmt = (kpi: typeof xKpi, value: number) =>
      formatValue(value, {
        format: kpi.format,
        precision: kpi.precision,
        currency: kpi.money ? "USD" : undefined,
        compact: true,
      })

    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <p className="text-xs text-muted-foreground">{sentence}</p>
        <ul className="grid shrink-0 grid-cols-2 gap-1.5">
          {ordered.map((key) => {
            const group = stats.groups![key]
            const favour = favourabilityOf(key, xKpi.direction, yKpi.direction)
            const tint = TINT[favour]
            return (
              // data-count is for the contract test, which asserts the four tiles sum to
              // the population. Reading it from the rendered text would couple the test to
              // the copy; four live regions would announce on every drill.
              <li key={key} data-quadrant={key} data-count={group.length}>
                <button
                  type="button"
                  // A real button, not a tinted div with a click handler: this is the only
                  // way to ask "which schools?" at this width, so it has to be reachable by
                  // keyboard and announce its state.
                  aria-expanded={openQuadrant === key}
                  aria-controls={panelId}
                  disabled={group.length === 0}
                  onClick={() =>
                    setOpenQuadrant((current) =>
                      current === key ? null : key
                    )
                  }
                  // 44px floor: these are read on a phone (PLAN §7).
                  className={cn(
                    "flex min-h-11 w-full flex-col justify-center rounded-md border px-2 py-1 text-left",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    "disabled:cursor-default disabled:opacity-60",
                    openQuadrant === key
                      ? "border-foreground"
                      : "border-border"
                  )}
                  data-matrix-tint={tint ? "" : undefined}
                  style={tint ? { backgroundColor: tint } : undefined}
                >
                  {/*
                    Muted grey on a tint measured 2.54:1 against a 4.5 floor — the tints
                    are calibrated to sit under *foreground* text, not under a colour
                    that is already low-contrast by design. Same rule the matrix cell
                    follows (matrix-navigator.tsx), and it is a switch rather than a
                    tweak so the untinted tiles keep their hierarchy.
                  */}
                  <span className="text-sm font-semibold tabular-nums">
                    {group.length}
                    <span
                      className={cn(
                        "ml-1 text-xs font-normal",
                        tint ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {group.length === 1 ? "school" : "schools"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-[11px] leading-tight",
                      tint ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {quadrantLabel(key, xKpi.label, yKpi.label)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {/*
          The answer to "which ones".

          Named schools with both measures, so the reader gets what the scatter would have
          shown them: not just membership, but where in the group each school sits. Scrolls
          inside itself rather than growing the card, and carries tabIndex because axe
          requires a scrollable region to be keyboard-operable.
        */}
        <div
          id={panelId}
          className="min-h-0 flex-1 overflow-y-auto"
          tabIndex={open ? 0 : undefined}
          role={open ? "group" : undefined}
          aria-label={
            open && openQuadrant
              ? `Schools with ${quadrantLabel(openQuadrant, xKpi.label, yKpi.label).toLowerCase()}`
              : undefined
          }
        >
          {open ? (
            <ul className="flex flex-col gap-0.5 pt-1">
              {[...open]
                .sort((a, b) => b.y - a.y)
                .map((point) => (
                  <li
                    key={point.id}
                    className="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <span className="min-w-0 truncate" title={point.label}>
                      {point.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {fmt(yKpi, point.y)} · {fmt(xKpi, point.x)}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="pt-1 text-[11px] text-muted-foreground">
              Select a group to see which schools are in it.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── standard / expanded ──────────────────────────────────────────────────────────
  /*
    Sized to fit the declared footprint rather than chosen by eye.

    The card is rowSpan 4 — 4×88px of grid rows plus 3×12px of gaps, so 388px. Its padding
    takes ~32, the title and question ~50, and the axis-and-readout row beneath the plot
    ~20. That leaves ~286 for the plot itself, and a 300px expanded chart clipped its own
    caption off the bottom edge. `ROW_CLASS` in the grid stops at 4, so growing the card
    was not the alternative it looked like.
  */
  const height = variant === "expanded" ? 260 : 220

  return (
    <div className="flex h-full min-w-0 flex-col gap-2">
      <QuadrantPlot
        points={points}
        split={stats.split}
        xLabel={xKpi.label}
        yLabel={yKpi.label}
        xFormat={xKpi.format}
        yFormat={yKpi.format}
        xPrecision={xKpi.precision}
        yPrecision={yKpi.precision}
        xCurrency={xKpi.money ? "USD" : undefined}
        yCurrency={yKpi.money ? "USD" : undefined}
        xDirection={xKpi.direction}
        yDirection={yKpi.direction}
        variant={variant}
        height={height}
        plotWidth={width}
        label={`${yKpi.label} against ${xKpi.label}, ${points.length} schools`}
        colourOf={() => seriesVar(0)}
        labelledIds={stats.exceptions.map((point) => point.id)}
        weightLabel={
          pair.weightKpiId ? kpiById(pair.weightKpiId).label : undefined
        }
      />

      {variant === "expanded" && exceptionSentence ? (
        <p className="text-xs text-muted-foreground">{exceptionSentence}</p>
      ) : null}
      {missingNote ? (
        <p className="text-xs text-muted-foreground">{missingNote}</p>
      ) : null}
    </div>
  )
}

/** The non-visual form of the finding — the same conclusion, in words and a table. */
export function quadrantSummary(
  points: readonly { label: string; x: number; y: number }[],
  xLabel: string,
  yLabel: string
): string {
  const r = pearson(points as never)
  const strength = describeStrength(r)
  if (points.length < 3) {
    return `Too few schools report both ${xLabel} and ${yLabel} to compare them.`
  }
  if (strength === "none") {
    return `Across ${points.length} schools, ${xLabel} and ${yLabel} move independently.`
  }
  return `Across ${points.length} schools there is a ${strength} relationship: higher ${xLabel} tracks ${
    (r ?? 0) > 0 ? "higher" : "lower"
  } ${yLabel}.`
}
