"use client"

import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  TriangleAlert,
  X,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { VisuallyHidden } from "@/components/a11y/visually-hidden"
import { DataTableView } from "@/components/dashboard/data-table"
import type { DataTable } from "@/lib/a11y/table"
import { cn } from "@/lib/utils"

/**
 * The frame every widget renders inside.
 *
 * Carries the things that must be identical across every widget, because "mostly
 * consistent" is how accessibility regressions get in:
 *
 *   - the heading, and the *question* the widget answers (PLAN §1.1)
 *   - keyboard-first reordering — buttons, not drag handles (WCAG 2.5.7, PLAN §10)
 *   - loading / empty / error states, which the client will click into
 *   - the hidden data table and one-sentence summary that make charts readable to a
 *     screen reader (PLAN §5.3, D8)
 */

export type WidgetState = "ready" | "loading" | "error" | "empty"

export interface WidgetShellProps {
  title: string
  question?: string
  state?: WidgetState
  errorMessage?: string
  onRetry?: () => void

  /** Reorder controls. Always in the DOM when provided — never drag-only. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove?: () => void
  /** Full-view link. A link, not a button, so middle-click and new-tab work. */
  focusHref?: string
  /** DOM id, so returning from the full view can move focus back here (PLAN §6.5). */
  domId?: string
  position?: { index: number; total: number }

  /** Accessible equivalents of whatever the body draws. */
  summary?: string
  table?: DataTable

  footnote?: ReactNode
  className?: string
  children?: ReactNode
}

export function WidgetShell({
  title,
  question,
  state = "ready",
  errorMessage,
  onRetry,
  onMoveUp,
  onMoveDown,
  onRemove,
  focusHref,
  domId,
  position,
  summary,
  table,
  footnote,
  className,
  children,
}: WidgetShellProps) {
  const positionLabel = position
    ? `${position.index + 1} of ${position.total}`
    : undefined

  return (
    <section
      id={domId}
      // Focusable only as a fragment target: returning from the full view lands the
      // keyboard here rather than at the top of the document.
      tabIndex={domId ? -1 : undefined}
      aria-label={title}
      className={cn(
        // `relative` is load-bearing, not cosmetic: VisuallyHidden uses position:absolute,
        // and without a positioned ancestor its containing block escapes to the root,
        // where it extends documentElement.scrollWidth and gives the *page* a horizontal
        // scrollbar from content that is supposed to be invisible.
        "relative flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground",
        className
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium" title={title}>
            {title}
          </h3>
          {question ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {question}
            </p>
          ) : null}
          {positionLabel ? (
            <VisuallyHidden>Position {positionLabel}</VisuallyHidden>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {/*
            44px targets. These are the primary reordering mechanism, not a fallback:
            drag-and-drop alone fails WCAG 2.5.7 and is unusable on a phone.
          */}
          {onMoveUp ? (
            <IconButton
              label={`Move ${title} up${positionLabel ? `, currently ${positionLabel}` : ""}`}
              onClick={onMoveUp}
            >
              <ChevronUp aria-hidden className="size-4" />
            </IconButton>
          ) : null}
          {onMoveDown ? (
            <IconButton
              label={`Move ${title} down${positionLabel ? `, currently ${positionLabel}` : ""}`}
              onClick={onMoveDown}
            >
              <ChevronDown aria-hidden className="size-4" />
            </IconButton>
          ) : null}
          {focusHref ? (
            <Link
              href={focusHref}
              aria-label={`Open ${title} in full view`}
              className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Maximize2 aria-hidden className="size-4" />
            </Link>
          ) : null}
          {onRemove ? (
            <IconButton
              label={`Remove ${title} from dashboard`}
              onClick={onRemove}
            >
              <X aria-hidden className="size-4" />
            </IconButton>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {state === "loading" ? <WidgetSkeleton title={title} /> : null}
        {state === "error" ? (
          <WidgetError message={errorMessage} onRetry={onRetry} />
        ) : null}
        {state === "empty" ? <WidgetEmpty /> : null}
        {state === "ready" ? (
          <>
            {/*
              The chart is decorative to assistive tech; the summary and table below
              carry the same information in a form a screen reader can actually use.
            */}
            {summary ? <VisuallyHidden>{summary}</VisuallyHidden> : null}
            {children}
            {table ? (
              <VisuallyHidden as="div">
                <DataTableView table={table} />
              </VisuallyHidden>
            ) : null}
          </>
        ) : null}
      </div>

      {footnote ? (
        <footer className="text-xs text-muted-foreground">{footnote}</footer>
      ) : null}
    </section>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
    </button>
  )
}

function WidgetSkeleton({ title }: { title: string }) {
  return (
    // Sized like the content it replaces, so nothing shifts when data lands (CLS, §15).
    <div
      className="flex h-full min-h-24 flex-col justify-end gap-2"
      aria-hidden
    >
      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      <VisuallyHidden>Loading {title}</VisuallyHidden>
    </div>
  )
}

function WidgetError({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex h-full min-h-24 flex-col items-start justify-center gap-2 text-sm"
    >
      <p className="flex items-center gap-2 text-muted-foreground">
        <TriangleAlert
          aria-hidden
          className="size-4 shrink-0 text-destructive"
        />
        {message ?? "This data could not be loaded."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}

function WidgetEmpty() {
  return (
    <p className="flex h-full min-h-24 items-center text-sm text-muted-foreground">
      {/* "Not measured" is a different claim from "zero" and must read as one. */}
      No data recorded for this period.
    </p>
  )
}
