/**
 * `BROWSE_SURFACES` — the five vault browse panels (Tree/Search/Tags/Bookmarks/Recent), in
 * tab-strip order. It backs `components/sidebar-panels.tsx`'s desktop strip, whose tabs switch a
 * LOCAL panel rather than navigating.
 *
 * The routed counterpart is `./nav.tsx`'s `defineNav` definition, which basalt-ui's shell renders as
 * both the sidebar nav section and the mobile bottom bar. The two are deliberately NOT one data
 * structure: `defineNav` needs literal `to` values for TanStack's compile-time route validation, and
 * this one needs a `useState` switch value — the same five names, two shapes neither can express for
 * the other.
 */
import type { LucideIcon } from 'lucide-react'
import { Bookmark, Clock, ListTree, Search, Tags } from 'lucide-react'

export type BrowseSurfaceKey = 'tree' | 'search' | 'tags' | 'bookmarks' | 'recent'

export const BROWSE_SURFACES: readonly {
  readonly key: BrowseSurfaceKey
  readonly label: string
  readonly Icon: LucideIcon
}[] = [
  { key: 'tree', label: 'Tree', Icon: ListTree },
  { key: 'search', label: 'Search', Icon: Search },
  { key: 'tags', label: 'Tags', Icon: Tags },
  { key: 'bookmarks', label: 'Bookmarks', Icon: Bookmark },
  { key: 'recent', label: 'Recent', Icon: Clock },
]
