/**
 * `VaultTreePanel` — `VaultNav` plus a compact, read-only summary strip above it: total note count,
 * then one count per top-level folder, e.g. `114 notes · Inbox 3 · Projects 12 · Areas 48 · wiki 51`.
 * The strip is informational only — no click handler, no hover treatment — there is deliberately no
 * coupling from it into the tree's own expansion state below; a dead affordance (something that
 * LOOKS tappable but does nothing) is worse than a plainly inert line of text.
 *
 * `showCounts` (default `true` here, default `false` on `VaultNav` itself — see that component's own
 * doc) is threaded straight through to `VaultNav`, so a folder row in the tree ALSO shows its own
 * recursive count. Both numbers come from the same `countNotes` (`vault-nav.tsx`), so a top-level
 * folder's count in the strip always matches its own row's count in the tree below it.
 */
import { useMemo } from 'react'
import type { VaultIndex } from 'obsidian-vault-core'
import { useVault } from '../context.js'
import { countNotes, VaultNav } from '../nav/vault-nav.js'
import classes from './panel.module.css'

export type VaultTreePanelProps = {
  readonly activePath?: string
  readonly onNavigate?: () => void
  readonly showCounts?: boolean
}

type TopLevelSummary = {
  readonly total: number
  readonly folders: readonly { readonly name: string; readonly count: number }[]
}

/** Counts recursively from `index.tree.children` — the vault ROOT's own direct children, i.e. the
 * top-level folders (and any root-level lone notes, which fold into `total` but get no summary
 * segment of their own since there's no folder name to label them with). */
function summarize(index: VaultIndex): TopLevelSummary {
  const children = index.tree.children ?? []
  const folders = children
    .filter((node) => node.kind === 'folder')
    .map((node) => ({ name: node.name, count: countNotes(node) }))
  const total = children.reduce((sum, node) => sum + countNotes(node), 0)
  return { total, folders }
}

export function VaultTreePanel({ activePath, onNavigate, showCounts = true }: VaultTreePanelProps) {
  const { index } = useVault()
  const { total, folders } = useMemo(() => summarize(index), [index])

  const summaryLine = [
    `${total} note${total === 1 ? '' : 's'}`,
    ...folders.map((folder) => `${folder.name} ${folder.count}`),
  ].join(' · ')

  return (
    <div>
      <div className={classes.summary}>{summaryLine}</div>
      <VaultNav
        {...(activePath !== undefined && { activePath })}
        {...(onNavigate !== undefined && { onNavigate })}
        showCounts={showCounts}
      />
    </div>
  )
}
