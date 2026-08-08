/**
 * `buildSnippet` — a short excerpt of a note's plain-text body around the first hit on a query, for
 * display under a search result. Framework-free (no React) so it lives here rather than in
 * `basalt-ui-obsidian`'s `useVaultSearch`, which used to carry its own, weaker duplicate of this
 * logic (`toPlainText`/`snippetFrom`) — the divergence between that and `stripMarkdownToText` (used
 * for the indexed `text` field) was exactly why raw markdown leaked into snippets. One
 * implementation now backs both the index and the display snippet.
 */
import { foldDiacritics } from './fold-diacritics.js'
import { stripMarkdownToText } from './strip-markdown.js'

const SNIPPET_LENGTH = 140
const SNIPPET_LEAD = 40

/**
 * Drops a leading occurrence of the note's own `title` from `text` — many notes open with an H1
 * that repeats the frontmatter title, which after `stripMarkdownToText` left every snippet starting
 * with "Peptide Persönliche Wissensbasis…" (title, then the real body). Diacritic-folded and
 * case-insensitive so this also catches a title written with different accenting.
 *
 * Tries the full title first, then the title with a trailing parenthetical stripped (`"Collagen
 * peptides (oral) + Vitamin C"` -> `"Collagen peptides + Vitamin C"`) — a common pattern where the
 * frontmatter title carries a qualifier the H1 doesn't repeat.
 */
function dropLeadingTitle(text: string, title: string): string {
  const trimmedTitle = title.trim()
  if (trimmedTitle === '') return text

  const foldedText = foldDiacritics(text.toLowerCase())
  const candidates = [trimmedTitle, trimmedTitle.replace(/\s*\([^)]*\)/g, '').trim()]

  for (const candidate of candidates) {
    if (candidate === '') continue
    if (foldedText.startsWith(foldDiacritics(candidate.toLowerCase()))) {
      return text.slice(candidate.length).trimStart()
    }
  }

  return text
}

/** A short excerpt of `body`'s plain text around the first hit on `query`, or its start when
 * there's no match. Diacritic-folded so a query typed without accents (`Ernahrung`) still centers
 * the excerpt on the accented match (`Ernährung`) instead of falling back to the note's start. */
export function buildSnippet(body: string, title: string, query: string): string | undefined {
  const text = dropLeadingTitle(stripMarkdownToText(body), title)
  if (text === '') return undefined

  const firstTerm = query.trim().split(/\s+/)[0]
  const term =
    firstTerm !== undefined && firstTerm !== '' ? foldDiacritics(firstTerm.toLowerCase()) : ''
  const matchAt = term !== '' ? foldDiacritics(text.toLowerCase()).indexOf(term) : -1

  const start = matchAt === -1 ? 0 : Math.max(0, matchAt - SNIPPET_LEAD)
  const excerpt = text.slice(start, start + SNIPPET_LENGTH).trim()
  return start > 0 ? `…${excerpt}` : excerpt
}
