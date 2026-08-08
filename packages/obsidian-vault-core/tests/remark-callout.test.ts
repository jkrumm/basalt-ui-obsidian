import { describe, expect, test } from 'bun:test'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { Blockquote, Root } from 'mdast'

import { OBSIDIAN_CALLOUT_KIND, remarkObsidianCallout } from '../src/remark/callout.js'

function run(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkObsidianCallout)
  const tree = processor.parse(markdown)
  return processor.runSync(tree) as Root
}

function firstBlockquote(tree: Root): Blockquote | undefined {
  let found: Blockquote | undefined
  visit(tree, 'blockquote', (node: Blockquote) => {
    found ??= node
  })
  return found
}

describe('remarkObsidianCallout', () => {
  test('a simple typed callout with a custom title', () => {
    const blockquote = firstBlockquote(run('> [!note] Zettel für die Praxis\n> body text'))
    expect(blockquote?.data?.callout).toEqual({
      type: 'note',
      kind: 'info',
      title: 'Zettel für die Praxis',
    })
    expect(blockquote?.data?.hProperties).toEqual({
      'data-callout': 'note',
      'data-callout-kind': 'info',
      'data-callout-title': 'Zettel für die Praxis',
    })
  })

  test('a fold marker (-) is captured', () => {
    const markdown = [
      '> [!info]- Karabiner setup — per machine, do this on every Mac',
      '> Two approvals, both needing a human at that Mac.',
    ].join('\n')
    const blockquote = firstBlockquote(run(markdown))
    expect(blockquote?.data?.callout?.fold).toBe('closed')
    expect(blockquote?.data?.callout?.title).toBe(
      'Karabiner setup — per machine, do this on every Mac',
    )
    expect(blockquote?.data?.hProperties?.['data-callout-fold']).toBe('closed')
    expect(blockquote?.data?.hProperties?.['data-callout-title']).toBe(
      'Karabiner setup — per machine, do this on every Mac',
    )
  })

  test('a fold marker (+) is captured as open', () => {
    const blockquote = firstBlockquote(run('> [!tip]+ Expand me\n> body'))
    expect(blockquote?.data?.callout?.fold).toBe('open')
    expect(blockquote?.data?.hProperties?.['data-callout-fold']).toBe('open')
  })

  test('a title split by inline bold formatting flattens to plain text', () => {
    const markdown =
      '> [!info] Spoiler horizon: **The Final Empire, through chapter 6** (currently reading ch. 7).\n> More body text.'
    const blockquote = firstBlockquote(run(markdown))
    expect(blockquote?.data?.callout?.title).toBe(
      'Spoiler horizon: The Final Empire, through chapter 6 (currently reading ch. 7).',
    )
  })

  test('a callout with no custom title has an undefined title', () => {
    const blockquote = firstBlockquote(run('> [!success]\n> just body'))
    expect(blockquote?.data?.callout?.title).toBeUndefined()
    expect(blockquote?.data?.callout?.type).toBe('success')
    expect(blockquote?.data?.hProperties).toEqual({
      'data-callout': 'success',
      'data-callout-kind': 'good',
    })
  })

  test('the marker line is stripped from the rendered blockquote content', () => {
    const blockquote = firstBlockquote(run('> [!note] Title here\n> Body line one.'))
    const paragraph = blockquote?.children[0]
    expect(paragraph?.type).toBe('paragraph')
    if (paragraph?.type === 'paragraph') {
      const text = paragraph.children[0]
      expect(text?.type).toBe('text')
      if (text?.type === 'text') expect(text.value).toBe('Body line one.')
    }
  })

  test('an unrecognized type falls back to info and still parses', () => {
    const blockquote = firstBlockquote(run('> [!totallymadeup] Title\n> body'))
    expect(blockquote?.data?.callout).toEqual({
      type: 'totallymadeup',
      kind: 'info',
      title: 'Title',
    })
  })

  test('type matching is case-insensitive', () => {
    const blockquote = firstBlockquote(run('> [!WARNING] Title\n> body'))
    expect(blockquote?.data?.callout?.kind).toBe('warn')
  })

  test('a plain blockquote (no marker) is left completely untouched', () => {
    const blockquote = firstBlockquote(run('> Just a quote.'))
    expect(blockquote?.data?.callout).toBeUndefined()
    expect(blockquote?.data?.hProperties).toBeUndefined()
  })

  test('aliases map to the same kind as their canonical type', () => {
    expect(OBSIDIAN_CALLOUT_KIND['hint']).toBe(OBSIDIAN_CALLOUT_KIND['tip'])
    expect(OBSIDIAN_CALLOUT_KIND['fail']).toBe(OBSIDIAN_CALLOUT_KIND['failure'])
    expect(OBSIDIAN_CALLOUT_KIND['faq']).toBe(OBSIDIAN_CALLOUT_KIND['question'])
  })

  test('a question callout with quoted text in the title', () => {
    const markdown =
      '> [!question] "Doesn\'t she have several sensible builds?" — no, and that is the finding\n> body'
    const blockquote = firstBlockquote(run(markdown))
    expect(blockquote?.data?.callout?.title).toBe(
      '"Doesn\'t she have several sensible builds?" — no, and that is the finding',
    )
  })
})
