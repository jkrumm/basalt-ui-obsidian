/**
 * `remarkObsidianCallout` — detects an Obsidian callout (a blockquote whose first paragraph opens
 * with `[!type]`, optionally `+`/`-` fold state, optionally a same-line custom title) and attaches
 * `node.data.callout` with the parsed type/kind/fold/title, ALSO mirrored into
 * `node.data.hProperties` as `data-callout`/`data-callout-kind`/`data-callout-title`/
 * `data-callout-fold` (see the comment at the write site for why both forms exist). The marker
 * (and title line) are stripped from the blockquote's own content so a renderer doesn't render
 * them twice.
 */
import { visit } from 'unist-util-visit'
import type { Blockquote, Paragraph, PhrasingContent, Root } from 'mdast'

import './mdast-data.js'
import type { CalloutKind } from './mdast-data.js'

export type { CalloutKind, ObsidianCalloutData } from './mdast-data.js'

// TODO: re-verify this canonical type/alias list against https://help.obsidian.md/callouts — I
// could not source it authoritatively while implementing this. Buckets follow Obsidian's own
// color grouping (blue/teal/purple/gray -> info, green -> good, orange -> warn, red -> bad).
export const OBSIDIAN_CALLOUT_KIND: Readonly<Record<string, CalloutKind>> = {
  note: 'info',
  abstract: 'info',
  summary: 'info',
  tldr: 'info',
  info: 'info',
  todo: 'info',
  example: 'info',
  quote: 'info',
  cite: 'info',
  tip: 'good',
  hint: 'good',
  important: 'good',
  success: 'good',
  check: 'good',
  done: 'good',
  question: 'warn',
  help: 'warn',
  faq: 'warn',
  warning: 'warn',
  caution: 'warn',
  attention: 'warn',
  failure: 'bad',
  fail: 'bad',
  missing: 'bad',
  danger: 'bad',
  error: 'bad',
  bug: 'bad',
}

const CALLOUT_MARKER_RE = /^\[!([A-Za-z][\w-]*)\]([+-])?[ \t]*/

/** Flattens the plain-text content of an inline mdast node — used to build the `title` string. */
function flattenInlineText(node: PhrasingContent): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if ('children' in node) {
    return node.children.map((child) => flattenInlineText(child)).join('')
  }
  return ''
}

type TitleExtraction = {
  readonly title: string
  readonly remaining: PhrasingContent[]
}

/**
 * Splits the callout marker line (title text) off the first paragraph. The marker always lives in
 * the paragraph's first text child; the title continues either within that same text node (up to
 * its first embedded newline — remark keeps multi-line blockquote paragraphs as one text run) or,
 * when inline formatting (`**bold**`, links, …) sits on the marker line, across as many following
 * siblings as have no embedded newline of their own.
 */
function extractCalloutTitle(paragraph: Paragraph, markerLength: number): TitleExtraction {
  const children = paragraph.children
  const first = children[0]
  if (first === undefined || first.type !== 'text') return { title: '', remaining: children }

  const value = first.value.slice(markerLength)
  const newlineIndex = value.indexOf('\n')

  if (newlineIndex !== -1) {
    const title = value.slice(0, newlineIndex).trim()
    const rest = value.slice(newlineIndex + 1)
    const remaining: PhrasingContent[] = rest === '' ? [] : [{ type: 'text', value: rest }]
    remaining.push(...children.slice(1))
    return { title, remaining }
  }

  let title = value
  for (let index = 1; index < children.length; index++) {
    const sibling = children[index]
    if (sibling === undefined) break

    const siblingNewline = sibling.type === 'text' ? sibling.value.indexOf('\n') : -1
    if (sibling.type === 'text' && siblingNewline !== -1) {
      title += sibling.value.slice(0, siblingNewline)
      const rest = sibling.value.slice(siblingNewline + 1)
      const remaining: PhrasingContent[] = rest === '' ? [] : [{ type: 'text', value: rest }]
      remaining.push(...children.slice(index + 1))
      return { title: title.trim(), remaining }
    }

    title += flattenInlineText(sibling)
  }

  return { title: title.trim(), remaining: [] }
}

export function remarkObsidianCallout() {
  return (tree: Root): void => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0]
      if (first === undefined || first.type !== 'paragraph') return

      const firstText = first.children[0]
      if (firstText === undefined || firstText.type !== 'text') return

      const markerMatch = CALLOUT_MARKER_RE.exec(firstText.value)
      if (markerMatch === null) return

      const [full, rawType, foldMarker] = markerMatch
      if (full === undefined || rawType === undefined) return

      const kind = OBSIDIAN_CALLOUT_KIND[rawType.toLowerCase()] ?? 'info'
      const fold = foldMarker === '+' ? 'open' : foldMarker === '-' ? 'closed' : undefined

      const { title, remaining } = extractCalloutTitle(first, full.length)
      const restChildren = node.children.slice(1)
      node.children =
        remaining.length > 0 ? [{ ...first, children: remaining }, ...restChildren] : restChildren

      node.data = {
        ...node.data,
        callout: {
          type: rawType,
          kind,
          ...(fold !== undefined ? { fold } : {}),
          ...(title !== '' ? { title } : {}),
        },
        // `remark-rehype` does NOT carry arbitrary mdast `data.*` through to hast — only
        // `data.hProperties` survives the mdast -> hast boundary, becoming element attributes. The
        // typed `data.callout` above is mdast-only and would otherwise vanish before a renderer's
        // `blockquote` override (which only ever sees the hast node) gets a chance to read it, so
        // the same fields are duplicated here as string hast attributes.
        hProperties: {
          ...node.data?.hProperties,
          'data-callout': rawType,
          'data-callout-kind': kind,
          ...(fold !== undefined ? { 'data-callout-fold': fold } : {}),
          ...(title !== '' ? { 'data-callout-title': title } : {}),
        },
      }
    })
  }
}
