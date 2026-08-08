import { describe, expect, test } from 'bun:test'

import { slugify, SlugTracker } from '../src/slug.js'

describe('slugify', () => {
  test('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  test('strips punctuation', () => {
    expect(slugify('What?! Really...')).toBe('what-really')
  })

  test('is Unicode-aware — non-ASCII letters survive', () => {
    expect(slugify('Hinweise für klare Haut')).toBe('hinweise-für-klare-haut')
  })

  test('collapses repeated whitespace/hyphens and trims edges', () => {
    expect(slugify('  a   b  ')).toBe('a-b')
  })
})

describe('SlugTracker', () => {
  test('dedupes repeated slugs with -1, -2, …', () => {
    const tracker = new SlugTracker()
    expect(tracker.slug('Setup')).toBe('setup')
    expect(tracker.slug('Setup')).toBe('setup-1')
    expect(tracker.slug('Setup')).toBe('setup-2')
  })

  test('different headings that slugify the same also dedupe', () => {
    const tracker = new SlugTracker()
    expect(tracker.slug('Hello World')).toBe('hello-world')
    expect(tracker.slug('Hello, World!')).toBe('hello-world-1')
  })
})
