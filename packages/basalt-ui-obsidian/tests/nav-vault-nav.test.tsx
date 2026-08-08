/**
 * VaultNav — recursive tree rendering, the folder-note convention, and expand/collapse
 * persistence. The fixture rebuilds a MINIMAL version of `obsidian-vault-core`'s own `buildTree`
 * (not exported from its public barrel) purely to shape a hand-built `VaultIndex.tree` — same
 * idiom as `obsidian-vault-core`'s own `tests/tree.test.ts`.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { VaultIndex, VaultNote, VaultTreeNode } from 'obsidian-vault-core'
import { VaultProvider } from '../src/context.js'
import { VaultNav } from '../src/nav/vault-nav.js'

function note(path: string, title?: string): VaultNote {
  const basename = path.slice(path.lastIndexOf('/') + 1, -3)
  return {
    path,
    slug: path.slice(0, -3),
    basename,
    title: title ?? basename,
    frontmatter: {},
    body: '',
    headings: [],
    links: [],
    tags: [],
  }
}

type MutableFolder = {
  name: string
  path: string
  folders: Map<string, MutableFolder>
  notes: VaultNote[]
}

function buildTree(notes: readonly VaultNote[]): VaultTreeNode {
  const createFolder = (name: string, path: string): MutableFolder => ({
    name,
    path,
    folders: new Map(),
    notes: [],
  })
  const root = createFolder('', '')

  for (const n of notes) {
    const dirSegments = n.path.split('/').slice(0, -1)
    let current = root
    let currentPath = ''
    for (const segment of dirSegments) {
      currentPath = currentPath === '' ? segment : `${currentPath}/${segment}`
      let next = current.folders.get(segment)
      if (next === undefined) {
        next = createFolder(segment, currentPath)
        current.folders.set(segment, next)
      }
      current = next
    }
    current.notes.push(n)
  }

  const toNode = (folder: MutableFolder): VaultTreeNode => ({
    name: folder.name,
    path: folder.path,
    kind: 'folder',
    children: [
      ...[...folder.folders.values()].map(toNode),
      ...folder.notes.map(
        (n): VaultTreeNode => ({ name: n.basename, path: n.path, kind: 'note', note: n }),
      ),
    ],
  })

  return toNode(root)
}

function buildIndex(notes: readonly VaultNote[]): VaultIndex {
  return {
    notes,
    byPath: new Map(notes.map((n) => [n.path, n])),
    bySlug: new Map(notes.map((n) => [n.slug, n])),
    backlinks: new Map(),
    tags: new Map(),
    tree: buildTree(notes),
    resolve: () => undefined,
  }
}

const NOTES = [
  note('Areas/Gaming/Wild Rift/Wild Rift.md', 'Wild Rift'),
  note('Areas/Gaming/Wild Rift/Runes.md', 'Runes'),
  note('Areas/Gaming/League.md', 'League of Legends'),
  note('Areas/Reading.md', 'Reading'),
  note('Inbox.md', 'Inbox'),
]

function renderNav(props: { activePath?: string; storageKey: string }) {
  const index = buildIndex(NOTES)
  const { activePath, storageKey } = props
  return render(
    <MantineProvider>
      <VaultProvider index={index}>
        <VaultNav {...(activePath !== undefined && { activePath })} storageKey={storageKey} />
      </VaultProvider>
    </MantineProvider>,
  )
}

describe('VaultNav', () => {
  beforeEach(() => localStorage.clear())

  test('renders four levels of nesting when the active path is deep', () => {
    renderNav({ activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md', storageKey: 'nav-a' })

    // Areas (1) -> Gaming (2) -> Wild Rift folder (3) -> Wild Rift/Runes notes (4)
    expect(screen.getByText('Areas')).toBeDefined()
    expect(screen.getByText('Gaming')).toBeDefined()
    expect(screen.getByText('Runes')).toBeDefined()
    // Rendered exactly once: the folder-note child is hidden from the child list — the folder
    // row itself carries the "Wild Rift" label.
    expect(screen.getAllByText('Wild Rift')).toHaveLength(1)
  })

  test('a folder note makes its folder row navigable, not a dead label', () => {
    renderNav({ activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md', storageKey: 'nav-b' })

    const link = screen.getByRole('link', { name: 'Wild Rift' })
    // Per-segment percent-encoding, `/` separators intact. Obsidian filenames legally contain `#`,
    // `?` and `%`, all structural in a URL — an unencoded slug routes a note called `C# basics` to
    // `/C` with a fragment and makes it unreachable. See `encodeSlugPath`.
    expect(link.getAttribute('href')).toBe('/Areas/Gaming/Wild%20Rift/Wild%20Rift')
  })

  test('slug segments with URL-structural characters survive href round-tripping', () => {
    renderNav({ storageKey: 'nav-encode' })
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? ''
      // A raw space or `#` past the leading `/` means a segment escaped encoding.
      expect(href).not.toContain(' ')
      expect(href.slice(1)).not.toContain('#')
    }
  })

  test('a folder without a folder note is a toggle-only label, not a link', () => {
    renderNav({ activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md', storageKey: 'nav-c' })

    expect(screen.queryByRole('link', { name: 'Areas' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Gaming' })).toBeNull()
  })

  test('folders start collapsed with no active path', () => {
    renderNav({ storageKey: 'nav-d' })

    expect(screen.getByText('Areas')).toBeDefined()
    expect(screen.queryByText('Gaming')).toBeNull()
  })

  test('clicking the chevron expands a collapsed folder', () => {
    renderNav({ storageKey: 'nav-e' })

    fireEvent.click(screen.getByRole('button', { name: 'Expand Areas' }))
    expect(screen.getByText('Gaming')).toBeDefined()
  })

  test('expanded state persists across remounts under the same storageKey', () => {
    const { unmount } = renderNav({ storageKey: 'nav-persist' })
    fireEvent.click(screen.getByRole('button', { name: 'Expand Areas' }))
    expect(screen.getByText('Gaming')).toBeDefined()
    unmount()

    renderNav({ storageKey: 'nav-persist' })
    expect(screen.getByText('Gaming')).toBeDefined()
  })

  test('a note row never carries an underline, regardless of the consumer renderLink', () => {
    renderNav({ activePath: 'Areas/Reading.md', storageKey: 'nav-underline' })

    // `VaultNav` owns its own row appearance — the label's own inline style is what guarantees
    // this regardless of what the (here, default `<a>`) `renderLink` brings.
    const label = screen.getByText('Reading')
    expect(label.style.textDecoration).toBe('none')
  })

  test('the active row carries a data-active marker; an inactive row does not', () => {
    renderNav({ activePath: 'Areas/Reading.md', storageKey: 'nav-active-marker' })

    const activeRow = screen.getByText('Reading').closest('[data-active]')
    expect(activeRow?.getAttribute('data-active')).toBe('true')

    const inactiveRow = screen.getByText('Inbox').closest('[data-active]')
    expect(inactiveRow).toBeNull()
  })

  test('clicking a note row invokes onNavigate — the demo shell wires this to close its mobile drawer', () => {
    const index = buildIndex(NOTES)
    const onNavigate = () => {
      calls += 1
    }
    let calls = 0
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <VaultNav storageKey="nav-onnavigate" onNavigate={onNavigate} />
        </VaultProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByText('Inbox'))
    expect(calls).toBe(1)
  })

  test('toggling a folder chevron does not invoke onNavigate', () => {
    const index = buildIndex(NOTES)
    let calls = 0
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <VaultNav storageKey="nav-onnavigate-chevron" onNavigate={() => (calls += 1)} />
        </VaultProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Areas' }))
    expect(calls).toBe(0)
  })
})
