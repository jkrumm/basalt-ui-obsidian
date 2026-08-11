/**
 * `VaultBookmarksPanel` — a `group` (expanded by default, collapses on click), an unresolvable
 * `file` bookmark (rendered as an inert, dimmed "missing" row rather than silently dropped or
 * crashing), and the empty-vault-bookmarks explanatory line.
 */
import { describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { VaultBookmark, VaultIndex, VaultNote } from 'obsidian-vault-core'
import { VaultProvider } from '../src/context.js'
import { VaultBookmarksPanel } from '../src/panels/bookmarks-panel.js'

function note(path: string, title: string): VaultNote {
  const basename = path.slice(path.lastIndexOf('/') + 1, -3)
  return {
    path,
    slug: path.slice(0, -3),
    basename,
    title,
    frontmatter: {},
    body: '',
    headings: [],
    links: [],
    tags: [],
    mtime: 0,
  }
}

function buildIndex(notes: readonly VaultNote[], bookmarks: readonly VaultBookmark[]): VaultIndex {
  return {
    notes,
    byPath: new Map(notes.map((n) => [n.path, n])),
    bySlug: new Map(notes.map((n) => [n.slug, n])),
    backlinks: new Map(),
    tags: new Map(),
    tree: { name: '', path: '', kind: 'folder', children: [] },
    bookmarks,
    resolve: () => undefined,
  }
}

function renderPanel(index: VaultIndex) {
  return render(
    <MantineProvider>
      <VaultProvider index={index}>
        <VaultBookmarksPanel />
      </VaultProvider>
    </MantineProvider>,
  )
}

describe('VaultBookmarksPanel', () => {
  test('renders a group expanded by default, and collapses its children on click', () => {
    const alpha = note('a.md', 'Alpha')
    const index = buildIndex(
      [alpha],
      [{ type: 'group', title: 'Favorites', items: [{ type: 'file', path: 'a.md' }] }],
    )

    renderPanel(index)

    expect(screen.getByText('Favorites')).toBeDefined()
    expect(screen.getByText('Alpha')).toBeDefined()

    fireEvent.click(screen.getByText('Favorites'))

    expect(screen.queryByText('Alpha')).toBeNull()
  })

  test('an unresolvable file bookmark renders an inert "missing" row instead of dropping it', () => {
    const index = buildIndex([], [{ type: 'file', path: 'deleted.md', title: 'Deleted Note' }])

    renderPanel(index)

    expect(screen.getByText('Deleted Note')).toBeDefined()
    expect(screen.getByText('missing')).toBeDefined()
  })

  test('an empty vault bookmarks list explains where bookmarks come from', () => {
    const index = buildIndex([], [])

    renderPanel(index)

    expect(screen.getByText(/Obsidian's own bookmarks pane/)).toBeDefined()
  })
})
