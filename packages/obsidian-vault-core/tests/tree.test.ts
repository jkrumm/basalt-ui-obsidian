import { describe, expect, test } from 'bun:test'

import { parseSortingSpec } from '../src/nav-config.js'
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
    mtime: 0,
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

  test('no config: ordering and icons are exactly the old no-second-arg behaviour', () => {
    const withoutArg = buildTree([note('zzz.md'), note('folder/x.md')])
    const withEmptyConfig = buildTree([note('zzz.md'), note('folder/x.md')], {})
    expect(withEmptyConfig).toEqual(withoutArg)
    expect(withoutArg.children?.every((c) => c.icon === undefined)).toBe(true)
  })

  test('applies an icon to a folder and to a note, matched by path and by slug', () => {
    const icons = new Map([
      ['folder', 'LiHammer'],
      // Iconize keys a note by its extension-less slug, not its tree `path` (which carries `.md`).
      ['a', 'LiCamera'],
    ])
    const tree = buildTree([note('a.md'), note('folder/b.md')], { icons })

    expect(tree.children?.find((c) => c.name === 'a')?.icon).toBe('LiCamera')
    expect(tree.children?.find((c) => c.name === 'folder')?.icon).toBe('LiHammer')
    expect(tree.children?.find((c) => c.name === 'folder')?.children?.[0]?.icon).toBeUndefined()
  })

  test('a note icon also matches by its full tree path (with .md)', () => {
    const icons = new Map([['a.md', 'LiCamera']])
    const tree = buildTree([note('a.md')], { icons })
    expect(tree.children?.[0]?.icon).toBe('LiCamera')
  })

  test('unrelated icons and settings-shaped entries are simply ignored (no crash, no icon)', () => {
    const icons = new Map([['nonexistent', 'LiGhost']])
    const tree = buildTree([note('a.md')], { icons })
    expect(tree.children?.[0]?.icon).toBeUndefined()
  })

  test('explicit order overrides alphabetical order for listed siblings', () => {
    const order = new Map([['', ['zzz', 'aaa']]])
    const tree = buildTree([note('aaa.md'), note('zzz.md')], { order })
    expect(tree.children?.map((c) => c.name)).toEqual(['zzz', 'aaa'])
  })

  test('order matches a note by basename or by title, and a folder by its name', () => {
    const order = new Map([['', ['My Folder', 'Banana Title']]])
    const tree = buildTree([note('folder-b.md', 'Banana Title'), note('My Folder/x.md')], { order })
    expect(tree.children?.map((c) => c.name)).toEqual(['My Folder', 'folder-b'])
  })

  test('unlisted children fall after every listed child, in their prior (old) relative order', () => {
    // Old order (folders before notes, then title): aaa-folder, mmm-folder, aaa.md, zzz.md.
    // Listing only "zzz" pulls it to the front; the rest keep their old relative order after it.
    const order = new Map([['', ['zzz']]])
    const tree = buildTree(
      [note('aaa.md'), note('zzz.md'), note('mmm-folder/x.md'), note('aaa-folder/x.md')],
      { order },
    )
    expect(tree.children?.map((c) => c.name)).toEqual(['zzz', 'aaa-folder', 'mmm-folder', 'aaa'])
  })

  test('order is scoped per folder path — a root-level list does not reorder a nested folder', () => {
    const order = new Map([['', ['folder']]])
    const tree = buildTree([note('folder/zzz.md'), note('folder/aaa.md')], { order })
    // Nested siblings have no entry for 'folder', so they keep the default title-sorted order.
    expect(tree.children?.[0]?.children?.map((c) => c.name)).toEqual(['aaa', 'zzz'])
  })

  test('a rooted nested target-folder block (parsed end-to-end) reorders that folder, not just root', () => {
    // The regression this covers: `parseSortingSpec` used to key a nested block as "/Areas
    // /Photography" (leading slash intact), which never matched `buildTree`'s unslashed folder
    // paths — so the block silently did nothing. Going through the real parser (not a hand-built
    // Map) is the point; a hand-built fixture couldn't have caught the normalization bug at all.
    const spec = [
      'target-folder: /',
      'Areas',
      'target-folder: /Areas/Photography/',
      'JoNeg',
      'JoChrome',
    ].join('\n')
    const order = parseSortingSpec(spec)

    const tree = buildTree(
      [
        note('Areas/Photography/JoChrome.md'),
        note('Areas/Photography/JoNeg.md'),
        note('wiki/index.md'),
      ],
      { order },
    )

    const areas = tree.children?.find((c) => c.name === 'Areas')
    const photography = areas?.children?.find((c) => c.name === 'Photography')
    expect(photography?.children?.map((c) => c.name)).toEqual(['JoNeg', 'JoChrome'])
  })
})
