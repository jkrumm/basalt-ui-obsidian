/**
 * `highlightSegments` — splits a display string (a hit's title or snippet) into matched/unmatched
 * runs against a search query, for a caller to render `<mark>` around. Framework-free: returns
 * plain data, no JSX, so the presentation layer (`vault-search-spotlight.tsx`) owns how a matched
 * segment actually renders.
 *
 * Matching is a plain diacritic-folded, case-insensitive `indexOf` per query term — never a
 * `RegExp` built from the query — so a stray `(`, `*`, or other regex metacharacter in what the
 * user typed can't throw or match unpredictably. Folding both sides means `Ernahrung` highlights
 * `Ernährung` in the displayed (still-accented) text.
 */
import { foldDiacritics } from './fold-diacritics.js'

export type HighlightSegment = {
  readonly text: string
  readonly matched: boolean
}

function queryTerms(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((term) => foldDiacritics(term.toLowerCase()))
    .filter((term) => term !== '')
}

/** Splits `text` into matched/unmatched segments against every term in `query`. Relies on
 * `foldDiacritics` being length-preserving (see its own doc) to map ranges found in the folded
 * text back onto the original, still-accented `text` unchanged. */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const terms = queryTerms(query)
  if (terms.length === 0 || text === '') return [{ text, matched: false }]

  const folded = foldDiacritics(text.toLowerCase())
  const matched = Array.from<boolean>({ length: text.length }).fill(false)

  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = folded.indexOf(term, from)
      if (at === -1) break
      matched.fill(true, at, Math.min(at + term.length, matched.length))
      from = at + term.length
    }
  }

  const segments: HighlightSegment[] = []
  let i = 0
  while (i < text.length) {
    const state = matched[i] ?? false
    let j = i + 1
    while (j < text.length && (matched[j] ?? false) === state) j += 1
    segments.push({ text: text.slice(i, j), matched: state })
    i = j
  }
  return segments
}
