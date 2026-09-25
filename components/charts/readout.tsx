"use client"

import { cn } from "@/lib/utils"

/**
 * The value readout that replaces a hover tooltip.
 *
 * Hover does not exist on touch, and a floating tooltip covers the data it describes.
 * A persistent strip is better on a phone *and* is the same component a keyboard user
 * drives — two requirements, one component (PLAN §7).
 *
 * It is a live region, so moving through a chart with the keyboard announces the value
 * instead of silently repainting.
 */
export function ChartReadout({
  label,
  value,
  secondary,
  className,
}: {
  label: string | null
  value: string | null
  secondary?: string | null
  className?: string
}) {
  const idle = label === null || value === null

  return (
    <p
      aria-live="polite"
      className={cn(
        "flex min-h-6 items-baseline gap-2 text-xs tabular-nums",
        className
      )}
    >
      {idle ? (
        <span className="text-muted-foreground">
          Select a point to see its value
        </span>
      ) : (
        <>
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-foreground">{value}</span>
          {secondary ? (
            <span className="text-muted-foreground">{secondary}</span>
          ) : null}
        </>
      )}
    </p>
  )
}
