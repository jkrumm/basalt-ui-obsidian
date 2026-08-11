/**
 * `VaultBookmarksPanel` — renders `VaultIndex.bookmarks` (Obsidian's own bookmarks pane) recursively.
 * Four bookmark kinds, four treatments — see `VaultBookmarkNode` below for each. A `group` nests
 * arbitrarily; every other kind is a leaf.
 *
 * Collapsed-group state persists to `localStorage` under `basalt-ui-obsidian:bookmarks-collapsed`,
 * keyed by POSITION (`'0'`, `'0.2'`, `'0.2.1'`, …) rather than by title — two groups can share a
 * title, and an untitled group falls back to `'Group'` entirely, so title is not a stable identity.
 * Position IS stable across reloads of the SAME `bookmarks.json`, which is the only case this needs
 * to survive; a reordered or edited bookmarks.json invalidating some stale collapsed keys is a
 * harmless no-op (an unknown key in the set just never matches a `nodeKey` again).
 */
import { useState } from 'react'
import type { VaultBookmark, VaultTreeNode } from 'obsidian-vault-core'
import { useVault } from '../context.js'
import { countNotes, folderNoteOf } from '../nav/vault-nav.js'
import { NoteRow } from './note-list.js'
import classes from './panel.module.css'

export type VaultBookmarksPanelProps = {
  readonly activePath?: string
  readonly onNavigate?: () => void
  /** A `search`-type bookmark renders only when this is supplied — see `VaultBookmarkNode`. */
  readonly onOpenSearch?: (query: string) => void
}

const STORAGE_KEY = 'basalt-ui-obsidian:bookmarks-collapsed'

/** Guarded for SSR (`typeof window`) and private-mode Safari / quota-exceeded (`try`/`catch`) — same
 * two guards `use-recently-viewed.ts` applies to its own `localStorage` reads/writes. */
function loadCollapsed(): ReadonlySet<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'))
  } catch {
    return new Set()
  }
}

function saveCollapsed(keys: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]))
  } catch {
    // quota exceeded / private-mode Safari — the collapsed set just doesn't persist this session
  }
}

/** Walks `root` by folder-path segments to find the `VaultTreeNode` a `folder`-type bookmark points
 * at — `''` (the vault root) resolves to `root` itself. `undefined` means the bookmarked folder no
 * longer exists (renamed or deleted since the bookmark was made). */
function findFolderNode(root: VaultTreeNode, path: string): VaultTreeNode | undefined {
  if (path === '') return root
  let current = root
  for (const segment of path.split('/')) {
    const next = current.children?.find(
      (child) => child.kind === 'folder' && child.name === segment,
    )
    if (next === undefined) return undefined
    current = next
  }
  return current
}

function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

type VaultBookmarkNodeProps = {
  readonly bookmark: VaultBookmark
  readonly nodeKey: string
  readonly depth: number
  readonly collapsed: ReadonlySet<string>
  readonly onToggle: (key: string) => void
  readonly activePath: string | undefined
  readonly onNavigate: (() => void) | undefined
  readonly onOpenSearch: ((query: string) => void) | undefined
}

function VaultBookmarkNode({
  bookmark,
  nodeKey,
  depth,
  collapsed,
  onToggle,
  activePath,
  onNavigate,
  onOpenSearch,
}: VaultBookmarkNodeProps) {
  const { index } = useVault()
  // Indentation only past the root level — a top-level row sits flush with the panel's own padding,
  // same as every other panel in this folder.
  const indent = depth > 0 ? { marginLeft: depth * 8 } : undefined

  if (bookmark.type === 'group') {
    const isCollapsed = collapsed.has(nodeKey)
    return (
      <div>
        <button
          type="button"
          className={classes.rowButton}
          aria-expanded={!isCollapsed}
          style={indent}
          onClick={() => onToggle(nodeKey)}
        >
          <span className={classes.title} style={{ textTransform: 'uppercase', fontSize: 11 }}>
            {bookmark.title ?? 'Group'}
          </span>
        </button>
        {!isCollapsed &&
          bookmark.items.map((child, i) => (
            // eslint-disable-next-line react/no-array-index-key -- `nodeKey` is a stable POSITION
            // path (see the module doc), not React's own array index guard — the child's index
            // within `items` is exactly the identity this key needs.
            <VaultBookmarkNode
              key={`${nodeKey}.${i}`}
              bookmark={child}
              nodeKey={`${nodeKey}.${i}`}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              activePath={activePath}
              onNavigate={onNavigate}
              onOpenSearch={onOpenSearch}
            />
          ))}
      </div>
    )
  }

  if (bookmark.type === 'file') {
    const note = index.byPath.get(bookmark.path)
    if (note === undefined) {
      // Deleted, or excluded by the vault's ignore filters — surfaced, not silently dropped: a
      // bookmark pointing at nothing is information a human deciding whether to clean up bookmarks
      // actually wants to see.
      const label = bookmark.title ?? basenameOf(bookmark.path)
      return (
        <div className={classes.row} style={{ ...indent, cursor: 'default' }}>
          <span className={classes.title} style={{ color: 'var(--vx-muted)' }}>
            {label}
          </span>
          <span className={classes.meta}>missing</span>
        </div>
      )
    }
    return (
      <div style={indent}>
        <NoteRow
          note={note}
          active={note.path === activePath}
          {...(onNavigate !== undefined && { onNavigate })}
        />
      </div>
    )
  }

  if (bookmark.type === 'folder') {
    const node = findFolderNode(index.tree, bookmark.path)
    const count = node === undefined ? 0 : countNotes(node)
    const folderNote = node !== undefined ? folderNoteOf(node) : undefined
    if (folderNote !== undefined) {
      return (
        <div style={indent}>
          <NoteRow
            note={folderNote}
            active={folderNote.path === activePath}
            meta={count}
            {...(onNavigate !== undefined && { onNavigate })}
          />
        </div>
      )
    }
    // No folder note — there is no folder route in this package, so the row is informational only.
    const label = bookmark.title ?? basenameOf(bookmark.path)
    return (
      <div className={classes.row} style={{ ...indent, cursor: 'default' }}>
        <span className={classes.title}>{label}</span>
        <span className={classes.meta}>{count}</span>
      </div>
    )
  }

  // bookmark.type === 'search'
  if (onOpenSearch === undefined) return null
  return (
    <button
      type="button"
      className={classes.rowButton}
      style={indent}
      onClick={() => onOpenSearch(bookmark.query)}
    >
      <span className={classes.title}>{bookmark.title ?? bookmark.query}</span>
    </button>
  )
}

export function VaultBookmarksPanel({
  activePath,
  onNavigate,
  onOpenSearch,
}: VaultBookmarksPanelProps) {
  const { index } = useVault()
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(loadCollapsed)

  // Computed from `collapsed` directly, not inside the `setCollapsed` updater: React deliberately
  // double-invokes a functional updater under StrictMode, which would fire `saveCollapsed` — and its
  // `localStorage` write — twice per click if it lived there.
  const toggle = (key: string): void => {
    const next = new Set(collapsed)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setCollapsed(next)
    saveCollapsed(next)
  }

  if (index.bookmarks.length === 0) {
    return (
      <div className={classes.emptyLabel}>Bookmarks come from Obsidian's own bookmarks pane.</div>
    )
  }

  return (
    <div>
      {index.bookmarks.map((bookmark, i) => (
        // eslint-disable-next-line react/no-array-index-key -- see `VaultBookmarkNode`'s own comment
        <VaultBookmarkNode
          key={String(i)}
          bookmark={bookmark}
          nodeKey={String(i)}
          depth={0}
          collapsed={collapsed}
          onToggle={toggle}
          activePath={activePath}
          onNavigate={onNavigate}
          onOpenSearch={onOpenSearch}
        />
      ))}
    </div>
  )
}
