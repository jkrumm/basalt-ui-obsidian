/**
 * `VaultTagsPanel` — `VaultIndex.tags` as a dense, filterable list with drill-in, distinct from
 * `tag-index.tsx`'s chip-based `TagIndex` (still exported, still used by the demo's landing page —
 * a chip cloud and a nav-sidebar list are different surfaces with different density needs).
 *
 * Uncontrolled/controlled split matches the rest of this package's read-through-props idiom: supply
 * `onSelectTag` and this component holds no selection state of its own; omit it and an internal
 * `useState` drives the same two-state UI. `selectedTag` alone (no handler) would silently pin the
 * panel open on one tag forever — `controlled` is keyed on `onSelectTag`'s presence, not
 * `selectedTag`'s, so that footgun can't happen.
 */
import { useMemo, useState } from 'react'
import { TextInput } from '@mantine/core'
import type { VaultNote } from 'obsidian-vault-core'
import { useVault } from '../context.js'
import { NoteList } from './note-list.js'
import classes from './panel.module.css'

export type VaultTagsPanelProps = {
  readonly activePath?: string
  readonly onNavigate?: () => void
  readonly selectedTag?: string
  readonly onSelectTag?: (tag: string | undefined) => void
}

/** Most-used first, ties broken alphabetically — same tie-break `tag-index.tsx`'s own `limit`
 * branch already uses, kept identical rather than re-derived so the two never quietly disagree. */
function sortedTagEntries(
  tags: ReadonlyMap<string, readonly string[]>,
): [string, readonly string[]][] {
  return [...tags.entries()].toSorted(
    ([tagA, pathsA], [tagB, pathsB]) => pathsB.length - pathsA.length || tagA.localeCompare(tagB),
  )
}

function notesForTag(
  byPath: ReadonlyMap<string, VaultNote>,
  paths: readonly string[],
): VaultNote[] {
  return paths
    .map((path) => byPath.get(path))
    .filter((note): note is VaultNote => note !== undefined)
    .toSorted((a, b) => a.title.localeCompare(b.title))
}

export function VaultTagsPanel({
  activePath,
  onNavigate,
  selectedTag,
  onSelectTag,
}: VaultTagsPanelProps) {
  const { index } = useVault()
  const [internalTag, setInternalTag] = useState<string | undefined>(undefined)
  const [filter, setFilter] = useState('')

  const controlled = onSelectTag !== undefined
  const tag = controlled ? selectedTag : internalTag
  const selectTag = (next: string | undefined): void => {
    if (controlled) onSelectTag(next)
    else setInternalTag(next)
  }

  const entries = useMemo(() => sortedTagEntries(index.tags), [index.tags])
  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return needle === '' ? entries : entries.filter(([t]) => t.toLowerCase().includes(needle))
  }, [entries, filter])

  if (tag !== undefined) {
    const notes = notesForTag(index.byPath, index.tags.get(tag) ?? [])
    return (
      <div>
        <button type="button" className={classes.rowButton} onClick={() => selectTag(undefined)}>
          <span className={classes.title}>← All tags</span>
        </button>
        <div className={classes.sectionHeader}>
          #{tag} · {notes.length} note{notes.length === 1 ? '' : 's'}
        </div>
        <NoteList
          notes={notes}
          {...(activePath !== undefined && { activePath })}
          {...(onNavigate !== undefined && { onNavigate })}
          emptyLabel="No notes with this tag."
        />
      </div>
    )
  }

  return (
    <div>
      <div className={classes.toolbar}>
        <TextInput
          size="xs"
          placeholder="Filter tags…"
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className={classes.emptyLabel}>
          {entries.length === 0 ? 'No tags in this vault.' : 'No tags match.'}
        </div>
      ) : (
        filtered.map(([t, paths]) => (
          <button key={t} type="button" className={classes.rowButton} onClick={() => selectTag(t)}>
            <span className={classes.title}>#{t}</span>
            <span className={classes.meta}>{paths.length}</span>
          </button>
        ))
      )}
    </div>
  )
}
