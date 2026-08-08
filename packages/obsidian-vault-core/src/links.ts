/**
 * Wikilink extraction and resolution — the two halves of the oracle's own logic in
 * `brain/.scripts/vault-lint.mjs` (`extractWikilinks` / `resolveWikilinkTarget`), reimplemented
 * here to resolve identically.
 */
import { stripCode } from './text-utils.js'
import type { VaultLink } from './types.js'

// Quartz's wikilink pattern: target / #anchor / |alias as three separate optional groups. Shared
// with `search/strip-markdown.ts`, which needs the same match shape to flatten a link to display
// text.
//
// The alias group is `*`, not Quartz's `+`, so an EMPTY alias still matches. `[[target|]]` is an
// authoring slip Obsidian renders as a link with no visible text — but it is still a link, and
// Quartz's `+` drops the whole match, silently losing the edge from the backlink graph. An empty
// alias normalizes to "no alias" below, so the target renders as its own display text.
export const WIKILINK_RE = /!?\[\[([^[\]|#]+)?(#[^[\]|#]+)?(\|[^[\]|#]*)?\]\]/g

export type RawVaultLink = Omit<VaultLink, 'resolvedPath'>

/** Extracts every `[[...]]` / `![[...]]` occurrence from a note body, code spans stripped first. */
export function extractLinks(body: string): RawVaultLink[] {
  const stripped = stripCode(body)
  const links: RawVaultLink[] = []

  for (const match of stripped.matchAll(WIKILINK_RE)) {
    const raw = match[0]
    const target = (match[1] ?? '').trim()
    const anchorGroup = match[2]
    const aliasGroup = match[3]
    const anchor = anchorGroup !== undefined ? anchorGroup.slice(1).trim() : ''
    const alias = aliasGroup !== undefined ? aliasGroup.slice(1).trim() : ''

    links.push({
      raw,
      target,
      embed: raw.startsWith('!'),
      ...(anchor !== '' ? { anchor } : {}),
      ...(alias !== '' ? { alias } : {}),
    })
  }

  return links
}

/**
 * Resolves a wikilink `target` from `fromPath` against a flat list of vault-relative note paths.
 * Obsidian semantics, matching the oracle exactly:
 *
 * 1. Strip a trailing `.md`.
 * 2. NFC-normalize both the target and every candidate path, compare case-insensitively — the
 *    vault has filenames like `Ernährungsplan.md` written on macOS.
 * 3. A `/`-qualified target matches by SUFFIX against the candidate path (with and without
 *    `.md`); a bare target matches by basename.
 * 4. Multiple candidates: prefer the same folder as `fromPath`, then the shortest path
 *    (Obsidian's `newLinkFormat: "shortest"` behaviour).
 *
 * Returns `undefined` when nothing matches — a dead link.
 */
export function resolveLinkPath(
  target: string,
  fromPath: string,
  paths: readonly string[],
): string | undefined {
  const cleanTarget = target
    .replace(/\.md$/i, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/^\/+/, '')
  if (cleanTarget === '') return undefined

  const hasSlash = cleanTarget.includes('/')
  const candidates: string[] = []

  for (const path of paths) {
    const lowerPath = path.normalize('NFC').toLowerCase()
    const withoutMd = lowerPath.endsWith('.md') ? lowerPath.slice(0, -3) : lowerPath

    if (hasSlash) {
      if (
        lowerPath === cleanTarget ||
        withoutMd === cleanTarget ||
        lowerPath.endsWith(`/${cleanTarget}`) ||
        withoutMd.endsWith(`/${cleanTarget}`)
      ) {
        candidates.push(path)
      }
      continue
    }

    const slashIndex = withoutMd.lastIndexOf('/')
    const basename = slashIndex === -1 ? withoutMd : withoutMd.slice(slashIndex + 1)
    if (basename === cleanTarget) candidates.push(path)
  }

  if (candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]

  const fromDirIndex = fromPath.lastIndexOf('/')
  const fromDir = fromDirIndex === -1 ? '' : fromPath.slice(0, fromDirIndex)

  const sameFolder = candidates.filter((candidate) => {
    const dirIndex = candidate.lastIndexOf('/')
    const dir = dirIndex === -1 ? '' : candidate.slice(0, dirIndex)
    return dir === fromDir
  })

  const pool = sameFolder.length > 0 ? sameFolder : candidates
  return pool.toSorted((a, b) => a.length - b.length)[0]
}
