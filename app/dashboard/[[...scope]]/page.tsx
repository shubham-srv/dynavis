import { ChevronRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/scope/breadcrumbs"
import { fixtureLookup } from "@/lib/data/fixtures/lookup"
import { buildBreadcrumbs, scopeAnnouncement } from "@/lib/scope/breadcrumbs"
import { levelByKey } from "@/lib/scope/levels"
import { parseScopeSegments, scopeHref } from "@/lib/scope/path"
import { describeScope, resolveScope } from "@/lib/scope/resolve"
import {
  canDrillFrom,
  DEFAULT_ROLE_ID,
  isAuthorisedScope,
  type Role,
  ROLES,
  roleById,
} from "@/lib/scope/roles"

/**
 * The dashboard, at a scope.
 *
 * Scope comes from the optional catch-all segment, so `/dashboard`, `/dashboard/emea`
 * and `/dashboard/emea/uae/dubai/sch-dxb-01` are all this one route (PLAN D14). That is
 * what makes every view deep-linkable, the back button correct for free, and every drill
 * flow testable by navigating to a URL.
 *
 * Role comes from a query parameter *for the demo only*. In the real product it comes
 * from the session and the server re-checks every request — a scope in a URL is a
 * request, not a grant (PLAN §1.4).
 */

type PageProps = {
  params: Promise<{ scope?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function resolveRole(raw: string | string[] | undefined): Role {
  const id = Array.isArray(raw) ? raw[0] : raw
  try {
    return roleById(id ?? DEFAULT_ROLE_ID)
  } catch {
    // An unknown ?role= is a bad demo link, not a missing page.
    return roleById(DEFAULT_ROLE_ID)
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { scope } = await params
  const ids = parseScopeSegments(scope)
  const resolved = ids && resolveScope(ids, fixtureLookup)
  return { title: resolved?.at(-1)?.label ?? "Dashboard" }
}

export default async function DashboardPage({
  params,
  searchParams,
}: PageProps) {
  const { scope } = await params
  const query = await searchParams

  // A malformed URL is a 404, never a crash and never a dashboard silently scoped
  // somewhere else (PLAN §6.4).
  const ids = parseScopeSegments(scope)
  if (ids === null) notFound()

  const resolved = resolveScope(ids, fixtureLookup)
  if (!resolved) notFound()

  const role = resolveRole(query.role)
  if (!isAuthorisedScope(role, ids, fixtureLookup)) {
    return <AccessDenied role={role} />
  }

  const node = describeScope(
    resolved,
    fixtureLookup,
    canDrillFrom(role, resolved.at(-1)!.level)
  )
  const crumbs = buildBreadcrumbs(resolved, fixtureLookup)
  const current = resolved.at(-1)!
  const childLevel = node.childLevel ? levelByKey(node.childLevel) : null

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs crumbs={crumbs} />

      {/*
        Drilling changes the view without a reload and without moving focus, so it has
        to be said out loud (WCAG 4.1.3, PLAN §13).
      */}
      <p aria-live="polite" className="sr-only">
        {scopeAnnouncement(resolved, 0)}
      </p>

      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {levelByKey(current.level).label}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {current.label}
        </h1>
      </header>

      {childLevel ? (
        <section
          aria-labelledby="children-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="children-heading" className="text-sm font-medium">
            {childLevel.pluralLabel}
            <span className="ml-2 font-normal text-muted-foreground">
              {node.children.length}
            </span>
          </h2>

          {/*
            A placeholder for the matrix navigator (PLAN §8). It already does the one
            thing that matters — rows are the children of the current scope, and a row
            click drills — so scope navigation is exercised end to end before the matrix
            lands in Phase 4.
          */}
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {node.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`${scopeHref([...resolved.slice(1), { level: node.childLevel!, id: child.id, label: child.label }])}${
                    query.role
                      ? `?role=${encodeURIComponent(String(query.role))}`
                      : ""
                  }`}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="truncate">{child.label}</span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          This is a {levelByKey(current.level).label.toLowerCase()} — the
          deepest level available here.
        </p>
      )}

      <RoleSwitcher current={role} scopeIds={ids} />
    </div>
  )
}

function AccessDenied({ role }: { role: Role }) {
  return (
    <div className="flex max-w-prose flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        You don&apos;t have access to this view
      </h1>
      <p className="text-sm text-muted-foreground">
        The <strong className="text-foreground">{role.label}</strong> role
        cannot see this part of the organisation. In the real product this check
        also runs on the server, which returns 403 — the scope in a URL is a
        request, not a grant.
      </p>
      <Link
        href={`/dashboard?role=${role.id}`}
        className="self-start rounded-md underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Go to your dashboard
      </Link>
    </div>
  )
}

/** Demo-only. Real roles come from the session. */
function RoleSwitcher({
  current,
  scopeIds,
}: {
  current: Role
  scopeIds: readonly string[]
}) {
  return (
    <section
      aria-labelledby="role-heading"
      className="mt-4 border-t border-border pt-4"
    >
      <h2
        id="role-heading"
        className="text-xs tracking-wide text-muted-foreground uppercase"
      >
        Demo: view as
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {ROLES.map((role) => (
          <li key={role.id}>
            <Link
              href={`${scopeHref(scopeIds.map((id) => ({ level: "", id, label: "" })))}?role=${role.id}`}
              aria-current={role.id === current.id ? "true" : undefined}
              className={
                role.id === current.id
                  ? "inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  : "inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              }
            >
              {role.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
