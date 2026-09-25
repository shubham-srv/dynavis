import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { type Crumb, collapseTrail } from "@/lib/scope/breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * The scope trail.
 *
 * Each crumb is a *dropdown*, not just a link: from "UAE" you can jump sideways to
 * Egypt without going back up, which is what people actually do when working through an
 * underperforming region (PLAN §6.3).
 *
 * The disclosure is a native `<details>`. It is keyboard-operable, works with no
 * JavaScript, and needs no focus-trap of its own — worth more here than the animation a
 * custom menu would buy.
 */
export function Breadcrumbs({
  crumbs,
  className,
  maxVisible = 3,
}: {
  crumbs: readonly Crumb[];
  className?: string;
  maxVisible?: number;
}) {
  const { head, elided, tail } = collapseTrail(crumbs, maxVisible);

  return (
    <nav aria-label="Scope" className={cn("min-w-0", className)}>
      <ol className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-sm">
        {head ? (
          <>
            <CrumbItem crumb={head} />
            <Separator />
            {/* Elided, not dropped: the middle stays reachable behind the ellipsis. */}
            <li className="flex items-center">
              <details className="relative">
                <summary
                  aria-label={`Show ${elided.length} hidden levels`}
                  className="hover:text-foreground focus-visible:ring-ring inline-flex h-11 cursor-pointer list-none items-center rounded-md px-2 focus-visible:ring-2 focus-visible:outline-none"
                >
                  …
                </summary>
                <SiblingList
                  items={elided.map((crumb) => ({
                    id: crumb.id,
                    label: crumb.label,
                    href: crumb.href,
                    isCurrent: false,
                  }))}
                />
              </details>
            </li>
            <Separator />
          </>
        ) : null}

        {tail.map((crumb, index) => (
          <CrumbItem key={crumb.id} crumb={crumb} withSeparator={index > 0} />
        ))}
      </ol>
    </nav>
  );
}

function CrumbItem({ crumb, withSeparator = false }: { crumb: Crumb; withSeparator?: boolean }) {
  const label = (
    <span className={cn("max-w-[14rem] truncate", crumb.isCurrent && "text-foreground font-medium")}>
      {crumb.label}
    </span>
  );

  return (
    <>
      {withSeparator ? <Separator /> : null}
      <li className="flex min-w-0 items-center">
        {crumb.isCurrent ? (
          // Current location is not a link — WCAG 2.4.8, and a link to here is a lie.
          <span aria-current="page" className="inline-flex h-11 items-center px-1">
            {label}
          </span>
        ) : (
          <Link
            href={crumb.href}
            className="hover:text-foreground focus-visible:ring-ring inline-flex h-11 items-center rounded-md px-1 focus-visible:ring-2 focus-visible:outline-none"
          >
            {label}
          </Link>
        )}

        {crumb.siblings.length > 1 ? (
          <details className="relative">
            <summary
              aria-label={`Switch from ${crumb.label} to another ${crumb.level}`}
              className="hover:text-foreground focus-visible:ring-ring inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
            >
              <ChevronRight aria-hidden className="size-3 rotate-90" />
            </summary>
            <SiblingList items={crumb.siblings} />
          </details>
        ) : null}
      </li>
    </>
  );
}

function SiblingList({
  items,
}: {
  items: readonly { id: string; label: string; href: string; isCurrent: boolean }[];
}) {
  return (
    <ul className="bg-popover text-popover-foreground border-border absolute top-full left-0 z-20 mt-1 max-h-72 min-w-56 overflow-auto rounded-lg border p-1 shadow-md">
      {items.map((item) => (
        <li key={item.id}>
          {/*
            Deliberately no `aria-current="page"` here. The crumb itself already carries
            it, and two elements in one nav both claiming to be the current page is
            worse than none — this list offers alternatives, so the current entry is
            marked with a word instead.
          */}
          <Link
            href={item.href}
            className={cn(
              "hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex min-h-11 items-center rounded-md px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
              item.isCurrent && "text-foreground font-medium",
            )}
          >
            {item.label}
            {item.isCurrent ? <span className="sr-only"> (current)</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Separator() {
  return (
    <li aria-hidden className="text-muted-foreground/60 select-none">
      ›
    </li>
  );
}
