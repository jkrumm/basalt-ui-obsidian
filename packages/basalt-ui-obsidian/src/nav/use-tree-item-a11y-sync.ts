/**
 * `useTreeItemA11ySync` — the imperative half of `VaultNav`'s Mantine `Tree` adoption. Patches THREE
 * a11y gaps in Mantine 9.3.2's non-virtualized `<li role="treeitem">` that `VaultNav` cannot close
 * declaratively, because `renderNode`'s `elementProps` is spread onto the content it returns, INSIDE
 * the `<li>`, never the `<li>` itself — see `vault-nav.tsx`'s module doc for the full rationale on
 * each of the three:
 *
 * 1. `aria-expanded` is entirely absent (only the virtualized `FlatTreeNode` path sets it) — added
 *    here for every folder with visible children, removed for anything else.
 * 2. The built-in roving tabindex is STATIC (`rootIndex === 0 ? 0 : -1`), never follows focus — this
 *    recomputes it every time the tree could plausibly have reshuffled, preferring the last node the
 *    user moved keyboard focus to, else the row matching `activePath`, else the first visible row.
 *    `focusedPath` is validated against the LIVE `<li>`s first: if the user had focus on a node whose
 *    `<li>` no longer exists (its ancestor was just collapsed, e.g. by a mouse click on the chevron —
 *    that unmounts the focused element without ever firing a NEW focus event, so `focusedPath` alone
 *    would go stale and this function would then match NOTHING, handing every `<li>` `tabIndex={-1}`
 *    and taking the whole tree out of the Tab order — a real regression, reproduced live, worse than
 *    the static tabindex this hook exists to fix).
 * 3. Mantine's `<li>` carries neither `aria-label` nor `aria-labelledby`, so its accessible name falls
 *    back to "name from content" — which, in a REAL nested tree, recurses into every descendant `<li>`
 *    too (a folder's computed name became its own label plus every visible descendant's, e.g. "Wild
 *    Rift Runes"). `labelIdByPath` (built once alongside the tree data, see `vault-nav.tsx`) gives
 *    every row a collision-safe id; this stamps the matching `aria-labelledby` on its `<li>`.
 *
 * Also neutralizes every anchor's native `tabIndex` (`renderLink` hands back a consumer-owned
 * element this file cannot set props on directly) — left alone, ~26 anchors would each be their own
 * tab stop and defeat the roving tabindex outright.
 *
 * The effect DOES carry a real dependency array, not "run after every commit": Mantine only
 * mounts/unmounts `<li>`/`<a>` elements when `expandedState` or `data` change — and both are fully
 * reflected here, `expandedState` via `expandedSet` and `data` via `hasChildrenByPath`/
 * `labelIdByPath` (both rebuilt, with a new reference, in the SAME `useMemo` as `data` itself, keyed
 * on the same `index.tree` — see `vault-nav.tsx`). `focusedPath`/`selectedValue` changing doesn't
 * add or remove any `<li>`, but does change what THIS effect computes (`aria-expanded` reads
 * `expandedSet`, not these two — only the tabIndex preference does), so both still belong in the
 * list. The one known gap: a consumer swapping `renderLink`'s return type mid-lifecycle (an anchor-
 * returning implementation becoming a non-anchor one, or vice versa) without any of the tracked
 * values changing would leave a stale set of neutralized anchors. `VaultLinkRenderer`'s own contract
 * ("renders an internal link") already assumes a stable shape, so this isn't chased further here.
 */
import { useEffect } from 'react'
import type { RefObject } from 'react'

export type UseTreeItemA11ySyncOptions = {
  readonly rootRef: RefObject<HTMLUListElement | null>
  readonly hasChildrenByPath: ReadonlyMap<string, boolean>
  readonly expandedSet: ReadonlySet<string>
  readonly focusedPath: string | undefined
  readonly selectedValue: string | undefined
  readonly labelIdByPath: ReadonlyMap<string, string>
}

export function useTreeItemA11ySync({
  rootRef,
  hasChildrenByPath,
  expandedSet,
  focusedPath,
  selectedValue,
  labelIdByPath,
}: UseTreeItemA11ySyncOptions): void {
  useEffect(() => {
    const root = rootRef.current
    if (root === null) return

    const items = Array.from(root.querySelectorAll<HTMLElement>('[role="treeitem"]'))
    // `focusedPath` is only trustworthy if its `<li>` is still actually rendered — see the module
    // doc's patch-2 paragraph for the regression this guards against.
    const focusedStillLive =
      focusedPath !== undefined && items.some((item) => item.dataset['value'] === focusedPath)
    const preferredPath =
      (focusedStillLive ? focusedPath : undefined) ?? selectedValue ?? items[0]?.dataset['value']

    for (const item of items) {
      const path = item.dataset['value']
      if (path === undefined) continue
      if (hasChildrenByPath.get(path) === true) {
        item.setAttribute('aria-expanded', expandedSet.has(path) ? 'true' : 'false')
      } else {
        item.removeAttribute('aria-expanded')
      }
      item.tabIndex = path === preferredPath ? 0 : -1
      const labelId = labelIdByPath.get(path)
      if (labelId !== undefined) item.setAttribute('aria-labelledby', labelId)
    }

    for (const anchor of root.querySelectorAll('a')) anchor.tabIndex = -1
  }, [rootRef, hasChildrenByPath, expandedSet, focusedPath, selectedValue, labelIdByPath])
}
