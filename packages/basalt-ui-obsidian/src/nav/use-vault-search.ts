/**
 * useVaultSearch — a MiniSearch index over the vault's notes (via `obsidian-vault-core/search`),
 * built lazily and ONCE per `index`/`searchIndex` identity through `useMemo`, never rebuilt per
 * keystroke. Typing is debounced so `search()` only runs once input settles.
 *
 * `VaultMiniSearch` is deliberately spelled as `ReturnType<typeof buildSearchIndex>` rather than
 * `import type { MiniSearch } from 'minisearch'` — `minisearch` is a dependency of
 * `obsidian-vault-core`, not of this package, so naming its type directly here would not resolve.
 * `ReturnType` lets TypeScript carry the type through without this file ever needing to resolve
 * the module itself.
 *
 * `toVaultSearchActions` projects hits into the action shape Mantine Spotlight
 * (`@mantine/spotlight`'s `SpotlightActionData`) expects, mirroring `toArticleActions`
 * (`basalt-ui/src/content/article-actions.ts`) for signature style. `@mantine/spotlight` is an
 * optional peer of `basalt-ui`, not a dependency of this package either, so `VaultSpotlightAction`
 * is a structural mirror of `SpotlightActionData` rather than an import of it — any object of this
 * shape is assignable into a `SpotlightActionData[]` array at the call site.
 */
import { useEffect, useMemo, useState } from 'react'
import { buildSearchIndex } from 'obsidian-vault-core/search'
import type { VaultNote } from 'obsidian-vault-core'
import { useVault } from '../context.js'

type VaultMiniSearch = ReturnType<typeof buildSearchIndex>

const SNIPPET_LENGTH = 140
const SNIPPET_LEAD = 40

/** Minimal markdown → plain-text reduction, just enough for a readable search snippet. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|#]*)(\|[^\]]*)?]]/g, (_match, target: string, alias?: string) =>
      alias !== undefined ? alias.slice(1) : target,
    )
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A short excerpt of `note.body` around the first hit on `query`, or its start when there's none. */
function snippetFrom(note: VaultNote, query: string): string | undefined {
  const text = toPlainText(note.body)
  if (text === '') return undefined

  const term = query.trim().split(/\s+/)[0]
  const matchAt =
    term !== undefined && term !== '' ? text.toLowerCase().indexOf(term.toLowerCase()) : -1
  const start = matchAt === -1 ? 0 : Math.max(0, matchAt - SNIPPET_LEAD)
  const excerpt = text.slice(start, start + SNIPPET_LENGTH).trim()
  return start > 0 ? `…${excerpt}` : excerpt
}

export type UseVaultSearchOptions = {
  /** Supply a prebuilt/loaded index (e.g. via `loadSearchIndex` over a served `VaultBundle`) to
   * skip building one locally. Omit to build one from `useVault().index` on first use. */
  readonly searchIndex?: VaultMiniSearch
  /** Debounce, in ms, between typing and running `search()`. Default 150. */
  readonly debounceMs?: number
  /** Max hits returned. Default 20. */
  readonly limit?: number
}

export type VaultSearchHit = {
  readonly path: string
  readonly slug: string
  readonly title: string
  readonly score: number
  readonly snippet?: string
}

export type UseVaultSearchResult = {
  readonly query: string
  readonly setQuery: (query: string) => void
  readonly hits: readonly VaultSearchHit[]
  readonly isReady: boolean
}

export function useVaultSearch(options: UseVaultSearchOptions = {}): UseVaultSearchResult {
  const { index } = useVault()
  const { searchIndex, debounceMs = 150, limit = 20 } = options
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Lazy + once: only (re)built when `index` or a caller-supplied `searchIndex` changes identity —
  // never as a side effect of `query` changing, which is what keeps typing cheap.
  const miniSearch = useMemo(() => searchIndex ?? buildSearchIndex(index), [searchIndex, index])

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), debounceMs)
    return () => clearTimeout(handle)
  }, [query, debounceMs])

  const hits = useMemo<readonly VaultSearchHit[]>(() => {
    const trimmed = debouncedQuery.trim()
    if (trimmed === '') return []

    return miniSearch
      .search(trimmed)
      .slice(0, limit)
      .map((result): VaultSearchHit => {
        const path = String(result['path'])
        const slug = String(result['slug'])
        const title = String(result['title'])
        const note = index.byPath.get(path)
        const snippet = note === undefined ? undefined : snippetFrom(note, trimmed)

        return {
          path,
          slug,
          title,
          score: result.score,
          ...(snippet !== undefined && { snippet }),
        }
      })
  }, [miniSearch, debouncedQuery, limit, index])

  return { query, setQuery, hits, isReady: true }
}

/**
 * Structural mirror of `@mantine/spotlight`'s `SpotlightActionData` — see the module doc for why
 * this isn't a direct import.
 */
export type VaultSpotlightAction = {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly keywords?: string
  readonly group?: string
  readonly onClick: () => void
}

export type ToVaultSearchActionsOptions = {
  /** Navigate to a hit's href — e.g. `(href) => router.navigate({ to: href })`. */
  readonly onNavigate: (href: string) => void
  /** Consumer owns routing — maps a hit to its destination href. */
  readonly href: (hit: VaultSearchHit) => string
  /** Prefix for generated action ids so they never collide with route/command ids. Default 'vault:'. */
  readonly idPrefix?: string
  /** Spotlight group for every produced action (e.g. 'Notes'). Omit for an ungrouped, flat list. */
  readonly group?: string
}

/** Project search hits into Mantine Spotlight actions, feeding basalt's `BasaltOverlays`/palette. */
export function toVaultSearchActions(
  hits: readonly VaultSearchHit[],
  options: ToVaultSearchActionsOptions,
): VaultSpotlightAction[] {
  const { onNavigate, href, idPrefix = 'vault:', group } = options

  return hits.map((hit) => {
    const target = href(hit)
    const keywords = [hit.title, hit.snippet ?? '', hit.slug]
      .filter((part) => part !== '')
      .join(' ')

    return {
      id: `${idPrefix}${target}`,
      label: hit.title,
      keywords,
      onClick: () => onNavigate(target),
      ...(hit.snippet !== undefined && { description: hit.snippet }),
      ...(group !== undefined && { group }),
    }
  })
}
