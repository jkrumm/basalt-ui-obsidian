/**
 * `VaultTreePanel`'s summary strip — the module doc claims its per-top-level-folder counts always
 * match `countNotes` (`vault-nav.tsx`) for the same nodes, since both read from the same function.
 * Nothing checked that before this file: it renders the panel against a tree with nested folders and
 * a folder-note, then asserts the summary line's numbers equal `countNotes` computed directly against
 * the same `VaultTreeNode`s.
 */
import { describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { VaultIndex, VaultNote, VaultTreeNode } from 'obsidian-vault-core'
import { VaultProvider } from '../src/context.js'
import { countNotes } from '../src/nav/vault-nav.js'
import { VaultTreePanel } from '../src/panels/tree-panel.js'

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

const engineering = note('Areas/Engineering.md', 'Engineering')
const wildRift = note('Areas/Gaming/Wild Rift/Wild Rift.md', 'Wild Rift')
const runes = note('Areas/Gaming/Wild Rift/Runes.md', 'Runes')
const league = note('Areas/Gaming/League.md', 'League of Legends')
const inbox = note('Inbox.md', 'Inbox')

// `Areas` (3 notes, including a folder-note under `Wild Rift`) and `wiki` (0 visible notes) as
// top-level folders, plus a root-level lone note (`Inbox`) that folds into `total` but gets no
// summary segment of its own.
const AREAS: VaultTreeNode = {
  name: 'Areas',
  path: 'Areas',
  kind: 'folder',
  children: [
    { name: 'Engineering', path: 'Areas/Engineering.md', kind: 'note', note: engineering },
    {
      name: 'Gaming',
      path: 'Areas/Gaming',
      kind: 'folder',
      children: [
        {
          name: 'Wild Rift',
          path: 'Areas/Gaming/Wild Rift',
          kind: 'folder',
          children: [
            {
              name: 'Wild Rift',
              path: 'Areas/Gaming/Wild Rift/Wild Rift.md',
              kind: 'note',
              note: wildRift,
            },
            { name: 'Runes', path: 'Areas/Gaming/Wild Rift/Runes.md', kind: 'note', note: runes },
          ],
        },
        { name: 'League', path: 'Areas/Gaming/League.md', kind: 'note', note: league },
      ],
    },
  ],
}

const WIKI: VaultTreeNode = { name: 'wiki', path: 'wiki', kind: 'folder', children: [] }

const notes = [engineering, wildRift, runes, league, inbox]

function buildIndex(): VaultIndex {
  return {
    notes,
    byPath: new Map(notes.map((n) => [n.path, n])),
    bySlug: new Map(notes.map((n) => [n.slug, n])),
    backlinks: new Map(),
    tags: new Map(),
    bookmarks: [],
    tree: {
      name: '',
      path: '',
      kind: 'folder',
      children: [AREAS, WIKI, { name: 'Inbox', path: 'Inbox.md', kind: 'note', note: inbox }],
    },
    resolve: () => undefined,
  }
}

describe('VaultTreePanel summary strip', () => {
  test('each top-level folder segment matches countNotes(node) for that same folder', () => {
    const index = buildIndex()
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <VaultTreePanel />
        </VaultProvider>
      </MantineProvider>,
    )

    const expectedAreas = countNotes(AREAS)
    const expectedWiki = countNotes(WIKI)
    const expectedTotal = countNotes(AREAS) + countNotes(WIKI) + 1 // + the root-level Inbox note

    expect(expectedAreas).toBe(4)
    expect(expectedWiki).toBe(0)

    const summary = screen.getByText(new RegExp(`${expectedTotal} notes`))
    expect(summary.textContent).toContain(`Areas ${expectedAreas}`)
    expect(summary.textContent).toContain(`wiki ${expectedWiki}`)
  })
})
