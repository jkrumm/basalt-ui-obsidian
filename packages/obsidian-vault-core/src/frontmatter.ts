/**
 * Frontmatter splitting + parsing. Splits a leading `---\n...\n---\n` block off a note's raw
 * content and parses it with `yaml`. Never throws: a missing/unterminated block, or a block that
 * fails to parse, both fall back to an empty frontmatter object rather than failing the read.
 */
import { parse as parseYaml } from 'yaml'

export type ParsedFrontmatter = {
  readonly frontmatter: Readonly<Record<string, unknown>>
  readonly body: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const match = FRONTMATTER_RE.exec(content)
  if (match === null) return { frontmatter: {}, body: content }

  const [full, block] = match
  if (full === undefined) return { frontmatter: {}, body: content }

  // The body is correctly split by the delimiters regardless of whether the YAML inside them
  // is valid — only the parsed frontmatter object falls back to `{}` on a YAML error.
  const body = content.slice(full.length)

  try {
    const parsed: unknown = parseYaml(block ?? '')
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { frontmatter: {}, body }
    }
    return { frontmatter: parsed as Record<string, unknown>, body }
  } catch {
    return { frontmatter: {}, body }
  }
}

/**
 * Normalizes `frontmatter.tags` to a string array, tolerating both YAML shapes seen in real
 * vaults (a block list, and an inline `[a, b]` array) plus a bare string. Any other value, or a
 * missing key, becomes an empty array. Does not mutate or otherwise touch `frontmatter` itself —
 * every other key is passed through completely untouched, unvalidated.
 */
export function normalizeTags(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry))
  if (typeof value === 'string' && value.trim().length > 0) return [value]
  return []
}
