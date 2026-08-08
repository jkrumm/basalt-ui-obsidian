/**
 * useVaultSearch — a query resolves to the expected note, and the MiniSearch index is built ONCE
 * per `VaultIndex` identity via `useMemo`, never per keystroke or unrelated re-render.
 *
 * "Built once" is proven without mocking `obsidian-vault-core/search` (ESM named-import bindings
 * aren't reassignable, and `mock.module` would need to run before this file's own static import of
 * the hook resolves it — too fragile to be worth it here). Instead the fixture's `notes` is a
 * GETTER that counts reads: `buildSearchIndex` reads `index.notes` exactly once per call
 * (`obsidian-vault-core/src/search/build-index.ts`), so the read count is a direct, honest proxy
 * for the build count.
 */
import { describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { VaultIndex, VaultNote } from 'obsidian-vault-core'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { VaultProvider } from '../src/context.js'
import { folderPath, toVaultSearchActions, useVaultSearch } from '../src/nav/use-vault-search.js'
import type { VaultSearchHit } from '../src/nav/use-vault-search.js'

function note(path: string, title: string, body = ''): VaultNote {
  const basename = path.slice(path.lastIndexOf('/') + 1, -3)
  return {
    path,
    slug: path.slice(0, -3),
    basename,
    title,
    frontmatter: {},
    body,
    headings: [],
    links: [],
    tags: [],
  }
}

const NOTES = [
  note(
    'wiki/health/peptides/index.md',
    'Peptides',
    'BPC-157 is a synthetic peptide used for gut healing.',
  ),
  note('Areas/Gaming/Wild Rift.md', 'Wild Rift', 'A mobile MOBA by Riot Games.'),
]

function buildIndex(notes: readonly VaultNote[]): VaultIndex {
  return {
    notes,
    byPath: new Map(notes.map((n) => [n.path, n])),
    bySlug: new Map(notes.map((n) => [n.slug, n])),
    backlinks: new Map(),
    tags: new Map(),
    tree: { name: '', path: '', kind: 'folder', children: [] },
    resolve: () => undefined,
  }
}

/** Same as `buildIndex`, but `notes` counts every read — a direct proxy for build-call count. */
function buildCountingIndex(notes: readonly VaultNote[]): {
  index: VaultIndex
  readCount: () => number
} {
  let reads = 0
  const index: VaultIndex = {
    get notes() {
      reads += 1
      return notes
    },
    byPath: new Map(notes.map((n) => [n.path, n])),
    bySlug: new Map(notes.map((n) => [n.slug, n])),
    backlinks: new Map(),
    tags: new Map(),
    tree: { name: '', path: '', kind: 'folder', children: [] },
    resolve: () => undefined,
  }
  return { index, readCount: () => reads }
}

function wrapper(index: VaultIndex) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider>
        <VaultProvider index={index}>{children}</VaultProvider>
      </MantineProvider>
    )
  }
}

describe('useVaultSearch', () => {
  test('a query returns the expected note', async () => {
    const index = buildIndex(NOTES)
    const { result } = renderHook(() => useVaultSearch({ debounceMs: 0 }), {
      wrapper: wrapper(index),
    })

    act(() => result.current.setQuery('peptide'))

    await waitFor(() => expect(result.current.hits.length).toBeGreaterThan(0))
    expect(result.current.hits[0]?.title).toBe('Peptides')
    expect(result.current.hits[0]?.path).toBe('wiki/health/peptides/index.md')
  })

  test('drops results far below the top score (relevance cutoff)', async () => {
    // A short, term-dense field scores far higher under BM25 than the same term diluted across a
    // long one — measured ~1.60 vs ~0.22 for this shape, well under the 0.25 cutoff fraction.
    const filler = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')
    const notes = [
      note('a.md', 'Zenith', 'zenith zenith zenith zenith zenith'),
      note('b.md', 'Filler One', `${filler} zenith ${filler}`),
    ]
    const index = buildIndex(notes)
    const { result } = renderHook(() => useVaultSearch({ debounceMs: 0 }), {
      wrapper: wrapper(index),
    })

    act(() => result.current.setQuery('zenith'))

    await waitFor(() => expect(result.current.hits.length).toBeGreaterThan(0))
    expect(result.current.hits.map((hit) => hit.title)).toEqual(['Zenith'])
  })

  test('a diacritic-folded query finds a note only reachable by its accented text', async () => {
    const notes = [
      note('de.md', 'Ernährungsplan', 'Ernährung im Alltag: viel Gemüse und wenig Zucker.'),
    ]
    const index = buildIndex(notes)
    const { result } = renderHook(() => useVaultSearch({ debounceMs: 0 }), {
      wrapper: wrapper(index),
    })

    act(() => result.current.setQuery('Ernahrung'))

    await waitFor(() => expect(result.current.hits.length).toBeGreaterThan(0))
    expect(result.current.hits[0]?.title).toBe('Ernährungsplan')
  })

  test('a snippet has raw markdown stripped and its own title dropped', async () => {
    const notes = [
      note(
        'callout.md',
        'Dr. Mundo',
        '# Dr. Mundo\n\n> [!tip] The jungle version is fine\n> It works well.',
      ),
    ]
    const index = buildIndex(notes)
    const { result } = renderHook(() => useVaultSearch({ debounceMs: 0 }), {
      wrapper: wrapper(index),
    })

    act(() => result.current.setQuery('jungle'))

    await waitFor(() => expect(result.current.hits.length).toBeGreaterThan(0))
    const snippet = result.current.hits[0]?.snippet
    expect(snippet).not.toContain('[!tip]')
    expect(snippet).not.toContain('#')
    expect(snippet).not.toMatch(/^Dr\. Mundo/)
  })

  test('an empty query returns no hits', () => {
    const index = buildIndex(NOTES)
    const { result } = renderHook(() => useVaultSearch({ debounceMs: 0 }), {
      wrapper: wrapper(index),
    })

    expect(result.current.hits).toEqual([])
  })

  test('the index is built once across re-renders, not per keystroke', () => {
    const { index, readCount } = buildCountingIndex(NOTES)

    function Probe() {
      const [, setTick] = useState(0)
      const search = useVaultSearch({ debounceMs: 0 })
      return (
        <div>
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            tick
          </button>
          <input
            aria-label="search"
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
          />
        </div>
      )
    }

    render(<Probe />, { wrapper: wrapper(index) })
    expect(readCount()).toBe(1)

    const input = screen.getByRole('textbox', { name: 'search' })
    fireEvent.change(input, { target: { value: 'p' } })
    fireEvent.change(input, { target: { value: 'pe' } })
    fireEvent.change(input, { target: { value: 'pep' } })
    fireEvent.click(screen.getByRole('button', { name: 'tick' }))
    fireEvent.click(screen.getByRole('button', { name: 'tick' }))

    expect(readCount()).toBe(1)
  })

  test('toVaultSearchActions projects hits into id/label/keywords/onClick', () => {
    const hits: VaultSearchHit[] = [
      { path: 'a.md', slug: 'a', title: 'Alpha', score: 1, snippet: 'about alpha things' },
    ]
    const navigated: string[] = []
    const actions = toVaultSearchActions(hits, {
      onNavigate: (href) => navigated.push(href),
      href: (hit) => `/${hit.slug}`,
      group: 'Notes',
    })

    expect(actions[0]?.id).toBe('vault:/a')
    expect(actions[0]?.label).toBe('Alpha')
    expect(actions[0]?.description).toBe('about alpha things')
    expect(actions[0]?.group).toBe('Notes')
    actions[0]?.onClick()
    expect(navigated).toEqual(['/a'])
  })

  test('toVaultSearchActions omits description/group when absent', () => {
    const hits: VaultSearchHit[] = [{ path: 'a.md', slug: 'a', title: 'Alpha', score: 1 }]
    const actions = toVaultSearchActions(hits, {
      onNavigate: () => {},
      href: (hit) => `/${hit.slug}`,
    })

    expect(actions[0]).not.toHaveProperty('description')
    expect(actions[0]).not.toHaveProperty('group')
    expect(actions[0]?.id).toBe('vault:/a')
  })
})

describe('folderPath', () => {
  test('returns the vault-relative folder of a nested note', () => {
    expect(folderPath('wiki/health/peptides/index.md')).toBe('wiki/health/peptides')
  })

  test('returns an empty string for a root-level note', () => {
    expect(folderPath('Health.md')).toBe('')
  })
})
