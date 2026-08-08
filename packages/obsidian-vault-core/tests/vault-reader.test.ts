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
})
