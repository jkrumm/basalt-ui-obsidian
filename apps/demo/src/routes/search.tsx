/**
 * Search browse route — `VaultSearchPanel` behind `BrowsePage`, `autoFocus`ed since a search page's
 * whole reason for existing is to type into it immediately. See `routes/index.tsx`'s module doc for
 * the mobile-tab / desktop-panel duality this and every other browse route share.
 *
 * The `q` search param seeds `VaultSearchPanel`'s `initialQuery` — this is what makes a saved
 * Obsidian *search* bookmark work: `VaultBookmarksPanel`'s `onOpenSearch(query)` (wired in
 * `../components/sidebar-panels.tsx` and `routes/bookmarks.tsx`) navigates here with `search: { q }`.
 */
import { createFileRoute } from '@tanstack/react-router'
import { VaultSearchPanel } from 'basalt-ui-obsidian'
import { BrowsePage } from '../components/browse-page'
import { useSearchIndexQuery } from '../lib/vault-data'

type SearchPageSearch = {
  readonly q?: string
}

function SearchPage() {
  const { q } = Route.useSearch()
  // The build-time MiniSearch index — see `../lib/vault-search-spotlight.tsx`'s own doc for why this
  // is fetched rather than rebuilt in the browser. Passed only once loaded: `VaultSearchPanel`/
  // `useVaultSearch` build their own fallback index from the vault when `searchIndex` is omitted, so
  // there's nothing to gate rendering on while this query is still in flight.
  const { data: searchIndex } = useSearchIndexQuery()

  return (
    <BrowsePage title="Search">
      <VaultSearchPanel
        autoFocus
        {...(q !== undefined && { initialQuery: q })}
        {...(searchIndex !== undefined && { searchIndex })}
      />
    </BrowsePage>
  )
}

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>): SearchPageSearch => {
    const q = search['q']
    return typeof q === 'string' ? { q } : {}
  },
  component: SearchPage,
})
