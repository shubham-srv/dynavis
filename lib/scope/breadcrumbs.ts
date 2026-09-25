import { scopeHref } from "./path";
import type { ScopeLookup } from "./resolve";
import type { ScopeRef } from "./types";

/**
 * The breadcrumb trail.
 *
 * Built straight from the `ScopeRef` — the array *is* the trail, so there is no second
 * piece of state to fall out of sync (PLAN §6.3).
 *
 * Each crumb carries its siblings, because a crumb here is a dropdown rather than a
 * plain link: from "UAE" you can jump sideways to Egypt without going back up. That is
 * the actual behaviour when someone is working through an underperforming region, and
 * it removes most of the need for a separate scope switcher.
 */

export interface CrumbSibling {
  id: string;
  label: string;
  href: string;
  isCurrent: boolean;
}

export interface Crumb {
  level: string;
  id: string;
  label: string;
  href: string;
  isCurrent: boolean;
  siblings: readonly CrumbSibling[];
}

export function buildBreadcrumbs(
  scope: ScopeRef,
  lookup: ScopeLookup,
  basePath = "/dashboard",
): Crumb[] {
  return scope.map((step, index) => {
    const trail = scope.slice(0, index + 1);
    // The root has no siblings; every other crumb's siblings are its parent's children.
    const parent = index === 0 ? null : scope[index - 1];
    const siblings = parent
      ? (lookup.childrenOf(parent.id) ?? []).map((child) => {
          // Jumping sideways replaces this crumb and drops everything below it. The
          // root is sliced off here for the same reason it is below: it is implied by
          // the base path and must not appear as a segment.
          const siblingTrail = [...scope.slice(0, index), { ...step, id: child.id, label: child.label }];
          return {
            id: child.id,
            label: child.label,
            href: scopeHref(siblingTrail.slice(1), basePath),
            isCurrent: child.id === step.id,
          };
        })
      : [];

    return {
      level: step.level,
      id: step.id,
      label: step.label,
      // The root crumb's href drops all scope segments, which is the "home" link.
      href: scopeHref(trail.slice(1), basePath),
      isCurrent: index === scope.length - 1,
      siblings,
    };
  });
}

/**
 * What to announce when the scope changes.
 *
 * Drilling is a navigation with no page reload and no focus change a screen reader would
 * otherwise notice, so it has to be said out loud (WCAG 4.1.3, PLAN §13).
 */
export function scopeAnnouncement(scope: ScopeRef, widgetCount: number): string {
  const current = scope.at(-1);
  if (!current) return "";
  const widgets = `${widgetCount} ${widgetCount === 1 ? "widget" : "widgets"}`;
  return `Now viewing ${current.label}. ${widgets}.`;
}

/**
 * Collapse the middle of a long trail for narrow screens, keeping the root and the last
 * `tailLength` crumbs. The elided crumbs are returned so the UI can put them behind an
 * ellipsis rather than dropping them (PLAN §6.3).
 */
export function collapseTrail(
  crumbs: readonly Crumb[],
  maxVisible = 3,
): { head: Crumb | null; elided: Crumb[]; tail: Crumb[] } {
  if (crumbs.length <= maxVisible) return { head: null, elided: [], tail: [...crumbs] };
  const tailLength = maxVisible - 1;
  return {
    head: crumbs[0],
    elided: crumbs.slice(1, crumbs.length - tailLength),
    tail: crumbs.slice(crumbs.length - tailLength),
  };
}
