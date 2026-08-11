/**
 * Tags browse route — `VaultTagsPanel` behind `BrowsePage`. See `routes/index.tsx`'s module doc for
 * the mobile-tab / desktop-panel duality this and every other browse route share.
 */
import { createFileRoute } from '@tanstack/react-router'
import { VaultTagsPanel } from 'basalt-ui-obsidian'
import { BrowsePage } from '../components/browse-page'

function TagsPage() {
  return (
    <BrowsePage title="Tags">
      <VaultTagsPanel />
    </BrowsePage>
  )
}

export const Route = createFileRoute('/tags')({ component: TagsPage })
