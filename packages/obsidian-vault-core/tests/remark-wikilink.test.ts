import { describe, expect, test } from 'bun:test'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { Link, Paragraph, Root, Text } from 'mdast'

import { remarkObsidianWikilink } from '../src/remark/wikilink.js'

function run(
  markdown: string,
  resolve: (target: string, anchor?: string) => string | undefined,
): Root {
  const processor = unified().use(remarkParse).use(remarkObsidianWikilink, { resolve })
  const tree = processor.parse(markdown)
  return processor.runSync(tree) as Root
}

function firstParagraphChildren(tree: Root) {
  const paragraph = tree.children[0] as Paragraph
  return paragraph.children
}

describe('remarkObsidianWikilink', () => {
  test('a resolved link becomes a link node with the resolved url', () => {
    const tree = run('[[wiki/engineering/index|Engineering]]', () => '/wiki/engineering')
    const [link] = firstParagraphChildren(tree)
    expect(link?.type).toBe('link')
    const linkNode = link as Link
    expect(linkNode.url).toBe('/wiki/engineering')
    expect((linkNode.children[0] as Text).value).toBe('Engineering')
    expect(linkNode.data?.hProperties?.['data-wikilink']).toBe('')
  })

  test('absent alias uses the target last path segment as link text', () => {
    const tree = run('[[wiki/engineering/index]]', () => '/wiki/engineering')
    const linkNode = firstParagraphChildren(tree)[0] as Link
    expect((linkNode.children[0] as Text).value).toBe('index')
  })

  // Regression: `resolve` is handed the anchor AND the plugin used to append `#${anchor}` again,
  // so every anchored link resolved to `/note#Heading#Heading`. `resolve` owns the whole href.
  test('the resolved url is used verbatim — the plugin never appends the anchor itself', () => {
    const tree = run(
      '[[wiki/index#Setup]]',
      (target, anchor) => `/${target}${anchor !== undefined ? `#${anchor.toLowerCase()}` : ''}`,
    )
    const linkNode = firstParagraphChildren(tree)[0] as Link
    expect(linkNode.url).toBe('/wiki/index#setup')
  })

  test('a resolver that ignores the anchor gets no fragment bolted on', () => {
    const tree = run('[[Note#Heading]]', (target) => `/${target}`)
    expect((firstParagraphChildren(tree)[0] as Link).url).toBe('/Note')
  })

  // Regression: the plugin carried a private copy of the wikilink pattern whose alias group was
  // `+`, so `[[target|]]` matched in `extractLinks` but not here — the index counted an edge the
  // renderer then failed to draw.
  test('an empty alias resolves like a bare link', () => {
    const tree = run('[[remote-dev-orchestration|]]', (target) => `/${target}`)
    const linkNode = firstParagraphChildren(tree)[0] as Link
    expect(linkNode.type).toBe('link')
    expect(linkNode.url).toBe('/remote-dev-orchestration')
    expect((linkNode.children[0] as Text).value).toBe('remote-dev-orchestration')
  })

  test('an unresolved link becomes a plain text node, not a link', () => {
    const tree = run('[[Dead Note]]', () => undefined)
    const [node] = firstParagraphChildren(tree)
    expect(node?.type).toBe('text')
    expect((node as Text).value).toBe('Dead Note')
  })

  test('resolve receives the target and anchor separately', () => {
    let received: [string, string | undefined] | undefined
    run('[[Note#Heading]]', (target, anchor) => {
      received = [target, anchor]
      return '/note'
    })
    expect(received).toEqual(['Note', 'Heading'])
  })
})
