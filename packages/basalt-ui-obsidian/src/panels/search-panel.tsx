/**
 * `VaultSearchPanel` — `useVaultSearch` behind a `TextInput`, rendered as a result list rather than
 * a `@mantine/spotlight` overlay. The result row (`SearchResultRow`) reproduces
 * `apps/demo/src/lib/vault-search-spotlight.tsx`'s `VaultSearchResultRow` treatment exactly —
 * highlighted title, 2-line-clamped highlighted snippet, dimmed folder path — so the spotlight
 * overlay and this panel read as the same search surface; it is NOT imported from the demo app
 * (this package cannot depend on its own consumer), just reproduced against the same framework-free
 * `highlightSegments`/`folderPath` primitives that file already uses.
 *
 * The iOS input-hygiene attributes (`autoCapitalize`/`autoCorrect`/`spellCheck`/`enterKeyHint`/
 * `type="search"`) mirror that same file's `searchProps` — without them iOS capitalizes and
 * autocorrects a vault query out from under the user.
 */
import { Fragment, useEffect } from 'react'
import { CloseButton, TextInput } from '@mantine/core'
import { alpha, VX } from 'basalt-ui/tokens'
import { highlightSegments } from 'obsidian-vault-core/search'
import { useVault } from '../context.js'
import { folderPath, useVaultSearch } from '../nav/use-vault-search.js'
import type { UseVaultSearchOptions, VaultSearchHit } from '../nav/use-vault-search.js'
import classes from './panel.module.css'

export type VaultSearchPanelProps = {
  readonly searchIndex?: UseVaultSearchOptions['searchIndex']
  readonly activePath?: string
  readonly onNavigate?: () => void
  readonly autoFocus?: boolean
  /** Seeds the query once on mount — an initial value, not a controlled prop; `useVaultSearch`
   * still owns `query` as its own state afterward. */
  readonly initialQuery?: string
}

/** Hand-drawn, icon-library-free — same convention as `vault-nav.tsx`'s `DefaultChevronIcon`/
 * `FallbackIcon`. */
function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  )
}

/** Renders `text` with every diacritic-folded match of `query` wrapped in `<mark>` — verbatim copy
 * of `vault-search-spotlight.tsx`'s own `HighlightedText`, see the module doc for why it isn't a
 * shared import instead. */
function HighlightedText({ text, query }: { readonly text: string; readonly query: string }) {
  return (
    <>
      {highlightSegments(text, query).map((segment, i) =>
        segment.matched ? (
          // eslint-disable-next-line react/no-array-index-key -- segments are a stable, ordered split of `text`
          <mark
            key={i}
            style={{ background: alpha(VX.accent, 0.35), color: VX.ink, borderRadius: 2 }}
          >
            {segment.text}
          </mark>
        ) : (
          // eslint-disable-next-line react/no-array-index-key -- segments are a stable, ordered split of `text`
          <Fragment key={i}>{segment.text}</Fragment>
        ),
      )}
    </>
  )
}

type SearchResultRowProps = {
  readonly hit: VaultSearchHit
  readonly query: string
  readonly active: boolean
  readonly onNavigate: (() => void) | undefined
}

function SearchResultRow({ hit, query, active, onNavigate }: SearchResultRowProps) {
  const { index, hrefFor, renderLink } = useVault()
  const note = index.byPath.get(hit.path)
  if (note === undefined) return null
  const folder = folderPath(hit.path)

  return (
    <div
      role="listitem"
      data-active={active || undefined}
      className={classes.row}
      style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 2, padding: '6px 8px' }}
      onClick={onNavigate}
    >
      <div className={classes.anchorReset} style={{ width: '100%' }}>
        {renderLink(
          hrefFor(note),
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: VX.ink }}>
              <HighlightedText text={hit.title} query={query} />
            </span>
            {hit.snippet !== undefined && (
              <span
                style={{
                  fontSize: 12,
                  color: VX.ink2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                <HighlightedText text={hit.snippet} query={query} />
              </span>
            )}
            {folder !== '' && <span className={classes.folderPath}>{folder}</span>}
          </span>,
        )}
      </div>
    </div>
  )
}

export function VaultSearchPanel({
  searchIndex,
  activePath,
  onNavigate,
  autoFocus,
  initialQuery,
}: VaultSearchPanelProps) {
  const { query, setQuery, hits } = useVaultSearch(searchIndex !== undefined ? { searchIndex } : {})

  // Seeds once, on mount — see `initialQuery`'s own doc for why this deliberately never re-runs.
  useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== '') setQuery(initialQuery)
  }, [])

  const trimmed = query.trim()

  return (
    <div>
      <div style={{ padding: '4px 8px' }}>
        <TextInput
          size="sm"
          autoFocus={autoFocus}
          placeholder="Search the vault…"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          leftSection={<SearchGlyph />}
          rightSection={
            trimmed !== '' ? (
              <CloseButton size="sm" aria-label="Clear search" onClick={() => setQuery('')} />
            ) : undefined
          }
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          inputMode="search"
          type="search"
        />
      </div>
      {trimmed === '' ? (
        <div className={classes.emptyLabel}>Search note titles and body text.</div>
      ) : (
        <>
          <div className={classes.sectionHeader}>
            {hits.length} result{hits.length === 1 ? '' : 's'}
          </div>
          {hits.length === 0 ? (
            <div className={classes.emptyLabel}>{`No notes match "${trimmed}".`}</div>
          ) : (
            <div role="list">
              {hits.map((hit) => (
                <SearchResultRow
                  key={hit.path}
                  hit={hit}
                  query={query}
                  active={hit.path === activePath}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
