import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { collectSortingSpecs, parseSortingSpec, readFolderIcons } from '../src/nav-config.js'
import type { VaultNote } from '../src/types.js'

function note(overrides: Partial<VaultNote> = {}): VaultNote {
  return {
    path: 'a.md',
    slug: 'a',
    basename: 'a',
    title: 'A',
    frontmatter: {},
    body: '',
    headings: [],
    links: [],
    tags: [],
    ...overrides,
  }
}

// The exact block the brain vault's own sortspec.md carries (see the frontmatter's `sorting-spec:
// |` key) — by the time `parseSortingSpec` sees it, `yaml` has already turned the `|` block scalar
// into this plain multi-line string.
const BRAIN_SPEC = 'target-folder: /\nInbox\nProjects\nAreas\nwiki\n'

describe('parseSortingSpec', () => {
  test('parses the real brain vault spec', () => {
    const result = parseSortingSpec(BRAIN_SPEC)
    expect([...result.entries()]).toEqual([['', ['Inbox', 'Projects', 'Areas', 'wiki']]])
  })

  test('parses multiple target-folder blocks into separate entries', () => {
    const spec = [
      'target-folder: /',
      'Inbox',
      'Areas',
      'target-folder: Areas',
      'Engineering',
      'Health',
    ].join('\n')

    const result = parseSortingSpec(spec)
    expect(result.get('')).toEqual(['Inbox', 'Areas'])
    expect(result.get('Areas')).toEqual(['Engineering', 'Health'])
  })

  test('a rooted nested target-folder (leading AND trailing slash) normalizes to the bare folder path', () => {
    const spec = ['target-folder: /', 'Inbox', 'target-folder: /Areas/Photography/', 'b', 'a'].join(
      '\n',
    )

    const result = parseSortingSpec(spec)
    // Regression: a naive `target === '/' ? '' : target` only normalized the bare-root case, so
    // `/Areas/Photography` never matched `buildTree`'s unslashed folder-path keys and the whole
    // block silently no-op'd.
    expect([...result.keys()]).toEqual(['', 'Areas/Photography'])
    expect(result.get('Areas/Photography')).toEqual(['b', 'a'])
  })

  test('a rooted target-folder with no trailing slash also normalizes correctly', () => {
    const result = parseSortingSpec('target-folder: /Areas\nEngineering\n')
    expect(result.get('Areas')).toEqual(['Engineering'])
  })

  test('skips advanced-syntax lines instead of misreading them as a child name', () => {
    const spec = [
      'target-folder: /',
      'Inbox',
      '< some-priority-marker',
      '> another-marker',
      '%%comment-marker%%',
      '/regex-target/',
      '... collapsed range ...',
      'Areas',
    ].join('\n')

    const result = parseSortingSpec(spec)
    expect(result.get('')).toEqual(['Inbox', 'Areas'])
  })

  test('skips blank lines and # comments', () => {
    const spec = 'target-folder: /\nInbox\n\n# a comment\nAreas\n'
    expect(parseSortingSpec(spec).get('')).toEqual(['Inbox', 'Areas'])
  })

  test('a bare line before any target-folder is dropped, not thrown', () => {
    const spec = 'Orphan\ntarget-folder: /\nInbox\n'
    expect(parseSortingSpec(spec).get('')).toEqual(['Inbox'])
  })

  test('garbage input parses to an empty map rather than throwing', () => {
    expect([...parseSortingSpec('').entries()]).toEqual([])
    expect([...parseSortingSpec('not a spec at all\njust prose').entries()]).toEqual([])
    expect([...parseSortingSpec('\n\n   \n').entries()]).toEqual([])
  })

  test('"/" scopes to the vault root, i.e. the empty path', () => {
    const result = parseSortingSpec('target-folder: /\nInbox\n')
    expect(result.has('')).toBe(true)
    expect(result.has('/')).toBe(false)
  })
})

describe('collectSortingSpecs', () => {
  test('scans every note frontmatter for a string sorting-spec key, not a hardcoded filename', () => {
    const specNote = note({
      path: 'any-name-works.md',
      frontmatter: { 'sorting-spec': BRAIN_SPEC },
    })
    const plainNote = note({ path: 'plain.md' })

    const result = collectSortingSpecs([plainNote, specNote])
    expect(result.get('')).toEqual(['Inbox', 'Projects', 'Areas', 'wiki'])
  })

  test('a non-string sorting-spec value is ignored', () => {
    const oddNote = note({
      path: 'odd.md',
      frontmatter: { 'sorting-spec': ['not', 'a', 'string'] },
    })
    expect([...collectSortingSpecs([oddNote]).entries()]).toEqual([])
  })

  test('no note carries a sorting-spec key -> empty map', () => {
    expect([...collectSortingSpecs([note()]).entries()]).toEqual([])
  })

  test('merges specs from multiple notes', () => {
    const rootSpec = note({
      path: 'root.md',
      frontmatter: { 'sorting-spec': 'target-folder: /\nA\n' },
    })
    const nestedSpec = note({
      path: 'nested.md',
      frontmatter: { 'sorting-spec': 'target-folder: Areas\nX\n' },
    })

    const result = collectSortingSpecs([rootSpec, nestedSpec])
    expect(result.get('')).toEqual(['A'])
    expect(result.get('Areas')).toEqual(['X'])
  })
})

describe('readFolderIcons', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ovc-icons-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function writeIconizeData(content: string): Promise<void> {
    const dir = join(root, '.obsidian', 'plugins', 'obsidian-icon-folder')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'data.json'), content, 'utf8')
  }

  test('a missing data.json is not an error — it degrades to an empty map', async () => {
    const icons = await readFolderIcons(root)
    expect([...icons.entries()]).toEqual([])
  })

  test('malformed JSON is not an error — it degrades to an empty map', async () => {
    await writeIconizeData('{not json')
    const icons = await readFolderIcons(root)
    expect([...icons.entries()]).toEqual([])
  })

  test('the reserved settings key is skipped; every other string entry is kept', async () => {
    await writeIconizeData(
      JSON.stringify({
        settings: { fontSize: 16 },
        Inbox: 'LiInbox',
        Projects: 'LiHammer',
        Areas: 'LiLightbulb',
        'Areas/Engineering': 'LiHammer',
      }),
    )

    const icons = await readFolderIcons(root)
    expect(icons.has('settings')).toBe(false)
    expect(icons.get('Inbox')).toBe('LiInbox')
    expect(icons.get('Areas/Engineering')).toBe('LiHammer')
    expect(icons.size).toBe(4)
  })

  test('a non-string value is skipped rather than surfaced as an icon name', async () => {
    await writeIconizeData(JSON.stringify({ Weird: { nested: true } }))
    const icons = await readFolderIcons(root)
    expect(icons.has('Weird')).toBe(false)
  })

  test('a top-level JSON array degrades to an empty map', async () => {
    await writeIconizeData('[]')
    const icons = await readFolderIcons(root)
    expect([...icons.entries()]).toEqual([])
  })

  test('a NON-empty top-level JSON array is rejected, not read as numeric-keyed icons', async () => {
    // `Object.entries(['LiCamera', 'LiBook'])` yields `[['0', 'LiCamera'], ['1', 'LiBook']]` —
    // without an explicit `Array.isArray` guard this would silently produce a bogus icon map keyed
    // by array index instead of being rejected as the wrong shape entirely.
    await writeIconizeData(JSON.stringify(['LiCamera', 'LiBook']))
    const icons = await readFolderIcons(root)
    expect([...icons.entries()]).toEqual([])
  })
})
