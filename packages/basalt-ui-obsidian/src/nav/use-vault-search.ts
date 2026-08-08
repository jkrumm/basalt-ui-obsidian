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
 *
 * Snippet building (`buildSnippet`) lives in `obsidian-vault-core/search`, not here — it used to be
 * a second, weaker duplicate of that package's markdown-to-text flattening, which is exactly why
 * snippets leaked raw callout/table syntax the index itself had already learned to strip. One
 * implementation now backs both.
 */
import { useEffect, useMemo, useState } from 'react'
import { buildSearchIndex, buildSnippet } from 'obsidian-vault-core/search'
import { useVault } from '../context.js'

type VaultMiniSearch = ReturnType<typeof buildSearchIndex>

/** Results below this fraction of the top hit's score are dropped before `limit` is applied — a
 * fixed threshold doesn't generalize across queries with very different absolute score ranges, but
 * "how close to the best match" does. Measured against the real 105-note vault: a broad single-word
 * term like "health" or "note" carries a long, fast-decaying tail of barely-relevant hits (46 and 43
 * total) that this trims to a handful, while a specific multi-word query like "wild rift" keeps its
 * whole, evenly-scored topic cluster. */
const RELEVANCE_CUTOFF_FRACTION = 0.25

/** The vault-relative folder a hit's note lives in, e.g. `wiki/health/peptides` for
 * `wiki/health/peptides/index.md` — the muted secondary line under a result title, since two notes
 * sharing a title (a curated `Health` page and its `wiki/` counterpart) are otherwise
 * indistinguishable in a flat results list. A root-level note has no folder. */
export function folderPath(path: string): string {
  const slashIndex = path.lastIndexOf('/')
  return slashIndex === -1 ? '' : path.slice(0, slashIndex)
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

    const results = miniSearch.search(trimmed)
    const topScore = results[0]?.score ?? 0
    const relevant =
      topScore > 0
        ? results.filter((result) => result.score >= topScore * RELEVANCE_CUTOFF_FRACTION)
        : results

    return relevant.slice(0, limit).map((result): VaultSearchHit => {
      const path = String(result['path'])
      const slug = String(result['slug'])
      const title = String(result['title'])
      const note = index.byPath.get(path)
      const snippet = note === undefined ? undefined : buildSnippet(note.body, title, trimmed)

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
