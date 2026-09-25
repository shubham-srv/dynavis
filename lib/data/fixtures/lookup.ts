import type { ScopeLookup } from "@/lib/scope/resolve";

import { findNode, ORG } from "./org";

/**
 * The fixture-backed `ScopeLookup`.
 *
 * This is the only place the scope layer touches fixture data. Swapping it for an HTTP
 * client against the .NET `/scope` endpoint is the whole migration (PLAN D10, §16).
 */
export const fixtureLookup: ScopeLookup = {
  rootId: ORG.id,

  childrenOf(id) {
    const node = findNode(id);
    if (!node) return null;
    return node.children.map((child) => ({
      id: child.id,
      label: child.label,
      canDrill: child.children.length > 0,
    }));
  },

  labelOf(id) {
    return findNode(id)?.label ?? null;
  },

  levelOf(id) {
    return findNode(id)?.level ?? null;
  },

  childLevelOf(id) {
    return findNode(id)?.children[0]?.level ?? null;
  },
};
