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

// A GFM/Obsidian table header-separator row: `| --- | :--: | --- |` or Obsidian's terser `|-|-|-|`,
// with or without outer pipes.
const TABLE_SEPARATOR_ROW_RE = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/gm

// An Obsidian callout tag opening a blockquote line: `> [!tip]`, `> [!tip]+ Title`. Keeps the `>`
// prefix (group 1) so the existing blockquote-marker strip below still removes it uniformly.
const CALLOUT_TAG_RE = /^(\s*>+\s*)\[![\w-]+\][+-]?[ \t]*/gim

export function stripMarkdownToText(markdown: string): string {
  let text = stripFencedCode(markdown)

  text = text.replace(WIKILINK_RE, flattenWikilink)
  // Obsidian image-resize directive (`![|28](url)`, escaped `![\|28](url)` when it has to survive
  // inside a table cell — see the vault's own `vault-write.md` convention). Carries no real
  // caption, so drop the whole embed instead of leaking "28" or "\ 28" into the text.
  text = text.replace(/!\[\\?\|\d+(?:x\d+)?\]\([^)]*\)/g, '')
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // remaining images -> alt text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
  text = text.replace(TABLE_SEPARATOR_ROW_RE, '') // table header separator rows
  text = text.replace(/\|/g, ' ') // remaining table pipes -> cell separators
  text = text.replace(/^#{1,6}\s+/gm, '') // heading markers
  text = text.replace(/(\*\*\*|\*\*|\*|___|__|_|~~|`)/g, '') // emphasis/strikethrough/code markers
  text = text.replace(CALLOUT_TAG_RE, '$1') // callout tags, e.g. "> [!tip]" -> "> "
  text = text.replace(/^\s*>+\s?/gm, '') // blockquote markers
  text = text.replace(/^\s*[-*+]\s+/gm, '') // unordered list markers
  text = text.replace(/^\s*\d+\.\s+/gm, '') // ordered list markers
  text = text.replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, '') // horizontal rules
  text = text.replace(/[ \t]{2,}/g, ' ') // collapse runs of spaces left by stripped table pipes
  text = text.replace(/^[ \t]+|[ \t]+$/gm, '') // trim each line
  text = text.replace(/\n{2,}/g, '\n')

  return text.trim()
}
