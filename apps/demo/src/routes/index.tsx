/**
 * Vault index route — splits by size class rather than rendering the same panel everywhere, because
 * the desktop sidebar (`../components/sidebar-panels.tsx`) already carries the note tree PERMANENTLY
 * beside the content column. Rendering `VaultTreePanel` here too on desktop showed the identical tree
 * twice — narrow in the sidebar, wide in the content column. At `compact` there is no sidebar (the
 * phone's tab bar is the only nav), so the tree stays here unchanged — it's the whole "Tree" tab
 * reached from the bottom bar. Above `compact`, the content column's job is to be a landing surface
 * instead, and most-recently-edited notes is the one view that earns that slot the desktop sidebar
 * doesn't already own.
 */
import { createFileRoute } from '@tanstack/react-router'
import { useSizeClass } from 'basalt-ui'
import { VaultRecentPanel, VaultTreePanel } from 'basalt-ui-obsidian'
import { BrowsePage } from '../components/browse-page'

function IndexPage() {
  return useSizeClass() === 'compact' ? (
    <BrowsePage title="Vault">
      <VaultTreePanel />
    </BrowsePage>
  ) : (
    <BrowsePage title="Recently updated">
      <VaultRecentPanel />
    </BrowsePage>
  )
}

export const Route = createFileRoute('/')({ component: IndexPage })
