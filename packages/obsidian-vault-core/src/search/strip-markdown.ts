/**
 * Light, regex-based markdown -> plain-text flattening for the search index's `text` field. Not a
 * renderer — good enough for a tokenizer, not for display. Unlike `text-utils.ts#stripCode` (used
 * for wikilink extraction, where code content must be dropped entirely so example syntax in prose
 * isn't mistaken for a real link), fenced blocks are dropped here but inline code markers are
 * stripped while KEEPING their text — `` `code` `` is worth indexing as "code".
 */
import { WIKILINK_RE } from '../links.js'

function stripFencedCode(content: string): string {
  const kept: string[] = []
  let inFence = false

  for (const line of content.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (!inFence) kept.push(line)
  }

  return kept.join('\n')
}

function flattenWikilink(
  _full: string,
  target: string | undefined,
  _anchor: string | undefined,
  alias: string | undefined,
): string {
  const aliasText = alias !== undefined ? alias.slice(1).trim() : ''
  if (aliasText !== '') return aliasText

  const targetText = (target ?? '').trim()
  const slashIndex = targetText.lastIndexOf('/')
  return slashIndex === -1 ? targetText : targetText.slice(slashIndex + 1)
}

export function stripMarkdownToText(markdown: string): string {
  let text = stripFencedCode(markdown)

  text = text.replace(WIKILINK_RE, flattenWikilink)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
  text = text.replace(/^#{1,6}\s+/gm, '') // heading markers
  text = text.replace(/(\*\*\*|\*\*|\*|___|__|_|~~|`)/g, '') // emphasis/strikethrough/code markers
  text = text.replace(/^\s*>+\s?/gm, '') // blockquote markers
  text = text.replace(/^\s*[-*+]\s+/gm, '') // unordered list markers
  text = text.replace(/^\s*\d+\.\s+/gm, '') // ordered list markers
  text = text.replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, '') // horizontal rules
  text = text.replace(/\n{2,}/g, '\n')

  return text.trim()
}
