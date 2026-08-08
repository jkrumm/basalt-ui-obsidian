/**
 * A dedicated `@mantine/spotlight` instance for vault note search, wired to `useVaultSearch`'s
 * MiniSearch-backed relevance ranking (debounced internally — see the hook's own doc) and
 * `toVaultSearchActions`'s projection into Spotlight's action shape. Kept separate from
 * `basalt-ui/commands`' command-palette Spotlight (disabled in `main.tsx` — this app registers no
 * commands, so that palette would only ever be empty) and mounted directly against
 * `@mantine/spotlight`, a hard dependency here rather than the optional-peer path
 * `basalt-ui/commands` uses internally.
 */
import { createSpotlight, Spotlight } from '@mantine/spotlight'
import type { SpotlightActionData } from '@mantine/spotlight'
import { useNavigate } from '@tanstack/react-router'
import { encodeSlugPath, toVaultSearchActions, useVaultSearch } from 'basalt-ui-obsidian'
import { useSearchIndexQuery } from './vault-data'

const [vaultSpotlightStore, vaultSpotlightControls] = createSpotlight()

/** Opens the vault-search Spotlight — wired to `BasaltShell`'s `search.onOpen`. */
export function openVaultSearch(): void {
  vaultSpotlightControls.open()
}

export function VaultSearchSpotlight() {
  // Hand the hook the index the BUILD already produced. Without this it silently rebuilds one from
  // the vault in the browser, and the precached `search-index.json` is downloaded for nothing.
  const { data: searchIndex } = useSearchIndexQuery()
  const { query, setQuery, hits } = useVaultSearch(
    searchIndex !== undefined ? { searchIndex } : {},
  )
  const navigate = useNavigate()

  // `toVaultSearchActions` returns a structural mirror of `SpotlightActionData` (see the hook
  // module's own doc for why it isn't a direct import there) — any object of that shape is
  // assignable here.
  const actions: SpotlightActionData[] = toVaultSearchActions(hits, {
    onNavigate: (href) => void navigate({ to: href as never }),
    href: (hit) => `/${encodeSlugPath(hit.slug)}`,
    group: 'Notes',
  })

  return (
    <Spotlight
      store={vaultSpotlightStore}
      actions={actions}
      query={query}
      onQueryChange={setQuery}
      searchProps={{ placeholder: 'Search the vault…' }}
      nothingFound="No notes match."
      maxHeight={420}
    />
  )
}
