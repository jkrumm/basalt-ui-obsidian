/**
 * `BROWSE_SURFACES` — the five vault browse panels (Tree/Search/Tags/Bookmarks/Recent), in
 * tab-bar/tab-strip order. Single source of truth for `routes/__root.tsx`'s mobile bottom tab bar
 * and `components/sidebar-panels.tsx`'s desktop sidebar strip — both used to hand-duplicate this
 * same list of labels, icons and order with nothing enforcing agreement between them. Each consumer
 * still derives its OWN shape from `key` (a router `<Link>` href vs. a `useState` switch value)
 * rather than sharing a data structure neither can fully express.
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
