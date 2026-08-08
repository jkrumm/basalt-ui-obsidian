import { describe, expect, test } from 'bun:test'

import { extractLinks, resolveLinkPath } from '../src/links.js'

describe('extractLinks', () => {
  test('extracts target, anchor, and alias', () => {
    const [link] = extractLinks('See [[wiki/engineering/index#Setup|Engineering (wiki)]] for more.')
    expect(link).toBeDefined()
    expect(link?.target).toBe('wiki/engineering/index')
    expect(link?.anchor).toBe('Setup')
    expect(link?.alias).toBe('Engineering (wiki)')
    expect(link?.embed).toBe(false)
  })

  test('marks a leading `!` as an embed', () => {
    const [link] = extractLinks('![[wiki/health/peptides/index]]')
    expect(link?.embed).toBe(true)
    expect(link?.target).toBe('wiki/health/peptides/index')
  })

  // Regression: Quartz's `(\|[^...]+)?` alias group requires at least one character, so
  // `[[target|]]` failed to match at all and the edge vanished from the backlink graph. Four such
  // links exist in the reference vault. An empty alias must degrade to "no alias", not to no link.
  test('an empty alias still yields a link, with the target as its own display text', () => {
    const links = extractLinks('see [[remote-dev-orchestration|]] for more')
    expect(links).toHaveLength(1)
    expect(links[0]?.target).toBe('remote-dev-orchestration')
    expect(links[0]?.alias).toBeUndefined()
  })

  test('a link may span a line break', () => {
    const links = extractLinks('([[unattended-boot-posture|unattended boot\nposture]]) trailing')
    expect(links).toHaveLength(1)
    expect(links[0]?.target).toBe('unattended-boot-posture')
  })

  test('a bare target has neither anchor nor alias', () => {
    const [link] = extractLinks('[[Reading List]]')
    expect(link?.target).toBe('Reading List')
    expect(link?.anchor).toBeUndefined()
    expect(link?.alias).toBeUndefined()
  })

  test('strips fenced code blocks before extracting', () => {
    const body = ['```', 'a link like [[Note]]', '```', 'real: [[Real Note]]'].join('\n')
    const links = extractLinks(body)
    expect(links).toHaveLength(1)
    expect(links[0]?.target).toBe('Real Note')
  })

  test('strips inline code spans before extracting', () => {
    const links = extractLinks('write it as `[[Note]]` — real link: [[Real Note]]')
    expect(links).toHaveLength(1)
    expect(links[0]?.target).toBe('Real Note')
  })

  test('multiple links on one line all extract', () => {
    const links = extractLinks('[[One]] and [[Two|Second]] and ![[Three]]')
    expect(links.map((link) => link.target)).toEqual(['One', 'Two', 'Three'])
  })
})

describe('resolveLinkPath', () => {
  const paths = [
    'wiki/index.md',
    'wiki/engineering/index.md',
    'wiki/engineering/keyboard.md',
    'Areas/Engineering/keyboard.md',
    'Areas/Health/Ernährungsplan.md',
  ]

  test('resolves a bare basename', () => {
    expect(resolveLinkPath('index', 'Areas/Health/foo.md', paths)).toBe('wiki/index.md')
  })

  test('resolves a slash-qualified target by suffix', () => {
    expect(resolveLinkPath('engineering/index', 'wiki/index.md', paths)).toBe(
      'wiki/engineering/index.md',
    )
  })

  test('is case-insensitive', () => {
    expect(resolveLinkPath('WIKI/INDEX', 'x.md', paths)).toBe('wiki/index.md')
  })

  test('a trailing .md on the target is tolerated', () => {
    expect(resolveLinkPath('wiki/index.md', 'x.md', paths)).toBe('wiki/index.md')
  })

  test('ties break toward the same folder as fromPath', () => {
    expect(resolveLinkPath('keyboard', 'Areas/Engineering/other.md', paths)).toBe(
      'Areas/Engineering/keyboard.md',
    )
    expect(resolveLinkPath('keyboard', 'wiki/engineering/other.md', paths)).toBe(
      'wiki/engineering/keyboard.md',
    )
  })

  test('ties with no folder match break toward the shortest path', () => {
    expect(resolveLinkPath('keyboard', 'Projects/foo.md', paths)).toBe(
      'wiki/engineering/keyboard.md',
    )
  })

  test('NFC-normalizes both sides — a decomposed target matches a composed path', () => {
    const decomposedTarget = 'Ernährungsplan'.normalize('NFD')
    expect(resolveLinkPath(decomposedTarget, 'x.md', paths)).toBe('Areas/Health/Ernährungsplan.md')
  })

  test('returns undefined for a dead link', () => {
    expect(resolveLinkPath('Nonexistent Note', 'x.md', paths)).toBeUndefined()
  })
})
