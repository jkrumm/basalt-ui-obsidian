import { describe, expect, test } from 'bun:test'

import { fromVaultBundle, toVaultBundle } from '../src/search/bundle.js'
import type { VaultIndex, VaultNote } from '../src/types.js'

function note(overrides: Partial<VaultNote> = {}): VaultNote {
  return {
    path: 'a.md',
    slug: 'a',
    basename: 'a',
    title: 'Note A',
    frontmatter: {},
    body: 'body',
    headings: [],
    links: [],
    tags: [],
    ...overrides,
  }
}

describe('toVaultBundle / fromVaultBundle', () => {
  test('round trips through JSON with an equivalent index', () => {
    const a = note({
      path: 'a.md',
      slug: 'a',
      links: [{ raw: '[[b]]', target: 'b', embed: false, resolvedPath: 'b.md' }],
    })
    const b = note({ path: 'b.md', slug: 'b', basename: 'b', title: 'Note B', tags: ['x'] })

    const original: VaultIndex = {
      notes: [a, b],
      byPath: new Map([
        ['a.md', a],
        ['b.md', b],
      ]),
      bySlug: new Map([
        ['a', a],
        ['b', b],
      ]),
      backlinks: new Map([['b.md', [{ from: 'a.md', link: a.links[0]! }]]]),
      tags: new Map([['x', ['b.md']]]),
      tree: {
        name: '',
        path: '',
        kind: 'folder',
        children: [
          { name: 'a', path: 'a.md', kind: 'note', note: a },
          { name: 'b', path: 'b.md', kind: 'note', note: b },
        ],
      },
      resolve: (target, fromPath) => (target === 'b' && fromPath === 'a.md' ? b : undefined),
    }

    const json = JSON.stringify(toVaultBundle(original))
    const rehydrated = fromVaultBundle(JSON.parse(json))

    expect(rehydrated.notes).toEqual(original.notes)
    expect([...rehydrated.byPath.entries()]).toEqual([...original.byPath.entries()])
    expect([...rehydrated.backlinks.entries()]).toEqual([...original.backlinks.entries()])
    expect([...rehydrated.tags.entries()]).toEqual([...original.tags.entries()])
    expect(rehydrated.tree).toEqual(original.tree)
  })

  test('the rehydrated resolve() resolves links the same way the original vault would', () => {
    const a = note({ path: 'folder/a.md', slug: 'folder/a' })
    const b = note({ path: 'folder/b.md', slug: 'folder/b', basename: 'b', title: 'B' })

    const original: VaultIndex = {
      notes: [a, b],
      byPath: new Map([
        ['folder/a.md', a],
        ['folder/b.md', b],
      ]),
      bySlug: new Map(),
      backlinks: new Map(),
      tags: new Map(),
      tree: { name: '', path: '', kind: 'folder', children: [] },
      resolve: () => undefined,
    }

    const bundle = JSON.parse(JSON.stringify(toVaultBundle(original)))
    const rehydrated = fromVaultBundle(bundle)

    expect(rehydrated.resolve('b', 'folder/a.md')?.path).toBe('folder/b.md')
    expect(rehydrated.resolve('nonexistent', 'folder/a.md')).toBeUndefined()
  })
})
