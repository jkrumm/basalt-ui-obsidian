/**
 * `remarkObsidianImageSize` — Obsidian encodes a display width (and optional height) in an
 * image's alt text: `![|56](url)` or, inside a markdown table cell where a bare `|` would split
 * the column, the pipe-escaped form `![\|56](url)` (optionally `![\|300x200](url)` for both
 * dimensions). Both forms are rewritten to `data.hProperties.width`/`.height` and the alt text is
 * cleared, so a renderer can size the `<img>` before it loads. This is the single highest-
 * frequency quirk in the target vault (479 occurrences).
 */
import { visit } from 'unist-util-visit'
import type { Image, Root } from 'mdast'

import './mdast-data.js'

const IMAGE_SIZE_ALT_RE = /^\\?\|(\d+)(?:x(\d+))?$/

export function remarkObsidianImageSize() {
  return (tree: Root): void => {
    visit(tree, 'image', (node: Image) => {
      const alt = node.alt ?? ''
      const match = IMAGE_SIZE_ALT_RE.exec(alt)
      if (match === null) return

      const [, widthText, heightText] = match
      if (widthText === undefined) return

      const width = Number.parseInt(widthText, 10)
      const height = heightText !== undefined ? Number.parseInt(heightText, 10) : undefined

      node.alt = ''
      node.data = {
        ...node.data,
        hProperties: {
          ...node.data?.hProperties,
          width,
          ...(height !== undefined ? { height } : {}),
        },
      }
    })
  }
}
