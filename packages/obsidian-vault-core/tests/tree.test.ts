import { describe, expect, test } from 'bun:test'

import { buildTree } from '../src/tree.js'
import type { VaultNote } from '../src/types.js'

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

describe('buildTree', () => {
  test('nests notes under their folders', () => {
    const tree = buildTree([note('a.md'), note('folder/b.md')])
    expect(tree.children?.map((c) => c.name)).toEqual(['folder', 'a'])
  })

  test('folders sort before notes at every level', () => {
    const tree = buildTree([note('zzz.md'), note('aaa-folder/x.md')])
    const [first, second] = tree.children ?? []
    expect(first?.kind).toBe('folder')
    expect(second?.kind).toBe('note')
  })

  test('sorts by title case-insensitively', () => {
    const tree = buildTree([note('b.md', 'banana'), note('a.md', 'Apple')])
    expect(tree.children?.map((c) => c.name)).toEqual(['a', 'b'])
  })

  test('a note node carries the note itself', () => {
    const n = note('x.md')
    const tree = buildTree([n])
    expect(tree.children?.[0]?.note).toBe(n)
  })
})
