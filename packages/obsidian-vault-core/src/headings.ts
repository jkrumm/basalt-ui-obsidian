/** ATX heading extraction (`# text` through `###### text`), skipping fenced code blocks. */
import { SlugTracker } from './slug.js'
import type { VaultHeading } from './types.js'

// CommonMark's optional closing sequence must be preceded by WHITESPACE (`## Foo ##`). The looser
// `\s*#*\s*$` also ate a hash that is part of the text — `# Learning C#` extracted `Learning C`,
// which then corrupted the slug and silently broke `[[Note#Learning C#]]` anchor resolution.
const HEADING_RE = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/
const FENCE_RE = /^\s*(```|~~~)/

export function extractHeadings(body: string): VaultHeading[] {
  const tracker = new SlugTracker()
  const headings: VaultHeading[] = []
  let inFence = false

  for (const line of body.split('\n')) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = HEADING_RE.exec(line)
    if (match === null) continue

    const [, hashes, text] = match
    if (hashes === undefined || text === undefined) continue

    headings.push({ depth: hashes.length, text, slug: tracker.slug(text) })
  }

  return headings
}
