import type { ElementType, ReactNode } from "react"

/**
 * Present to assistive technology, absent from the page.
 *
 * Not `display: none` and not `visibility: hidden` — both remove the content from the
 * accessibility tree, which is the opposite of what is wanted. This is the standard
 * clip-rect technique, kept in one place so it cannot drift.
 */
export function VisuallyHidden({
  children,
  as: Component = "span",
}: {
  children: ReactNode
  as?: ElementType
}) {
  return (
    <Component className="absolute h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap [clip-path:inset(50%)] [clip:rect(0_0_0_0)]">
      {children}
    </Component>
  )
}
