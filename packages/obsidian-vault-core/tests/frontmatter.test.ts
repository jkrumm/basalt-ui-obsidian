import { describe, expect, test } from 'bun:test'

import { normalizeTags, parseFrontmatter } from '../src/frontmatter.js'

describe('parseFrontmatter', () => {
  test('splits a well-formed block and parses it', () => {
    const content = ['---', 'title: Hello', 'tags: [a, b]', '---', '', 'Body text.'].join('\n')
    const { frontmatter, body } = parseFrontmatter(content)
    expect(frontmatter['title']).toBe('Hello')
    expect(frontmatter['tags']).toEqual(['a', 'b'])
    expect(body).toBe('\nBody text.')
  })

  test('a block-list tags shape parses too', () => {
    const content = ['---', 'tags:', '  - a', '  - b', '---', 'Body.'].join('\n')
    const { frontmatter } = parseFrontmatter(content)
    expect(frontmatter['tags']).toEqual(['a', 'b'])
  })

  test('content without a leading --- has no frontmatter', () => {
    const { frontmatter, body } = parseFrontmatter('Just body text.')
    expect(frontmatter).toEqual({})
    expect(body).toBe('Just body text.')
  })

  test('an unterminated block falls back to no frontmatter, body unchanged', () => {
    const content = '---\ntitle: Hello\n\nBody without a closing delimiter.'
    const { frontmatter, body } = parseFrontmatter(content)
    expect(frontmatter).toEqual({})
    expect(body).toBe(content)
  })

  test('a malformed YAML block never throws — falls back to {} with the body still split', () => {
    const content = ['---', 'title: [unterminated', '---', 'Body.'].join('\n')
    expect(() => parseFrontmatter(content)).not.toThrow()
    const { frontmatter, body } = parseFrontmatter(content)
    expect(frontmatter).toEqual({})
    expect(body).toBe('Body.')
  })

  test('status is passed through untouched, commas and all', () => {
    const content = [
      '---',
      'status: "in progress — blocked on X, Y (see notes)"',
      '---',
      'Body.',
    ].join('\n')
    const { frontmatter } = parseFrontmatter(content)
    expect(frontmatter['status']).toBe('in progress — blocked on X, Y (see notes)')
  })
})

describe('normalizeTags', () => {
  test('an array of strings passes through', () => {
    expect(normalizeTags(['a', 'b'])).toEqual(['a', 'b'])
  })

  test('a bare string becomes a single-element array', () => {
    expect(normalizeTags('solo')).toEqual(['solo'])
  })

  test('an empty string becomes an empty array', () => {
    expect(normalizeTags('')).toEqual([])
  })

  test('undefined becomes an empty array', () => {
    expect(normalizeTags(undefined)).toEqual([])
  })

  test('a non-array, non-string value becomes an empty array', () => {
    expect(normalizeTags(42)).toEqual([])
  })
})
