/**
 * `useNavigateToSearch` — shared `onOpenSearch` handler for `VaultBookmarksPanel`: a `search`-type
 * bookmark navigates to the full `/search?q=…` page rather than rendering inline, since the query
 * needs a shareable, back-button-friendly URL more than it needs to stay wherever the bookmark was
 * opened from. Previously hand-duplicated in `components/sidebar-panels.tsx` and
 * `routes/bookmarks.tsx`.
 */
import { useNavigate } from '@tanstack/react-router'

export function useNavigateToSearch(): (query: string) => void {
  const navigate = useNavigate()
  return (query: string): void => {
    void navigate({ to: '/search', search: { q: query } })
  }
}
