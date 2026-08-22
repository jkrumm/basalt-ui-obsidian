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
 * The name collides with `basalt-ui/content`'s own `SlugTracker` class, which basalt-ui 1.21.0
 * started reporting when `shadow-basalt-export` widened to read all nine barrels. It is a
 * collision, not a fork: this package is React-free by design and cannot depend on basalt-ui at
 * all, so there is nothing here to import from there. The annotation must be the comment line
 * IMMEDIATELY above the reported line, so the rationale lives here and the waiver below.
 */
// theme-allow shadow-basalt-export — React-free package; basalt-ui is not importable here
export class SlugTracker {
  private readonly counts = new Map<string, number>()

  slug(text: string): string {
    const base = slugify(text)
    const seen = this.counts.get(base) ?? 0
    this.counts.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${seen}`
  }
}
