import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readVault } from '../src/vault-reader.js'

async function writeNote(root: string, relPath: string, content: string): Promise<void> {
  const absPath = join(root, relPath)
  await mkdir(join(absPath, '..'), { recursive: true })
  await writeFile(absPath, content, 'utf8')
}

describe('readVault', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ovc-vault-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('reads notes, resolves links, builds backlinks and tags', async () => {
    await writeNote(root, 'index.md', '---\ntitle: Home\ntags: [a, b]\n---\nSee [[folder/child]].')
    await writeNote(root, 'folder/child.md', 'Child note. Back to [[index]].')

    const index = await readVault(root)

    expect(index.notes).toHaveLength(2)
    const home = index.byPath.get('index.md')
    expect(home?.title).toBe('Home')
    expect(home?.tags).toEqual(['a', 'b'])
    expect(home?.links[0]?.resolvedPath).toBe('folder/child.md')

    const child = index.byPath.get('folder/child.md')
    expect(child?.links[0]?.resolvedPath).toBe('index.md')

    const backlinksToChild = index.backlinks.get('folder/child.md')
    expect(backlinksToChild).toHaveLength(1)
    expect(backlinksToChild?.[0]?.from).toBe('index.md')

    expect(index.tags.get('a')).toEqual(['index.md'])
  })

  test('title falls back to basename when frontmatter has none', async () => {
    await writeNote(root, 'plain.md', 'No frontmatter here.')
    const index = await readVault(root)
    expect(index.byPath.get('plain.md')?.title).toBe('plain')
  })

  test('resolve() looks up a note the same way link resolution does', async () => {
    await writeNote(root, 'a.md', 'A')
    await writeNote(root, 'nested/b.md', 'B')
    const index = await readVault(root)
    expect(index.resolve('b', 'a.md')?.path).toBe('nested/b.md')
    expect(index.resolve('missing', 'a.md')).toBeUndefined()
  })

  test('always skips .git, node_modules, .obsidian, and dotted directories', async () => {
    await writeNote(root, '.git/note.md', 'ignored')
    await writeNote(root, 'node_modules/note.md', 'ignored')
    await writeNote(root, '.obsidian/note.md', 'ignored')
    await writeNote(root, '.hidden/note.md', 'ignored')
    await writeNote(root, 'visible.md', 'kept')

    const index = await readVault(root)
    expect(index.notes.map((note) => note.path)).toEqual(['visible.md'])
  })

  test('honors .obsidian/app.json userIgnoreFilters when enabled (the default)', async () => {
    await writeNote(root, 'docs/skip.md', 'skip me')
    await writeNote(root, 'kept.md', 'kept')
    await mkdir(join(root, '.obsidian'), { recursive: true })
    await writeFile(
      join(root, '.obsidian', 'app.json'),
      JSON.stringify({ userIgnoreFilters: ['docs/'] }),
      'utf8',
    )

    const index = await readVault(root)
    expect(index.notes.map((note) => note.path)).toEqual(['kept.md'])
  })

  test('useObsidianIgnoreFilters: false ignores app.json filters', async () => {
    await writeNote(root, 'docs/skip.md', 'not actually skipped')
    await mkdir(join(root, '.obsidian'), { recursive: true })
    await writeFile(
      join(root, '.obsidian', 'app.json'),
      JSON.stringify({ userIgnoreFilters: ['docs/'] }),
      'utf8',
    )

    const index = await readVault(root, { useObsidianIgnoreFilters: false })
    expect(index.notes.map((note) => note.path)).toContain('docs/skip.md')
  })

  test('a malformed app.json does not error — just contributes no filters', async () => {
    await writeNote(root, 'kept.md', 'kept')
    await mkdir(join(root, '.obsidian'), { recursive: true })
    await writeFile(join(root, '.obsidian', 'app.json'), '{not json', 'utf8')

    const index = await readVault(root)
    expect(index.notes.map((note) => note.path)).toEqual(['kept.md'])
  })

  test('the tree groups notes by folder', async () => {
    await writeNote(root, 'a.md', 'A')
    await writeNote(root, 'folder/b.md', 'B')
    const index = await readVault(root)
    expect(index.tree.children?.map((c) => c.name)).toEqual(['folder', 'a'])
  })

  describe('plugin config (icons + sorting-spec)', () => {
    async function ignoreExactPath(relPath: string): Promise<void> {
      await mkdir(join(root, '.obsidian'), { recursive: true })
      await writeFile(
        join(root, '.obsidian', 'app.json'),
        JSON.stringify({ userIgnoreFilters: [relPath] }),
        'utf8',
      )
    }

    async function writeIconizeData(content: string): Promise<void> {
      const dir = join(root, '.obsidian', 'plugins', 'obsidian-icon-folder')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'data.json'), content, 'utf8')
    }

    test('an individually-ignored note stays out of the public index but still reorders siblings', async () => {
      await writeNote(
        root,
        'sortspec.md',
        '---\nsorting-spec: |\n  target-folder: /\n  b\n  a\n---\n',
      )
      await writeNote(root, 'a.md', 'A')
      await writeNote(root, 'b.md', 'B')
      await ignoreExactPath('sortspec.md')

      const index = await readVault(root)

      // `readdir` order is filesystem-dependent, not guaranteed alphabetical — sort before
      // comparing so this doesn't flake on a filesystem that returns creation order.
      expect(index.notes.map((n) => n.path).toSorted()).toEqual(['a.md', 'b.md'])
      expect(index.byPath.has('sortspec.md')).toBe(false)
      // 'b' before 'a' — the alphabetical default would be the reverse — proves the ignored note's
      // own sorting-spec still reached buildTree.
      expect(index.tree.children?.map((c) => c.name)).toEqual(['b', 'a'])
    })

    test("a wikilink inside an individually-ignored note does not leak into another note's backlinks", async () => {
      await writeNote(root, 'ignored.md', 'Links to [[a]].')
      await writeNote(root, 'a.md', 'A')
      await ignoreExactPath('ignored.md')

      const index = await readVault(root)

      // The real risk: `ignored.md` is still fully PARSED (for its frontmatter) now, so a naive
      // implementation could accidentally resolve and register its links too.
      expect(index.backlinks.get('a.md') ?? []).toEqual([])
      expect(index.byPath.has('ignored.md')).toBe(false)
    })

    test('readVault applies Iconize icons end-to-end, alongside sibling order', async () => {
      await writeNote(root, 'a.md', 'A')
      await writeNote(root, 'b.md', 'B')
      await writeIconizeData(JSON.stringify({ settings: {}, a: 'LiCamera', b: 'LiBook' }))

      const index = await readVault(root)

      expect(index.tree.children?.find((c) => c.name === 'a')?.icon).toBe('LiCamera')
      expect(index.tree.children?.find((c) => c.name === 'b')?.icon).toBe('LiBook')
    })

    test('a malformed obsidian-icon-folder data.json does not error — just contributes no icons', async () => {
      await writeNote(root, 'a.md', 'A')
      await writeIconizeData('{not json')

      const index = await readVault(root)
      expect(index.tree.children?.[0]?.icon).toBeUndefined()
    })

    test('useObsidianPluginConfig: false restores pre-plugin-config behaviour byte for byte', async () => {
      await writeNote(
        root,
        'sortspec.md',
        '---\nsorting-spec: |\n  target-folder: /\n  b\n  a\n---\n',
      )
      await writeNote(root, 'a.md', 'A')
      await writeNote(root, 'b.md', 'B')
      await ignoreExactPath('sortspec.md')
      await writeIconizeData(JSON.stringify({ a: 'LiCamera' }))

      const index = await readVault(root, { useObsidianPluginConfig: false })

      // The ignored note is pruned during the walk itself now (never parsed at all), not merely
      // filtered out of the public index afterward — there is no other way to observe that
      // difference from outside `readVault`, so this is the closest black-box proof available.
      expect(index.notes.map((n) => n.path).toSorted()).toEqual(['a.md', 'b.md'])
      // Its sorting-spec never reached buildTree, so the default alphabetical order stands.
      expect(index.tree.children?.map((c) => c.name)).toEqual(['a', 'b'])
      // Iconize's data.json was never read either.
      expect(index.tree.children?.[0]?.icon).toBeUndefined()
    })
  })
})
