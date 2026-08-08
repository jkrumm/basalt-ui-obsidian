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

/** Dedupes repeated slugs within one document. Create one instance per note. */
export class SlugTracker {
  private readonly counts = new Map<string, number>()

  slug(text: string): string {
    const base = slugify(text)
    const seen = this.counts.get(base) ?? 0
    this.counts.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${seen}`
  }
}
