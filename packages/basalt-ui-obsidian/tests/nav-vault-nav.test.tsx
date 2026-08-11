/**
 * VaultNav — WAI-ARIA tree structure (`role="treeitem"`/`role="group"`, `aria-expanded`,
 * `aria-selected`), roving tabindex that follows keyboard focus, keyboard navigation, type-ahead,
 * the folder-note convention, and expand/collapse persistence. Built on `@mantine/core`'s
 * `Tree`/`useTree` — see `vault-nav.tsx`'s module doc for what Mantine owns vs. what this file still
 * patches in. The fixture rebuilds a MINIMAL version of `obsidian-vault-core`'s own `buildTree` (not
 * exported from its public barrel) purely to shape a hand-built `VaultIndex.tree` — same idiom as
 * `obsidian-vault-core`'s own `tests/tree.test.ts`.
 *
 * Two DOM-level quirks this file works around, both specific to the `bun test` environment, not to
 * `VaultNav` itself:
 *
 * - CSS Modules resolve to a plain STRING (the file path) under `bun test`'s built-in stub, not an
 *   object of hashed class names — so `classes.chevron` etc. are `undefined` in every render here,
 *   and no element in this component ever carries a CSS-module class in these tests. Nothing in this
 *   file queries by class; role, text and `data-testid` only.
 * - `fireEvent.keyDown(el, { key })` alone leaves `event.nativeEvent.code` empty (verified against
 *   the installed `@testing-library/dom@10.4.1` — it does not infer `code` from `key`). Mantine's own
 *   `TreeNode` keyboard handling (arrow keys) branches on `code`, not `key`, so every arrow-key test
 *   below passes BOTH. `Home`/`End`/type-ahead are `VaultNav`'s own handler and read `key`, so those
 *   don't need it.
 *
 * The chevron is `aria-hidden` and not a real button (see `vault-nav.tsx`'s module doc), and — since
 * the chrome pass replaced the old literal `▸` glyph with an inline SVG — carries no text an a11y
 * query can target either. Tests that need to click it locate it by `data-testid="vault-nav-chevron"`
 * scoped to the folder's own treeitem, via `within`.
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

/** A tree with one folder and one note both carrying an icon, for the icon-slot tests below. */
function buildIconIndex(): VaultIndex {
  const inbox = note('Inbox.md', 'Inbox')
  const engineering = note('Areas/Engineering.md', 'Engineering')
  const notes = [inbox, engineering]
  return {
    notes,
    byPath: new Map(notes.map((n) => [n.path, n])),
    bySlug: new Map(notes.map((n) => [n.slug, n])),
    backlinks: new Map(),
    tags: new Map(),
    tree: {
      name: '',
      path: '',
      kind: 'folder',
      children: [
        {
          name: 'Areas',
          path: 'Areas',
          kind: 'folder',
          icon: 'LiLightbulb',
          children: [
            { name: 'Engineering', path: 'Areas/Engineering.md', kind: 'note', note: engineering },
          ],
        },
        { name: 'Inbox', path: 'Inbox.md', kind: 'note', note: inbox, icon: 'LiInbox' },
      ],
    },
    resolve: () => undefined,
  }
}

/** Clicks the folder's chevron (mouse path), scoped to its treeitem so this can't accidentally hit
 * a same-testid chevron belonging to a different folder. */
function clickChevron(name: string) {
  const row = screen.getByRole('treeitem', { name })
  fireEvent.click(within(row).getByTestId('vault-nav-chevron'))
}

/** `element.focus()` triggers VaultNav's own delegated `onFocus` (`focusedPath`). Called as a raw
 * DOM API (not through `fireEvent`, which auto-wraps in `act()`), it needs its own `act()` so that
 * update — and the attribute-sync effect it re-runs — is flushed before the next synchronous line. */
function focusItem(el: HTMLElement) {
  act(() => {
    el.focus()
  })
}

/** Nesting depth via real DOM structure: one ancestor `[role="group"]` per level below the root.
 * `VaultNav` doesn't set an explicit `aria-level` (Mantine's `<li>` doesn't either) — see the module
 * doc for why that's spec-valid rather than a regression. */
function levelOf(el: HTMLElement): number {
  let level = 1
  let current = el.parentElement
  while (current !== null) {
    if (current.getAttribute('role') === 'group') level += 1
    current = current.parentElement
  }
  return level
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

  test('nesting depth is conveyed by real DOM structure, not an explicit aria-level', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-level',
    })

    expect(levelOf(screen.getByRole('treeitem', { name: 'Areas' }))).toBe(1)
    expect(levelOf(screen.getByRole('treeitem', { name: 'Inbox' }))).toBe(1)
    expect(levelOf(screen.getByRole('treeitem', { name: 'Gaming' }))).toBe(2)
    expect(levelOf(screen.getByRole('treeitem', { name: 'Reading' }))).toBe(2)
    expect(levelOf(screen.getByRole('treeitem', { name: 'League of Legends' }))).toBe(3)
    expect(levelOf(screen.getByRole('treeitem', { name: 'Wild Rift' }))).toBe(3)
    expect(levelOf(screen.getByRole('treeitem', { name: 'Runes' }))).toBe(4)
  })

  test('aria-expanded is present on folders and absent on notes (regression guard)', () => {
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

  test('the tabbable node follows keyboard focus, not just the first root row (regression guard)', () => {
    renderNav({ storageKey: 'nav-tabindex-follow' })

    const areas = screen.getByRole('treeitem', { name: 'Areas' })
    expect(areas.tabIndex).toBe(0)

    const inbox = screen.getByRole('treeitem', { name: 'Inbox' })
    focusItem(inbox)

    expect(inbox.tabIndex).toBe(0)
    expect(areas.tabIndex).toBe(-1)
  })

  test('the tabbable node falls back to the active row when the focused node is unmounted by an ancestor collapsing (regression guard)', () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-focus-unmount',
    })

    const runes = screen.getByRole('treeitem', { name: 'Runes' })
    focusItem(runes)
    expect(runes.tabIndex).toBe(0)

    // Collapsing `Wild Rift` by its chevron unmounts `Runes`' `<li>` without ever firing a NEW
    // focus event (nothing else receives focus), so `focusedPath` alone would go stale here — the
    // bug this guards against left every `<li>` at `tabIndex={-1}`, taking the tree out of the Tab
    // order entirely.
    clickChevron('Wild Rift')
    expect(screen.queryByRole('treeitem', { name: 'Runes' })).toBeNull()

    const tabbable = document.querySelectorAll('[role="treeitem"][tabindex="0"]')
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]).toBe(screen.getByRole('treeitem', { name: 'Wild Rift' }))
  })

  test('clicking a note that is not activePath does not change which row is selected', () => {
    renderNav({ activePath: 'Areas/Reading.md', storageKey: 'nav-select-click' })

    const inbox = screen.getByRole('treeitem', { name: 'Inbox' })
    fireEvent.click(inbox)

    // Selection is derived from the `activePath` PROP, never held internally — a click alone (with
    // `selectOnClick={false}` and no internal `select`/`toggleSelected` call anywhere in this file)
    // must not move `aria-selected` on its own; only a new `activePath` from the consumer can.
    expect(screen.getByRole('treeitem', { name: 'Reading' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(inbox.getAttribute('aria-selected')).toBe('false')
  })

  test('ArrowDown moves focus to the next visible node', () => {
    renderNav({ storageKey: 'nav-arrowdown' })

    const areas = screen.getByRole('treeitem', { name: 'Areas' })
    focusItem(areas)
    fireEvent.keyDown(areas, { key: 'ArrowDown', code: 'ArrowDown' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Inbox' }))
  })

  test("ArrowDown from a DEEP row steps to its real neighbour, not the top folder's", () => {
    renderNav({
      activePath: 'Areas/Gaming/Wild Rift/Wild Rift.md',
      storageKey: 'nav-deep-down',
    })

    // `Runes` is four levels down, so its `<li>` is nested inside the `<li>`s for `Wild Rift`,
    // `Gaming` and `Areas`. Mantine's `TreeNode` calls `stopPropagation` on the FIRST handler that
    // sees the matching `code` — the deepest one, since that's where the DOM event originates — so
    // this never risks the old hand-rolled bug (every ancestor's `onFocus` reporting itself,
    // outermost last) at all.
    const runes = screen.getByRole('treeitem', { name: 'Runes' })
    focusItem(runes)
    fireEvent.keyDown(runes, { key: 'ArrowDown', code: 'ArrowDown' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'League of Legends' }))
  })

  test('ArrowUp moves focus to the previous visible node', () => {
    renderNav({ storageKey: 'nav-arrowup' })

    const inbox = screen.getByRole('treeitem', { name: 'Inbox' })
    focusItem(inbox)
    fireEvent.keyDown(inbox, { key: 'ArrowUp', code: 'ArrowUp' })

    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Areas' }))
  })

  test('ArrowRight expands a collapsed folder', () => {
    renderNav({ storageKey: 'nav-arrowright' })

    const areas = screen.getByRole('treeitem', { name: 'Areas' })
    focusItem(areas)
    fireEvent.keyDown(areas, { key: 'ArrowRight', code: 'ArrowRight' })

    expect(screen.getByText('Gaming')).toBeDefined()
  })

  test('ArrowLeft collapses an expanded folder', () => {
    renderNav({ storageKey: 'nav-arrowleft' })

    const areas = screen.getByRole('treeitem', { name: 'Areas' })
    focusItem(areas)
    fireEvent.keyDown(areas, { key: 'ArrowRight', code: 'ArrowRight' })
    expect(screen.getByText('Gaming')).toBeDefined()

    fireEvent.keyDown(areas, { key: 'ArrowLeft', code: 'ArrowLeft' })
    expect(screen.queryByText('Gaming')).toBeNull()
  })

  test('ArrowRight on a leaf note does not leak its path into the persisted expanded set', () => {
    renderNav({ storageKey: 'nav-arrowright-leaf' })

    // Mantine's own ArrowRight handling calls `expand()` on ANY focused node, leaf notes included —
    // no `hasChildren` guard inside `TreeNode` itself. `handleExpandedStateChange`'s folder filter
    // is what keeps that from surviving into the persisted `expanded` array.
    const inbox = screen.getByRole('treeitem', { name: 'Inbox' })
    focusItem(inbox)
    fireEvent.keyDown(inbox, { key: 'ArrowRight', code: 'ArrowRight' })

    const stored: unknown = JSON.parse(localStorage.getItem('nav-arrowright-leaf') ?? '[]')
    expect(stored).not.toContain('Inbox.md')
  })

  test('Space on a leaf note does not toggle it or leak its path into the persisted expanded set', () => {
    renderNav({ storageKey: 'nav-space-leaf' })

    // `expandOnSpace={false}` on `<Tree>` is what lets Space bubble to `useTreeKeyboardExtras`'s own
    // handler at all — that handler's `toggleIfFolder` is the guard under test here, not Mantine's.
    const inbox = screen.getByRole('treeitem', { name: 'Inbox' })
    focusItem(inbox)
    fireEvent.keyDown(inbox, { key: ' ' })

    const stored: unknown = JSON.parse(localStorage.getItem('nav-space-leaf') ?? '[]')
    expect(stored).not.toContain('Inbox.md')
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

  describe('chevron slot', () => {
    test('a supplied renderChevron is used for a folder chevron', () => {
      render(
        <MantineProvider>
          <VaultProvider
            index={buildIndex(NOTES)}
            renderChevron={() => <span data-testid="custom-chevron" />}
          >
            <VaultNav storageKey="nav-chevron-custom" />
          </VaultProvider>
        </MantineProvider>,
      )

      const areas = screen.getByRole('treeitem', { name: 'Areas' })
      expect(within(areas).getByTestId('custom-chevron')).toBeDefined()
    })

    test('omitting renderChevron falls back to the built-in SVG chevron', () => {
      renderNav({ storageKey: 'nav-chevron-default' })

      const areas = screen.getByRole('treeitem', { name: 'Areas' })
      const chevron = within(areas).getByTestId('vault-nav-chevron')
      expect(chevron.querySelector('svg')).not.toBeNull()
    })
  })

  describe('icon slot', () => {
    const renderIcon = (iconName: string) => (
      <span data-testid={`icon-${iconName}`}>{iconName}</span>
    )

    test('renders the icon when both renderIcon and the node icon are present', () => {
      render(
        <MantineProvider>
          <VaultProvider index={buildIconIndex()} renderIcon={renderIcon}>
            <VaultNav storageKey="nav-icon-present" />
          </VaultProvider>
        </MantineProvider>,
      )

      expect(screen.getByTestId('icon-LiInbox')).toBeDefined()
    })

    test('falls back to the built-in icon for a node with no Iconize icon, even when renderIcon is supplied', () => {
      render(
        <MantineProvider>
          <VaultProvider index={buildIconIndex()} renderIcon={renderIcon}>
            <VaultNav storageKey="nav-icon-no-node-icon" />
          </VaultProvider>
        </MantineProvider>,
      )

      // Expand 'Areas' (which has an icon) so its child 'Engineering' (which does NOT) is visible.
      clickChevron('Areas')
      const engineering = screen.getByRole('treeitem', { name: 'Engineering' })
      expect(engineering).toBeDefined()
      // Exactly 'Areas' (LiLightbulb) and 'Inbox' (LiInbox) carry the CONSUMER icon — 'Engineering'
      // contributes none of those, but still gets the package's own built-in fallback glyph.
      expect(screen.getAllByTestId(/^icon-/)).toHaveLength(2)
      expect(engineering.querySelector('svg')).not.toBeNull()
    })

    test('falls back to the built-in icon when the node has an icon but no renderIcon was supplied', () => {
      render(
        <MantineProvider>
          <VaultProvider index={buildIconIndex()}>
            <VaultNav storageKey="nav-icon-no-renderer" />
          </VaultProvider>
        </MantineProvider>,
      )

      expect(screen.queryByTestId(/^icon-/)).toBeNull()
      expect(screen.getByRole('treeitem', { name: 'Inbox' }).querySelector('svg')).not.toBeNull()
    })

    test('the icon is aria-hidden and does not contribute to the row accessible name', () => {
      render(
        <MantineProvider>
          <VaultProvider index={buildIconIndex()} renderIcon={renderIcon}>
            <VaultNav storageKey="nav-icon-aria" />
          </VaultProvider>
        </MantineProvider>,
      )

      const icon = screen.getByTestId('icon-LiInbox')
      expect(icon.closest('[aria-hidden="true"]')).not.toBeNull()

      // The row's accessible name comes from content ("name from content" for `role="treeitem"`,
      // since chevron and icon both stay `aria-hidden`) — it must not also read "LiInbox" from the
      // hidden icon span.
      expect(screen.getByRole('treeitem', { name: 'Inbox' })).toBeDefined()
    })
  })
})
