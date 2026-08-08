import { describe, expect, test } from 'bun:test'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { Image, Root } from 'mdast'

import { remarkObsidianImageSize } from '../src/remark/image-size.js'

function run(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkObsidianImageSize)
  const tree = processor.parse(markdown)
  return processor.runSync(tree) as Root
}

function firstImage(tree: Root): Image | undefined {
  let found: Image | undefined
  visit(tree, 'image', (node: Image) => {
    found ??= node
  })
  return found
}

describe('remarkObsidianImageSize', () => {
  test('parses the plain `![|56](url)` form', () => {
    const image = firstImage(run('![|56](https://example.com/a.png)'))
    expect(image?.data?.hProperties?.['width']).toBe(56)
    expect(image?.data?.hProperties?.['height']).toBeUndefined()
    expect(image?.alt).toBe('')
  })

  test('parses width and height: `![|300x200](url)`', () => {
    const image = firstImage(run('![|300x200](https://example.com/a.png)'))
    expect(image?.data?.hProperties?.['width']).toBe(300)
    expect(image?.data?.hProperties?.['height']).toBe(200)
  })

  test('parses the backslash-escaped form used inside a table cell', () => {
    const table = [
      '| Item | Note |',
      '|---|---|',
      '| ![\\|28](https://example.com/a.png) | x |',
    ].join('\n')
    const image = firstImage(run(table))
    expect(image?.data?.hProperties?.['width']).toBe(28)
    expect(image?.alt).toBe('')
  })

  test('parses the backslash-escaped form with height inside a table cell', () => {
    const table = [
      '| Item | Note |',
      '|---|---|',
      '| ![\\|300x200](https://example.com/a.png) | x |',
    ].join('\n')
    const image = firstImage(run(table))
    expect(image?.data?.hProperties?.['width']).toBe(300)
    expect(image?.data?.hProperties?.['height']).toBe(200)
  })

  test('a non-matching alt text is left untouched', () => {
    const image = firstImage(run('![a real caption](https://example.com/a.png)'))
    expect(image?.alt).toBe('a real caption')
    expect(image?.data?.hProperties?.['width']).toBeUndefined()
  })

  test('an image with no alt at all is left untouched', () => {
    const image = firstImage(run('![](https://example.com/a.png)'))
    expect(image?.data?.hProperties?.['width']).toBeUndefined()
  })
})
