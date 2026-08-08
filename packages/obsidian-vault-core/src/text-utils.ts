/**
 * Small text-processing helpers shared by link extraction and heading extraction. Not part of the
 * public surface.
 */

const FENCE_RE = /^\s*(```|~~~)/
const INLINE_CODE_RE = /`[^`]*`/g

/**
 * Strips fenced code blocks and inline code spans, so example syntax in prose (e.g. "a link like
 * `[[Note]]`") is never mistaken for a real wikilink.
 *
 * Fences toggle line by line (same as the vault's own lint oracle, `brain/.scripts/vault-lint.mjs`
 * — a fence marker never shares a line with other content). Inline code, however, pairs backticks
 * per PARAGRAPH (a run of consecutive non-blank, non-fenced lines) rather than per single line: a
 * markdown inline code span can itself wrap across a soft line break (`` `long/path,\ncontinued`
 * ``), which per-line pairing would desync on, leaking the tail of the span as literal text.
 * Pairing is still bounded to one paragraph, not the whole document, so a genuinely stray/unpaired
 * backtick can only swallow the rest of its own paragraph, never bleed into later ones.
 */
export function stripCode(content: string): string {
  const kept: string[] = []
  let paragraph: string[] = []
  let inFence = false

  function flushParagraph(): void {
    if (paragraph.length === 0) return
    kept.push(paragraph.join('\n').replace(INLINE_CODE_RE, ''))
    paragraph = []
  }

  for (const line of content.split('\n')) {
    if (FENCE_RE.test(line)) {
      flushParagraph()
      inFence = !inFence
      continue
    }
    if (inFence) continue

    if (line.trim() === '') {
      flushParagraph()
      kept.push(line)
      continue
    }

    paragraph.push(line)
  }

  flushParagraph()
  return kept.join('\n')
}
