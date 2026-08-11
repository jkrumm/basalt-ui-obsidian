/**
 * Bookmarks browse route — `VaultBookmarksPanel` behind `BrowsePage`. See `routes/index.tsx`'s module
 * doc for the mobile-tab / desktop-panel duality this and every other browse route share.
 *
 * `onOpenSearch` is wired here too (not just in the desktop sidebar, `../components/sidebar-panels.tsx`)
 * so a saved Obsidian *search* bookmark works the same way when browsing bookmarks as a full mobile
 * page — it navigates to `/search?q=…`, the same destination the sidebar's own wiring uses.
 */
import { createFileRoute } from '@tanstack/react-router'
import { VaultBookmarksPanel } from 'basalt-ui-obsidian'
import { BrowsePage } from '../components/browse-page'
import { useNavigateToSearch } from '../lib/navigate-to-search'

function BookmarksPage() {
  const onOpenSearch = useNavigateToSearch()

  return (
    <BrowsePage title="Bookmarks">
      <VaultBookmarksPanel onOpenSearch={onOpenSearch} />
    </BrowsePage>
  )
}

export const Route = createFileRoute('/bookmarks')({ component: BookmarksPage })
