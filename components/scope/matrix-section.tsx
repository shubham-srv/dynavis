"use client"

import { MatrixNavigator } from "@/components/scope/matrix-navigator"
import type { MatrixEnvelope } from "@/lib/matrix/build"

/**
 * Picks the matrix's form with CSS rather than measurement.
 *
 * All three forms are rendered and CSS shows exactly one. That looks wasteful and is the
 * right trade: measuring first means painting a placeholder and then swapping it, which
 * cost 0.1238 CLS against a 0.05 budget. `display: none` also removes a subtree from the
 * accessibility tree, so a screen reader sees one matrix, not three.
 *
 * Affordable only because rows are always one level's children — at most a handful
 * (PLAN D15). If a level ever held hundreds of rows this would need revisiting, and so
 * would virtualisation.
 *
 * `hrefFor` is built here because a function cannot cross the server/client boundary:
 * the server sends plain strings and this side assembles the links.
 */
export function MatrixSection({
  matrix,
  scopeIds,
  roleParam,
}: {
  matrix: MatrixEnvelope
  scopeIds: readonly string[]
  roleParam?: string
}) {
  const suffix = roleParam ? `?role=${encodeURIComponent(roleParam)}` : ""
  const hrefFor = (rowId: string) =>
    `/dashboard/${[...scopeIds, rowId].join("/")}${suffix}`

  return (
    <div className="min-w-0">
      <div className="md:hidden">
        <MatrixNavigator matrix={matrix} variant="compact" hrefFor={hrefFor} />
      </div>
      <div className="hidden md:block xl:hidden">
        <MatrixNavigator matrix={matrix} variant="standard" hrefFor={hrefFor} />
      </div>
      <div className="hidden xl:block">
        <MatrixNavigator matrix={matrix} variant="expanded" hrefFor={hrefFor} />
      </div>
    </div>
  )
}
