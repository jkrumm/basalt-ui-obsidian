import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readBookmarks } from '../src/bookmarks.js'

describe('readBookmarks', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ovc-bookmarks-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function writeBookmarksJson(content: string): Promise<void> {
    await mkdir(join(root, '.obsidian'), { recursive: true })
    await writeFile(join(root, '.obsidian', 'bookmarks.json'), content, 'utf8')
  }

  test('a missing bookmarks.json is not an error — it degrades to an empty array', async () => {
    expect(await readBookmarks(root)).toEqual([])
  })

  test('malformed JSON is not an error — it degrades to an empty array', async () => {
    await writeBookmarksJson('{not json')
    expect(await readBookmarks(root)).toEqual([])
  })

  test('a top-level shape with no items array degrades to an empty array', async () => {
    await writeBookmarksJson(JSON.stringify({ notItems: [] }))
    expect(await readBookmarks(root)).toEqual([])
  })

  test('parses file, folder, and search entries, carrying title and ctime through', async () => {
    await writeBookmarksJson(
      JSON.stringify({
        items: [
          { type: 'file', ctime: 1776076040348, path: 'Areas/Health/Ernährungsplan.md' },
          { type: 'file', path: 'a.md', subpath: 'heading', title: 'Renamed' },
          { type: 'folder', path: 'Areas' },
          { type: 'search', query: 'tag:#health' },
        ],
      }),
    )

    const bookmarks = await readBookmarks(root)

    expect(bookmarks).toEqual([
      { type: 'file', ctime: 1776076040348, path: 'Areas/Health/Ernährungsplan.md' },
      { type: 'file', path: 'a.md', subpath: 'heading', title: 'Renamed' },
      { type: 'folder', path: 'Areas' },
      { type: 'search', query: 'tag:#health' },
    ])
  })

  test('parses a nested group, recursing into its items', async () => {
    await writeBookmarksJson(
      JSON.stringify({
        items: [
          {
            type: 'group',
            title: 'Reading',
            items: [
              { type: 'file', path: 'a.md' },
              { type: 'group', items: [{ type: 'file', path: 'b.md' }] },
            ],
          },
        ],
      }),
    )

    const bookmarks = await readBookmarks(root)

    expect(bookmarks).toEqual([
      {
        type: 'group',
        title: 'Reading',
        items: [
          { type: 'file', path: 'a.md' },
          { type: 'group', items: [{ type: 'file', path: 'b.md' }] },
        ],
      },
    ])
  })

  test('a group with no items becomes a group with an empty items array, not a drop', async () => {
    await writeBookmarksJson(JSON.stringify({ items: [{ type: 'group', title: 'Empty' }] }))
    expect(await readBookmarks(root)).toEqual([{ type: 'group', title: 'Empty', items: [] }])
  })

  test('an unknown type is dropped', async () => {
    await writeBookmarksJson(
      JSON.stringify({ items: [{ type: 'graph' }, { type: 'file', path: 'kept.md' }] }),
    )
    expect(await readBookmarks(root)).toEqual([{ type: 'file', path: 'kept.md' }])
  })

  test('a file entry missing path is dropped', async () => {
    await writeBookmarksJson(
      JSON.stringify({ items: [{ type: 'file' }, { type: 'file', path: 'kept.md' }] }),
    )
    expect(await readBookmarks(root)).toEqual([{ type: 'file', path: 'kept.md' }])
  })

  test('a folder entry missing path is dropped', async () => {
    await writeBookmarksJson(JSON.stringify({ items: [{ type: 'folder' }] }))
    expect(await readBookmarks(root)).toEqual([])
  })

  test('a search entry missing query is dropped', async () => {
    await writeBookmarksJson(JSON.stringify({ items: [{ type: 'search' }] }))
    expect(await readBookmarks(root)).toEqual([])
  })
})
