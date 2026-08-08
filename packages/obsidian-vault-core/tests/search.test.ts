import { describe, expect, test } from 'bun:test'

import {
  buildSearchIndex,
  loadSearchIndex,
  serializeSearchIndex,
} from '../src/search/build-index.js'
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
})
