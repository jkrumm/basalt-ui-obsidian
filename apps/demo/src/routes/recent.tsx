/**
 * Recent browse route — `VaultRecentPanel` behind `BrowsePage`. See `routes/index.tsx`'s module doc
 * for the mobile-tab / desktop-panel duality this and every other browse route share.
 */
import { createFileRoute } from '@tanstack/react-router'
import { VaultRecentPanel } from 'basalt-ui-obsidian'
import { BrowsePage } from '../components/browse-page'

function RecentPage() {
  return (
    <BrowsePage title="Recent">
      <VaultRecentPanel />
    </BrowsePage>
  )
}

export const Route = createFileRoute('/recent')({ component: RecentPage })
