/**
 * VaultNav — WAI-ARIA tree structure (`role="treeitem"`/`role="group"`, `aria-level`,
 * `aria-expanded`, `aria-selected`), roving tabindex, keyboard navigation, type-ahead, the
 * folder-note convention, and expand/collapse persistence. The fixture rebuilds a MINIMAL version
 * of `obsidian-vault-core`'s own `buildTree` (not exported from its public barrel) purely to shape
 * a hand-built `VaultIndex.tree` — same idiom as `obsidian-vault-core`'s own `tests/tree.test.ts`.
 *
 * The chevron is `aria-hidden` and not a button (see `vault-nav.tsx`'s module doc), so tests that
 * need to click it locate it by its literal glyph text (`▸`) inside the folder's treeitem, via
 * `within` — `getByText` operates on DOM content, not the accessibility tree, so `aria-hidden`
 * doesn't hide it from that query.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
        (n): VaultTreeNode => ({
          name: n.basename,
          path: n.path,
          kind: 'note',
          note: n,
        }),
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

/** Clicks the folder's chevron (mouse path), scoped to its treeitem so this can't accidentally hit
 * a same-glyph chevron belonging to a different folder. */
function clickChevron(name: string) {
  const row = screen.getByRole('treeitem', { name })
  fireEvent.click(within(row).getByText('▸'))
}

/** `element.focus()` triggers VaultNav's own `onFocus` state update (`focusedPath`). Called as a
 * raw DOM API (not through `fireEvent`, which auto-wraps in `act()`), it needs its own `act()` so
 * that update is flushed before the next synchronous line — otherwise a following
 * `fireEvent.keyDown` reads the roving-tabindex handler closure from the PRE-focus render. */
function focusItem(el: HTMLElement) {
  act(() => {
    el.focus()
  })
}

describe('VaultNav', () => {
  beforeEach(() => localStorage.clear())

  test('renders four levels of nesting when the active path is deep', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-a',
    })

    // Areas (1) -> Gaming (2) -> Wild Rift folder (3) -> Wild Rift/Runes notes (4)
    expect(screen.getByText('Areas')).toBeDefined()
    expect(screen.getByText('Gaming')).toBeDefined()
    expect(screen.getByText('Runes')).toBeDefined()
    // Rendered exactly once: the folder-note child is hidden from the child list — the folder
    // row itself carries the "Wild Rift" label.
    expect(screen.getAllByText('Wild Rift')).toHaveLength(1)
  })

  test('a folder note makes its folder row navigable, not a dead label', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-b',
    })

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
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-c',
    })

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

    clickChevron('Areas')
    expect(screen.getByText('Gaming')).toBeDefined()
  })

  test('expanded state persists across remounts under the same storageKey', () => {
    const { unmount } = renderNav({ storageKey: 'nav-persist' })
    clickChevron('Areas')
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
    renderNav({
      activePath: 'Areas/Reading.md',
      storageKey: 'nav-active-marker',
    })

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

    clickChevron('Areas')
    expect(calls).toBe(0)
  })

  test('renders a real tree: role="treeitem"/"group" exist, with exact counts for the fixture', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-counts-deep',
    })

    // Areas, Gaming, League, Wild Rift (folder), Runes, Reading, Inbox — every ancestor of the
    // active path is expanded, so all seven fixture rows are visible.
    expect(screen.getAllByRole('treeitem')).toHaveLength(7)
    // One group per expanded folder with children: Areas, Gaming, Wild Rift.
    expect(screen.getAllByRole('group')).toHaveLength(3)
  })

  test('a collapsed-by-default tree renders only the top-level treeitems and no groups', () => {
    renderNav({ storageKey: 'nav-counts-collapsed' })

    expect(screen.getAllByRole('treeitem')).toHaveLength(2) // Areas, Inbox
    expect(screen.queryAllByRole('group')).toHaveLength(0)
  })

  test('aria-level matches nesting depth', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-level',
    })

    expect(screen.getByRole('treeitem', { name: 'Areas' }).getAttribute('aria-level')).toBe('1')
    expect(screen.getByRole('treeitem', { name: 'Inbox' }).getAttribute('aria-level')).toBe('1')
    expect(screen.getByRole('treeitem', { name: 'Gaming' }).getAttribute('aria-level')).toBe('2')
    expect(screen.getByRole('treeitem', { name: 'Reading' }).getAttribute('aria-level')).toBe('2')
    expect(
      screen.getByRole('treeitem', { name: 'League of Legends' }).getAttribute('aria-level'),
    ).toBe('3')
    expect(screen.getByRole('treeitem', { name: 'Wild Rift' }).getAttribute('aria-level')).toBe('3')
    expect(screen.getByRole('treeitem', { name: 'Runes' }).getAttribute('aria-level')).toBe('4')
  })

  test('aria-expanded is present on folders and absent on notes', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-expanded-attr',
    })

    for (const name of ['Areas', 'Gaming', 'Wild Rift']) {
      expect(screen.getByRole('treeitem', { name }).hasAttribute('aria-expanded')).toBe(true)
    }
    for (const name of ['League of Legends', 'Runes', 'Reading', 'Inbox']) {
      expect(screen.getByRole('treeitem', { name }).hasAttribute('aria-expanded')).toBe(false)
    }
  })

  test('aria-selected="true" appears exactly once, on the row matching activePath', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-selected',
    })

    const selected = screen
      .getAllByRole('treeitem')
      .filter((el) => el.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toBe(screen.getByRole('treeitem', { name: 'Wild Rift' }))
  })

  test('exactly one treeitem is tabbable at a time, defaulting to the active row', () => {
    renderNav({ activePath: 'Areas/Reading.md', storageKey: 'nav-tabindex' })

    const tabbable = document.querySelectorAll('[role="treeitem"][tabindex="0"]')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]).toBe(screen.getByRole('treeitem', { name: 'Reading' }))
  })

  test('ArrowDown moves focus to the next visible node', () => {
    renderNav({ storageKey: 'nav-arrowdown' })

    const areas = screen.getByRole('treeitem', { name: 'Areas' })
    focusItem(areas)
    fireEvent.keyDown(areas, { key: 'ArrowDown' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Inbox' }))
  })

  test("ArrowDown from a DEEP row steps to its real neighbour, not the top folder's", () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-deep-down',
    })

    // `Runes` is four levels down, so its `<li>` is nested inside the `<li>`s for `Wild Rift`,
    // `Gaming` and `Areas`. `onFocus` is React's binding for `focusin`, which BUBBLES: without a
    // target check each of those ancestors also reports itself as focused, outermost last, so the
    // tree believes focus is on `Areas` and ArrowDown walks from there. Measured live before the
    // fix: every ArrowDown, from any starting row at any depth, landed on `Engineering` — the node
    // right after `Areas`.
    const runes = screen.getByRole('treeitem', { name: 'Runes' })
    focusItem(runes)
    fireEvent.keyDown(runes, { key: 'ArrowDown' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'League of Legends' }))
  })

  test('ArrowUp moves focus to the previous visible node', () => {
    renderNav({ storageKey: 'nav-arrowup' })

    const inbox = screen.getByRole('treeitem', { name: 'Inbox' })
    focusItem(inbox)
    fireEvent.keyDown(inbox, { key: 'ArrowUp' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Areas' }))
  })

  test('ArrowRight expands a collapsed folder', () => {
    renderNav({ storageKey: 'nav-arrowright' })

    const areas = screen.getByRole('treeitem', { name: 'Areas' })
    focusItem(areas)
    fireEvent.keyDown(areas, { key: 'ArrowRight' })

    expect(screen.getByText('Gaming')).toBeDefined()
  })

  test('ArrowLeft collapses an expanded folder', () => {
    renderNav({ storageKey: 'nav-arrowleft' })

    const areas = screen.getByRole('treeitem', { name: 'Areas' })
    focusItem(areas)
    fireEvent.keyDown(areas, { key: 'ArrowRight' })
    expect(screen.getByText('Gaming')).toBeDefined()

    fireEvent.keyDown(areas, { key: 'ArrowLeft' })
    expect(screen.queryByText('Gaming')).toBeNull()
  })

  test('Home jumps to the first visible node', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-home',
    })

    const runes = screen.getByRole('treeitem', { name: 'Runes' })
    focusItem(runes)
    fireEvent.keyDown(runes, { key: 'Home' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Areas' }))
  })

  test('End jumps to the last visible node', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-end',
    })

    const areas = screen.getByRole('treeitem', { name: 'Areas' })
    focusItem(areas)
    fireEvent.keyDown(areas, { key: 'End' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Inbox' }))
  })

  test('type-ahead focuses the first visible node whose name starts with the typed character', () => {
    renderNav({ storageKey: 'nav-typeahead' })

    const areas = screen.getByRole('treeitem', { name: 'Areas' })
    focusItem(areas)
    fireEvent.keyDown(areas, { key: 'i' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Inbox' }))
  })
})
