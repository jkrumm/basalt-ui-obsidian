import { describe, expect, test } from 'bun:test'

import { extractHeadings } from '../src/headings.js'

describe('extractHeadings', () => {
  test('extracts depth, text, and slug', () => {
    const [heading] = extractHeadings('# Top Heading\n\nSome text.')
    expect(heading).toEqual({ depth: 1, text: 'Top Heading', slug: 'top-heading' })
  })

  test('handles every depth 1-6', () => {
    const body = ['#', '##', '###', '####', '#####', '######']
      .map((hashes, index) => `${hashes} H${index + 1}`)
      .join('\n')
    const headings = extractHeadings(body)
    expect(headings.map((h) => h.depth)).toEqual([1, 2, 3, 4, 5, 6])
  })

  test('ignores headings inside fenced code blocks', () => {
    const body = ['```', '# Not a heading', '```', '# Real heading'].join('\n')
    const headings = extractHeadings(body)
    expect(headings).toHaveLength(1)
    expect(headings[0]?.text).toBe('Real heading')
  })

  test('dedupes repeated heading slugs within one note', () => {
    const body = '## Overview\n\ntext\n\n## Overview\n'
    const headings = extractHeadings(body)
    expect(headings.map((h) => h.slug)).toEqual(['overview', 'overview-1'])
  })

  test('a line of only hashes is not a heading', () => {
    expect(extractHeadings('###')).toHaveLength(0)
  })
})

// Regression: the closing-sequence pattern was `\s*#*\s*$`, which also ate a hash that is part of
// the heading TEXT. CommonMark requires whitespace before a closing sequence.
describe('trailing hashes', () => {
  test('a hash that is part of the text is kept', () => {
    expect(extractHeadings('# Learning C#')[0]?.text).toBe('Learning C#')
    expect(extractHeadings('## C#')[0]?.text).toBe('C#')
  })

  test('a real CommonMark closing sequence is still stripped', () => {
    expect(extractHeadings('## Setup ##')[0]?.text).toBe('Setup')
    expect(extractHeadings('### Deep   ###   ')[0]?.text).toBe('Deep')
  })
})
