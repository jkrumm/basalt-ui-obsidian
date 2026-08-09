/**
 * `countNotes`/`areaAnchorId`/`groupByAreaAndSubArea` back the home view's "structure" and note
 * sections (`routes/index.tsx`) — the top-level `VaultIndex.tree` folders rendered as tappable
 * overview tiles, and the note grid grouped two levels deep underneath, instead of the vault being
 * led with an alphabetical wall of tags or one flat 40+-note dump per area. All are plain functions
 * over `VaultTreeNode`/`VaultNote`, testable without mounting the route (no router/DOM needed) —
 * same reasoning as `vault-search-spotlight.test.ts`'s exported pure helpers.
 */
import { describe, expect, test } from 'bun:test'
import type { VaultNote, VaultTreeNode } from 'obsidian-vault-core'
import { areaAnchorId, countNotes, groupByAreaAndSubArea } from '../src/routes/index.js'

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

const vaultNote = (path: string, title?: string): VaultNote => ({
  path,
  slug: path,
  basename: path,
  title: title ?? path,
  frontmatter: {},
  body: '',
  headings: [],
  links: [],
  tags: [],
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

describe('groupByAreaAndSubArea', () => {
  test('a note nested 3+ deep buckets under its second segment, not deeper', () => {
    const bpc = vaultNote('wiki/health/peptides/bpc-157.md', 'BPC-157')
    expect(groupByAreaAndSubArea([bpc])).toEqual([
      { area: 'wiki', direct: [], subAreas: [{ name: 'health', notes: [bpc] }] },
    ])
  })

  test('a note directly in an area folder lands in direct, not a sub-area', () => {
    const foo = vaultNote('Inbox/foo.md', 'Foo')
    expect(groupByAreaAndSubArea([foo])).toEqual([{ area: 'Inbox', direct: [foo], subAreas: [] }])
  })

  test('a root-level note (no slash) falls back to area Notes, no sub-area', () => {
    const foo = vaultNote('foo.md', 'Foo')
    expect(groupByAreaAndSubArea([foo])).toEqual([{ area: 'Notes', direct: [foo], subAreas: [] }])
  })

  test('areas, sub-areas, and notes within each are all sorted alphabetically (case-insensitive)', () => {
    const zeta = vaultNote('wiki/health/zeta.md', 'Zeta')
    const alpha = vaultNote('wiki/health/alpha.md', 'alpha')
    const engineeringNote = vaultNote('wiki/engineering/one.md', 'One')
    const gamingNote = vaultNote('Areas/gaming/foo.md', 'Foo')
    const inboxNote = vaultNote('Inbox/note.md', 'Note')

    const groups = groupByAreaAndSubArea([zeta, alpha, engineeringNote, gamingNote, inboxNote])

    expect(groups.map((g) => g.area)).toEqual(['Areas', 'Inbox', 'wiki'])

    const wiki = groups.find((g) => g.area === 'wiki')
    expect(wiki?.subAreas.map((s) => s.name)).toEqual(['engineering', 'health'])

    const health = wiki?.subAreas.find((s) => s.name === 'health')
    expect(health?.notes.map((n) => n.title)).toEqual(['alpha', 'Zeta'])
  })

  test('direct notes and every sub-area note together equal the input length — nothing dropped', () => {
    const notes = [
      vaultNote('foo.md', 'Foo'),
      vaultNote('Inbox/bar.md', 'Bar'),
      vaultNote('Areas/Health/Blutbild.md', 'Blutbild'),
      vaultNote('Areas/Health/Iron.md', 'Iron'),
      vaultNote('wiki/health/peptides/bpc-157.md', 'BPC-157'),
      vaultNote('wiki/engineering/basalt.md', 'basalt'),
    ]

    const groups = groupByAreaAndSubArea(notes)
    const total = groups.reduce(
      (sum, group) =>
        sum + group.direct.length + group.subAreas.reduce((s, sa) => s + sa.notes.length, 0),
      0,
    )
    expect(total).toBe(notes.length)
  })
})
