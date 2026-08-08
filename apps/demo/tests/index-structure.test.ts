/**
 * `countNotes`/`areaAnchorId` back the home view's "structure" section (`routes/index.tsx`) — the
 * top-level `VaultIndex.tree` folders rendered as tappable overview tiles instead of the vault
 * being led with an alphabetical wall of tags. Both are plain functions over a `VaultTreeNode`,
 * testable without mounting the route (no router/DOM needed) — same reasoning as
 * `vault-search-spotlight.test.ts`'s exported pure helpers.
 */
import { describe, expect, test } from 'bun:test'
import type { VaultTreeNode } from 'obsidian-vault-core'
import { areaAnchorId, countNotes } from '../src/routes/index.js'

const note = (name: string): VaultTreeNode => ({
  name,
  path: name,
  kind: 'note',
  note: {
    path: name,
    slug: name,
    basename: name,
    title: name,
    frontmatter: {},
    body: '',
    headings: [],
    links: [],
    tags: [],
  },
})

const folder = (name: string, children: VaultTreeNode[]): VaultTreeNode => ({
  name,
  path: name,
  kind: 'folder',
  children,
})

describe('countNotes', () => {
  test('counts direct note children', () => {
    const areas = folder('Areas', [note('a'), note('b'), note('c')])
    expect(countNotes(areas)).toBe(3)
  })

  test('counts notes nested arbitrarily deep across subfolders', () => {
    const wiki = folder('wiki', [
      folder('health', [note('peptides'), folder('sleep', [note('index'), note('tracking')])]),
      note('index'),
    ])
    expect(countNotes(wiki)).toBe(4)
  })

  test('an empty folder counts zero', () => {
    expect(countNotes(folder('Inbox', []))).toBe(0)
  })

  test('a bare note node (kind: note) counts as one', () => {
    expect(countNotes(note('index'))).toBe(1)
  })
})

describe('areaAnchorId', () => {
  test('lowercases a simple top-level folder name', () => {
    expect(areaAnchorId('Areas')).toBe('area-areas')
    expect(areaAnchorId('wiki')).toBe('area-wiki')
  })

  test('replaces runs of non-alphanumeric characters with a single hyphen', () => {
    expect(areaAnchorId('Wild Rift & Co.')).toBe('area-wild-rift-co-')
  })
})
