/**
 * Backlinks — the "Linked mentions" panel (Obsidian's own term for its backlinks pane), grouped
 * by source note. `VaultIndex.backlinks` can carry more than one link from the same source (e.g.
 * two `[[Target|alias]]` occurrences in one note); entries are grouped by `from` first, and each
 * group shows the surrounding SENTENCE from the source note's own body around its first occurrence
 * — not the target page's own display text, which is what an earlier version of this component
 * showed (every group's alias line read as this page's own title, printed once per group).
 */
import { Box, Stack, Text } from '@mantine/core'
import type { VaultBacklink, VaultLink } from 'obsidian-vault-core'
import { useVault } from '../context.js'

export type BacklinksProps = {
  readonly path: string
  readonly title?: string
  readonly className?: string
}

/** Groups backlinks by their source note path, preserving first-seen order. */
function groupBySource(
  backlinks: readonly VaultBacklink[],
): ReadonlyMap<string, readonly VaultBacklink[]> {
  const groups = new Map<string, VaultBacklink[]>()
  for (const backlink of backlinks) {
    const group = groups.get(backlink.from)
    if (group === undefined) groups.set(backlink.from, [backlink])
    else group.push(backlink)
  }
  return groups
}

/** How far (characters) a context window reaches on each side of `link.raw`'s occurrence before
 * trimming inward to the nearest sentence boundary — generous enough to usually contain a full
 * sentence on both sides without pulling in an unrelated paragraph. */
const CONTEXT_RADIUS = 120

/** Matches a sentence-ending `.`/`!`/`?` followed by whitespace or the string's end. */
const SENTENCE_END_RE = /[.!?](?=\s|$)/g

/**
 * `obsidian-vault-core`'s own wikilink bracket pattern (`links.ts`'s `WIKILINK_RE`) is
 * package-internal — not exported past `.`/`./remark`/`./search` — so a context snippet flattens
 * `[[...]]` syntax with a local copy of the same bracket shape rather than reaching past the
 * package's public surface for it. This only needs to match, not resolve — display text alone.
 */
const CONTEXT_WIKILINK_RE = /!?\[\[([^[\]|#]+)?(#[^[\]|#]+)?(\|[^[\]|#]*)?\]\]/g

function flattenContextWikilink(
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

/** Strips the markdown syntax a sentence-length window can plausibly contain. Not a full
 * flattener — tables, fenced code, … don't survive a short window intact anyway, and a "Linked
 * mentions" context line never needs to render them. */
function stripContextMarkdown(text: string): string {
  return text
    .replace(CONTEXT_WIKILINK_RE, flattenContextWikilink)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^#{1,6}\s+/, '') // heading marker
    .replace(/(\*\*\*|\*\*|\*|___|__|_|~~|`)/g, '') // emphasis/strikethrough/code markers
    .replace(/^\s*>+\s?/, '') // blockquote marker
    .replace(/^\s*[-*+]\s+/, '') // unordered list marker
    .replace(/^\s*\d+\.\s+/, '') // ordered list marker
    .replace(/\s+/g, ' ')
    .trim()
}

/** Indices of `SENTENCE_END_RE` matches within `text`, in order. */
function sentenceBoundaryIndices(text: string): number[] {
  const indices: number[] = []
  for (const match of text.matchAll(SENTENCE_END_RE)) {
    if (match.index !== undefined) indices.push(match.index)
  }
  return indices
}

/**
 * Extracts the sentence(s) surrounding `link`'s raw occurrence in `sourceBody` — the context a
 * human reading the LINKING note would see around the link, not the target page's own display
 * text. Returns `undefined` when `link.raw` cannot be located verbatim in `sourceBody` (a body
 * fetched in a different normalization than what produced `link.raw`, or a test fixture with an
 * empty body), so the caller can fall back to something honest instead of an empty snippet.
 */
export function extractBacklinkContext(sourceBody: string, link: VaultLink): string | undefined {
  const matchIndex = sourceBody.indexOf(link.raw)
  if (matchIndex === -1) return undefined

  const matchEnd = matchIndex + link.raw.length
  const windowStart = Math.max(0, matchIndex - CONTEXT_RADIUS)
  const windowEnd = Math.min(sourceBody.length, matchEnd + CONTEXT_RADIUS)
  const windowText = sourceBody.slice(windowStart, windowEnd)

  const relativeStart = matchIndex - windowStart
  const relativeEnd = relativeStart + link.raw.length
  const boundaries = sentenceBoundaryIndices(windowText)

  const leftBoundary =
    windowStart > 0 ? boundaries.filter((index) => index < relativeStart).at(-1) : undefined
  const rightBoundary =
    windowEnd < sourceBody.length ? boundaries.find((index) => index >= relativeEnd) : undefined

  const leftCut = leftBoundary !== undefined ? leftBoundary + 1 : 0
  const rightCut = rightBoundary !== undefined ? rightBoundary + 1 : windowText.length

  const snippet = stripContextMarkdown(windowText.slice(leftCut, rightCut))
  return snippet === '' ? undefined : snippet
}

export function Backlinks({ path, title = 'Linked mentions', className }: BacklinksProps) {
  const { index, hrefFor, renderLink } = useVault()
  const backlinks = index.backlinks.get(path) ?? []

  if (backlinks.length === 0) return null

  const groups = groupBySource(backlinks)

  return (
    <Box {...(className !== undefined && { className })}>
      <Text size="sm" fw={600} mb="xs">
        {title}
      </Text>
      <Stack gap="sm">
        {[...groups].map(([from, links]) => {
          const source = index.byPath.get(from)
          if (source === undefined) return null

          // `groupBySource` never stores an empty array — the guard is only here to satisfy
          // `noUncheckedIndexedAccess`, not because it can actually fire.
          const firstLink = links[0]
          const context =
            firstLink !== undefined
              ? extractBacklinkContext(source.body, firstLink.link)
              : undefined

          return (
            <Box key={from}>
              {renderLink(hrefFor(source), <Text size="sm">{source.title}</Text>)}
              <Text size="xs" c="dimmed" pl="md">
                {context ?? source.title}
              </Text>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
