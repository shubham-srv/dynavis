"use client"

import { useMemo } from "react"

import {
  ContainerSizeProvider,
  useContainerWidth,
} from "@/components/dashboard/container-size"
import { MatrixNavigator } from "@/components/scope/matrix-navigator"
import type { MatrixEnvelope } from "@/lib/matrix/build"
import { resolveVariant, type Variant } from "@/lib/viz/variants"

const SUPPORTED: readonly Variant[] = [
  "micro",
  "compact",
  "standard",
  "expanded",
]

/**
 * Measures its own box and hands the matrix a variant.
 *
 * `hrefFor` is built here rather than passed in, because a function cannot cross the
 * server/client boundary — the server sends plain strings and this side assembles the
 * links.
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
  return (
    <ContainerSizeProvider className="min-w-0">
      <MatrixBody matrix={matrix} scopeIds={scopeIds} roleParam={roleParam} />
    </ContainerSizeProvider>
  )
}

function MatrixBody({
  matrix,
  scopeIds,
  roleParam,
}: {
  matrix: MatrixEnvelope
  scopeIds: readonly string[]
  roleParam?: string
}) {
  const { width, measured } = useContainerWidth()
  const variant = resolveVariant(width, SUPPORTED)

  const hrefFor = useMemo(() => {
    const suffix = roleParam ? `?role=${encodeURIComponent(roleParam)}` : ""
    return (rowId: string) =>
      `/dashboard/${[...scopeIds, rowId].join("/")}${suffix}`
  }, [scopeIds, roleParam])

  // Before the first measurement the width is 0, which would render the micro variant
  // for a frame on desktop. A skeleton of the right height is less jarring and keeps
  // CLS flat (PLAN §15).
  if (!measured) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" aria-hidden />
  }

  return (
    <MatrixNavigator matrix={matrix} variant={variant} hrefFor={hrefFor} />
  )
}
