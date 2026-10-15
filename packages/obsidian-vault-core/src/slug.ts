/**
 * Heading slugs. Unicode-aware (letters/digits/marks from any script survive — the target vault
 * has headings like `Hinweise für klare Haut`): lowercase, strip punctuation, collapse whitespace
 * to `-`. `SlugTracker` dedupes repeated slugs within one note the way Obsidian/GitHub do
 * (`-1`, `-2`, … on the second/third occurrence).
 */

const PUNCTUATION_RE = /[^\p{L}\p{M}\p{N}\- ]+/gu
const WHITESPACE_RE = /\s+/g
const REPEAT_HYPHENS_RE = /-+/g
const EDGE_HYPHENS_RE = /^-+|-+$/g

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(PUNCTUATION_RE, '')
    .replace(WHITESPACE_RE, '-')
    .replace(REPEAT_HYPHENS_RE, '-')
    .replace(EDGE_HYPHENS_RE, '')
}

/**
 * Dedupes repeated slugs within one document. Create one instance per note.
 *
 * Same algorithm as the heading ids `basalt-ui/content`'s `Markdown` renders (`headingSlug` plus a
 * per-document `-1`, `-2` dedupe), which is what keeps a wikilink anchor and the `TableOfContents`
 * target pointing at the same id. basalt-ui 2.x no longer exports its own `SlugTracker`, and this
 * package is React-free by design and could not import it anyway, so the two stay separate copies
 * of one rule.
 */
export class SlugTracker {
  private readonly counts = new Map<string, number>()

  slug(text: string): string {
    const base = slugify(text)
    const seen = this.counts.get(base) ?? 0
    this.counts.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${seen}`
  }
}
