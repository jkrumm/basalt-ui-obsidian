import { describe, expect, test } from 'bun:test'

import {
  buildSearchIndex,
  loadSearchIndex,
  serializeSearchIndex,
} from '../src/search/build-index.js'
import { foldDiacritics } from '../src/search/fold-diacritics.js'
import { highlightSegments } from '../src/search/highlight.js'
import { buildSnippet } from '../src/search/snippet.js'
import { stripMarkdownToText } from '../src/search/strip-markdown.js'
import type { VaultIndex, VaultNote } from '../src/types.js'

function note(overrides: Partial<VaultNote> = {}): VaultNote {
  return {
    path: 'a.md',
    slug: 'a',
    basename: 'a',
    title: 'Note A',
    frontmatter: { description: 'A description' },
    body: 'Body text about **peptides** and [[Other Note]].',
    headings: [],
    links: [],
    tags: ['health'],
    mtime: 0,
    ...overrides,
  }
}

function indexOf(notes: readonly VaultNote[]): VaultIndex {
  const byPath = new Map(notes.map((n) => [n.path, n]))
  return {
    notes,
    byPath,
    bySlug: new Map(notes.map((n) => [n.slug, n])),
    backlinks: new Map(),
    tags: new Map(),
    bookmarks: [],
    tree: { name: '', path: '', kind: 'folder', children: [] },
    resolve: () => undefined,
  }
}

describe('stripMarkdownToText', () => {
  test('strips headings, emphasis, and code markers', () => {
    expect(stripMarkdownToText('# Title\n\nSome **bold** and *italic* and `code`.')).toBe(
      'Title\nSome bold and italic and code.',
    )
  })

  test('flattens wikilinks to their alias or last path segment', () => {
    expect(stripMarkdownToText('See [[wiki/engineering/index|Engineering]].')).toBe(
      'See Engineering.',
    )
    expect(stripMarkdownToText('See [[wiki/engineering/index]].')).toBe('See index.')
  })

  test('flattens markdown links and images to their display text', () => {
    expect(stripMarkdownToText('[a link](https://x.com)')).toBe('a link')
    expect(stripMarkdownToText('![alt text](https://x.com/a.png)')).toBe('alt text')
  })

  test('strips list and blockquote markers', () => {
    expect(stripMarkdownToText('- one\n- two')).toBe('one\ntwo')
    expect(stripMarkdownToText('> quoted')).toBe('quoted')
  })

  test('strips an Obsidian callout tag, keeping the rest of the line', () => {
    expect(stripMarkdownToText('> [!tip] The jungle version is fine')).toBe(
      'The jungle version is fine',
    )
    expect(stripMarkdownToText('> [!warning]+\n> Folded by default')).toBe('Folded by default')
  })

  test('strips table syntax to space-joined cell text, dropping separator rows', () => {
    expect(
      stripMarkdownToText(
        '| Slot | Item |\n|-|-|\n| First | Thornmail |\n| Second | Frozen Heart |',
      ),
    ).toBe('Slot Item\nFirst Thornmail\nSecond Frozen Heart')
  })

  test('drops an Obsidian image-resize directive entirely, escaped or not', () => {
    expect(stripMarkdownToText('| Item | ![\\|28](https://x.com/a.webp) Thornmail |')).toBe(
      'Item Thornmail',
    )
    expect(stripMarkdownToText('![|28](https://x.com/a.webp) Thornmail')).toBe('Thornmail')
  })

  test('keeps real image alt text', () => {
    expect(stripMarkdownToText('![a chart](https://x.com/a.png)')).toBe('a chart')
  })
})

describe('foldDiacritics', () => {
  test('strips German umlauts and other Latin diacritics to their base letters', () => {
    expect(foldDiacritics('Ernährung')).toBe('Ernahrung')
    expect(foldDiacritics('Müsli')).toBe('Musli')
    expect(foldDiacritics('café')).toBe('cafe')
  })

  test('is a no-op on already-unaccented text', () => {
    expect(foldDiacritics('Ernahrung')).toBe('Ernahrung')
  })

  test('preserves string length for common single-codepoint diacritics', () => {
    expect(foldDiacritics('Ernährung').length).toBe('Ernährung'.length)
  })
})

describe('highlightSegments', () => {
  test('marks a literal, case-insensitive match', () => {
    expect(highlightSegments('The jungle version is fine', 'jungle')).toEqual([
      { text: 'The ', matched: false },
      { text: 'jungle', matched: true },
      { text: ' version is fine', matched: false },
    ])
  })

  test('folds diacritics so an unaccented query highlights the accented text', () => {
    const segments = highlightSegments('Ernährungsplan', 'Ernahrung')
    expect(segments.filter((s) => s.matched).map((s) => s.text)).toEqual(['Ernährung'])
  })

  test('a regex metacharacter in the query neither throws nor matches wildly', () => {
    expect(() => highlightSegments('a (b) c', '(b)')).not.toThrow()
    const segments = highlightSegments('a (b) c', '(b)')
    expect(segments.filter((s) => s.matched).map((s) => s.text)).toEqual(['(b)'])
  })

  test('an empty query produces one unmatched segment', () => {
    expect(highlightSegments('hello', '')).toEqual([{ text: 'hello', matched: false }])
  })
})

describe('buildSnippet', () => {
  test('drops a leading occurrence of the note title', () => {
    const body = '# Peptide\n\nPersönliche Wissensbasis zu Peptiden.'
    expect(buildSnippet(body, 'Peptide', 'peptide')).not.toMatch(/^Peptide/)
    expect(buildSnippet(body, 'Peptide', 'peptide')).toBe('Persönliche Wissensbasis zu Peptiden.')
  })

  test('drops a leading title even when the title carries a parenthetical the H1 omits', () => {
    const body = '# Collagen peptides + Vitamin C\n\nThe most honest answer.'
    const snippet = buildSnippet(body, 'Collagen peptides (oral) + Vitamin C', 'collagen')
    expect(snippet).toBe('The most honest answer.')
  })

  test('centers the excerpt on a diacritic-folded match', () => {
    const body = 'x'.repeat(60) + ' Ernährung ' + 'y'.repeat(60)
    const snippet = buildSnippet(body, 'Note', 'Ernahrung')
    expect(snippet).toContain('Ernährung')
    expect(snippet?.startsWith('…')).toBe(true)
  })
})

describe('buildSearchIndex / serializeSearchIndex / loadSearchIndex', () => {
  test('a built index finds a note by title, tag, and body text', () => {
    const index = indexOf([note()])
    const ms = buildSearchIndex(index)

    expect(ms.search('peptides')).not.toHaveLength(0)
    expect(ms.search('health')).not.toHaveLength(0)
    expect(ms.search('Note A')).not.toHaveLength(0)
  })

  test('search results carry the stored fields', () => {
    const index = indexOf([note()])
    const ms = buildSearchIndex(index)
    const [result] = ms.search('peptides')
    expect(result?.['path']).toBe('a.md')
    expect(result?.['slug']).toBe('a')
    expect(result?.['title']).toBe('Note A')
  })

  test('serialize -> load round trips to an equivalent, searchable index', () => {
    const index = indexOf([note()])
    const ms = buildSearchIndex(index)
    const reloaded = loadSearchIndex(serializeSearchIndex(ms))

    expect(reloaded.search('peptides').length).toBe(ms.search('peptides').length)
  })

  test('an unaccented query finds a note only reachable by its accented text', () => {
    const index = indexOf([
      note({ path: 'de.md', slug: 'de', title: 'Ernährungsplan', body: 'Ernährung im Alltag.' }),
    ])
    const ms = buildSearchIndex(index)

    expect(ms.search('Ernahrung')).not.toHaveLength(0)
    expect(ms.search('Ernahrung')[0]?.['title']).toBe('Ernährungsplan')
  })

  test('the diacritic fold survives a serialize -> load round trip', () => {
    const index = indexOf([
      note({ path: 'de.md', slug: 'de', title: 'Ernährungsplan', body: 'Ernährung im Alltag.' }),
    ])
    const ms = buildSearchIndex(index)
    const reloaded = loadSearchIndex(serializeSearchIndex(ms))

    expect(reloaded.search('Ernahrung').length).toBe(ms.search('Ernahrung').length)
    expect(reloaded.search('Ernahrung')).not.toHaveLength(0)
  })
})
