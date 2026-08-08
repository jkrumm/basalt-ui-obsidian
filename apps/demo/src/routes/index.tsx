/**
 * Vault index route — an orientation landing page. Note content itself lives at the `/$` splat
 * route; this page just points at the tree and the search shortcut.
 */
import { createFileRoute } from '@tanstack/react-router'
import { EmptyState } from 'basalt-ui'
import { useVault } from 'basalt-ui-obsidian'

function IndexPage() {
  const { index } = useVault()
  return (
    <EmptyState
      title="Brain"
      description={`${String(index.notes.length)} notes. Pick one from the tree on the left, or press ⌘K to search.`}
    />
  )
}

export const Route = createFileRoute('/')({ component: IndexPage })
