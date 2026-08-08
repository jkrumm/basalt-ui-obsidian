/**
 * Acceptance test against a real vault — gated on `OBSIDIAN_VAULT_FIXTURE` so it skips cleanly
 * when unset. Run explicitly with:
 *
 *   OBSIDIAN_VAULT_FIXTURE=/path/to/your/vault bun test
 *
 * The hard criterion is zero unresolved wikilinks with ignore filters disabled — the same
 * dead-link check `brain/.scripts/vault-lint.mjs` runs (currently 0 errors there), so any
 * unresolved link here means this resolver disagrees with that oracle.
 */
import { describe, expect, test } from 'bun:test'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { Blockquote, Image, Root } from 'mdast'

import { remarkObsidianCallout } from '../src/remark/callout.js'
import { remarkObsidianImageSize } from '../src/remark/image-size.js'
import { readVault } from '../src/vault-reader.js'

const VAULT = process.env['OBSIDIAN_VAULT_FIXTURE']
const run = VAULT !== undefined && VAULT.trim() !== '' ? describe : describe.skip

run('brain vault acceptance', () => {
  test('zero unresolved wikilinks; measured totals are non-zero', async () => {
    if (VAULT === undefined) return

    const index = await readVault(VAULT, { useObsidianIgnoreFilters: false })

    const unresolved: { path: string; raw: string }[] = []
    let totalLinks = 0
    let aliasedLinks = 0

    for (const note of index.notes) {
      for (const link of note.links) {
        totalLinks += 1
        if (link.alias !== undefined) aliasedLinks += 1
        if (link.resolvedPath === undefined) unresolved.push({ path: note.path, raw: link.raw })
      }
    }

    const processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkObsidianCallout)
      .use(remarkObsidianImageSize)

    let calloutCount = 0
    let imageSizeCount = 0

    for (const note of index.notes) {
      const tree = processor.runSync(processor.parse(note.body)) as Root

      visit(tree, 'blockquote', (node: Blockquote) => {
        if (node.data?.callout !== undefined) calloutCount += 1
      })
      visit(tree, 'image', (node: Image) => {
        if (typeof node.data?.hProperties?.['width'] === 'number') imageSizeCount += 1
      })
    }

    console.log('brain vault measured totals', {
      totalNotes: index.notes.length,
      totalLinks,
      aliasedLinks,
      calloutCount,
      imageSizeCount,
    })

    expect(unresolved).toEqual([])
    expect(index.notes.length).toBeGreaterThan(0)
    expect(totalLinks).toBeGreaterThan(0)
    expect(aliasedLinks).toBeGreaterThan(0)
    expect(calloutCount).toBeGreaterThan(0)
    expect(imageSizeCount).toBeGreaterThan(0)
  })
})
