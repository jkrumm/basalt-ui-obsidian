import { describe, expect, test } from 'bun:test'
import { mergeSanitizeSchema } from 'basalt-ui/content'
import type { SanitizeSchemaInput } from 'basalt-ui/content'
import { defaultSchema, sanitize } from 'hast-util-sanitize'
import type { Element } from 'hast'

import { OBSIDIAN_SANITIZE_SCHEMA } from '../src/render/sanitize-schema.js'

// A minimal stand-in for `rehype-sanitize`'s real `defaultSchema`, for the pure-composition half
// of these tests. The second half runs the REAL sanitizer, because composition alone cannot catch
// a wrong attribute SPELLING: an earlier version of this schema listed the camelCase hast property
// names (`dataCalloutKind`), which merges perfectly and then matches nothing, silently stripping
// every callout attribute. Only running the sanitizer catches that.
const BASE: SanitizeSchemaInput = {
  tagNames: ['blockquote', 'a', 'img', 'p'],
  attributes: {
    a: ['href'],
    img: ['src', 'alt'],
    '*': ['className'],
  },
}

describe('OBSIDIAN_SANITIZE_SCHEMA', () => {
  test('allow-lists the Obsidian data attributes plus width/height, additively', () => {
    const merged = mergeSanitizeSchema(BASE, OBSIDIAN_SANITIZE_SCHEMA)

    expect(merged.attributes?.['blockquote']).toEqual([
      'data-callout',
      'data-callout-kind',
      'data-callout-title',
      'data-callout-fold',
    ])
    expect(merged.attributes?.['a']).toContain('href')
    expect(merged.attributes?.['a']).toContain('data-wikilink')
    expect(merged.attributes?.['img']).toEqual(['src', 'alt', 'width', 'height'])
  })

  // The regression that motivated installing `rehype-sanitize` at all. `hProperties` reaches
  // `node.properties` verbatim, so `data-*` keys stay DASHED — `property-information`'s camelCase
  // folding only covers known HTML properties. A camelCase entry merges cleanly and strips
  // everything, so this asserts against the real sanitizer, not the merge.
  test('the real sanitizer keeps the attributes — the dashed spelling is the one that matches', () => {
    const schema = mergeSanitizeSchema(
      defaultSchema as SanitizeSchemaInput,
      OBSIDIAN_SANITIZE_SCHEMA,
    )
    const node: Element = {
      type: 'element',
      tagName: 'blockquote',
      properties: {
        'data-callout': 'info',
        'data-callout-kind': 'info',
        'data-callout-title': 'Karabiner setup',
        'data-callout-fold': 'closed',
        'data-not-allowed': 'x',
      },
      children: [],
    }

    const out = sanitize(node, schema as never) as Element

    expect(out.properties['data-callout-kind']).toBe('info')
    expect(out.properties['data-callout-title']).toBe('Karabiner setup')
    expect(out.properties['data-callout-fold']).toBe('closed')
    expect(out.properties['data-not-allowed']).toBeUndefined()
  })

  test('does not become a blanket allow — an attribute the extension never named stays absent', () => {
    const merged = mergeSanitizeSchema(BASE, OBSIDIAN_SANITIZE_SCHEMA)
    const blockquoteNames = (merged.attributes?.['blockquote'] ?? []).map((entry) =>
      typeof entry === 'string' ? entry : entry[0],
    )

    expect(blockquoteNames).not.toContain('onClick')
    expect(blockquoteNames).not.toContain('style')
    expect(merged.attributes?.['p']).toBeUndefined()
  })
})
