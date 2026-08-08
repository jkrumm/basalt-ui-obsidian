/**
 * A dedicated `@mantine/spotlight` instance for vault note search, wired to `useVaultSearch`'s
 * MiniSearch-backed relevance ranking (debounced internally — see the hook's own doc) and
 * `toVaultSearchActions`'s projection into Spotlight's action shape. Kept separate from
 * `basalt-ui/commands`' command-palette Spotlight (disabled in `main.tsx` — this app registers no
 * commands, so that palette would only ever be empty) and mounted directly against
 * `@mantine/spotlight`, a hard dependency here rather than the optional-peer path
 * `basalt-ui/commands` uses internally.
 *
 * Three fixes beyond wiring:
 *
 * - `filter={identityFilter}` — `<Spotlight>`'s own default filter re-checks the RAW query as a
 *   literal substring of each action's label/description/keywords, which would silently re-exclude
 *   a diacritic-folded MiniSearch hit (`Ernahrung` matching `Ernährung`) and undo the ranking
 *   `useVaultSearch` already computed. `hits` is already the full, ranked, cut-off result set —
 *   Spotlight should render it, not re-filter it.
 * - the `useEffect` on `hits` re-runs the same `data-selected` preselection `@mantine/spotlight`'s
 *   own store does on typing (its `spotlight.store.ts`'s `setQuery` action), because that one only
 *   fires synchronously with a keystroke — a race against `useVaultSearch`'s 150ms debounce, so the
 *   attribute lands on an action element that's unmounted before the real (debounced) results
 *   arrive. Re-applying it once `hits` itself changes is what makes Enter navigate immediately,
 *   without arrowing down first.
 * - `searchProps` sets the iOS input-hygiene attributes `@mantine/spotlight` doesn't default to:
 *   without them iOS capitalizes and autocorrects a vault query out from under the user.
 */
import { Fragment, useEffect } from 'react'
import { Stack, Text, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { createSpotlight, Spotlight } from '@mantine/spotlight'
import type {
  SpotlightActionData,
  SpotlightFilterFunction,
  SpotlightStore,
} from '@mantine/spotlight'
import { useNavigate } from '@tanstack/react-router'
import {
  encodeSlugPath,
  folderPath,
  toVaultSearchActions,
  useVaultSearch,
} from 'basalt-ui-obsidian'
import type { VaultSearchHit } from 'basalt-ui-obsidian'
import { alpha, VX } from 'basalt-ui/tokens'
import { highlightSegments } from 'obsidian-vault-core/search'
import { useSearchIndexQuery } from './vault-data'

const [vaultSpotlightStore, vaultSpotlightControls] = createSpotlight()

/** Opens the vault-search Spotlight — wired to `BasaltShell`'s `search.onOpen`. */
export function openVaultSearch(): void {
  vaultSpotlightControls.open()
}

/** Renders `hits` unfiltered, in MiniSearch's own order — see the module doc for why Spotlight's
 * default substring filter must not run a second pass over an already-ranked result set. */
const identityFilter: SpotlightFilterFunction = (_query, data) => data

/** Restores `data-selected` on the current first action, mirroring `@mantine/spotlight`'s own
 * (typing-only) preselection — see the module doc for the race this patches. */
export function preselectFirstAction(store: SpotlightStore): void {
  const { listId } = store.getState()
  if (listId === '') return
  const list = document.getElementById(listId)
  if (list === null) return

  list.querySelector('[data-selected]')?.removeAttribute('data-selected')
  const first = list.querySelector('[data-action]')
  if (first === null) return

  first.setAttribute('data-selected', 'true')
  store.updateState((state) => ({ ...state, selected: 0 }))
}

/** Renders `text` with every diacritic-folded match of `query` wrapped in `<mark>`. */
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

/** A search result row: highlighted title, highlighted snippet, and the note's vault-relative
 * folder as a muted secondary line — otherwise `Peptide`, `Peptides (wiki)`, `Health`, and
 * `Health (wiki)` are indistinguishable in a flat results list. */
function VaultSearchResultRow({
  hit,
  query,
}: {
  readonly hit: VaultSearchHit
  readonly query: string
}) {
  const folder = folderPath(hit.path)

  return (
    <Stack gap={2} style={{ width: '100%', alignItems: 'flex-start' }}>
      <Text component="span" fw={600} style={{ color: VX.ink }}>
        <HighlightedText text={hit.title} query={query} />
      </Text>
      {hit.snippet !== undefined && (
        <Text component="span" size="sm" lineClamp={2} style={{ color: VX.ink2 }}>
          <HighlightedText text={hit.snippet} query={query} />
        </Text>
      )}
      {folder !== '' && (
        <Text component="span" size="xs" style={{ color: VX.muted }}>
          {folder}
        </Text>
      )}
    </Stack>
  )
}

export function VaultSearchSpotlight() {
  // Hand the hook the index the BUILD already produced. Without this it silently rebuilds one from
  // the vault in the browser, and the precached `search-index.json` is downloaded for nothing.
  const { data: searchIndex } = useSearchIndexQuery()
  const { query, setQuery, hits } = useVaultSearch(searchIndex !== undefined ? { searchIndex } : {})
  const navigate = useNavigate()
  const theme = useMantineTheme()
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`)

  // See the module doc: `hits` lands after `useVaultSearch`'s debounce, racing past Spotlight's own
  // typing-driven preselection — this re-applies it once the real results are in.
  useEffect(() => {
    preselectFirstAction(vaultSpotlightStore)
  }, [hits])

  // `toVaultSearchActions` returns a structural mirror of `SpotlightActionData` (see the hook
  // module's own doc for why it isn't a direct import there) — any object of that shape is
  // assignable here. `children` overrides Spotlight's default label/description rendering with our
  // own highlighted title + snippet + path row (`VaultSearchResultRow`).
  const actions: SpotlightActionData[] = toVaultSearchActions(hits, {
    onNavigate: (href) => void navigate({ to: href as never }),
    href: (hit) => `/${encodeSlugPath(hit.slug)}`,
    group: 'Notes',
  }).map((action, i) => {
    const hit = hits[i]
    return hit === undefined
      ? action
      : { ...action, children: <VaultSearchResultRow hit={hit} query={query} /> }
  })

  return (
    <Spotlight
      store={vaultSpotlightStore}
      actions={actions}
      filter={identityFilter}
      query={query}
      onQueryChange={setQuery}
      fullScreen={isMobile}
      searchProps={{
        placeholder: 'Search the vault…',
        autoCapitalize: 'none',
        autoCorrect: 'off',
        spellCheck: false,
        enterKeyHint: 'search',
        inputMode: 'search',
      }}
      nothingFound="No notes match."
      maxHeight={420}
    />
  )
}
