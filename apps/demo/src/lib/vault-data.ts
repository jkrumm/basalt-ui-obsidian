/**
 * Fetches the build-time `VaultBundle` emitted by `vite-plugins/vault-data.ts` and rehydrates it
 * into a `VaultIndex` — the one thing `VaultProvider` needs. Fetched (not imported), so the service
 * worker precaches it independently of the JS bundle.
 */
import { useQuery } from '@tanstack/react-query'
import type { VaultIndex } from 'obsidian-vault-core'
import { fromVaultBundle, loadSearchIndex } from 'obsidian-vault-core/search'
import type { VaultBundle } from 'obsidian-vault-core/search'

async function fetchVaultIndex(): Promise<VaultIndex> {
  const res = await fetch(`${import.meta.env.BASE_URL}vault.json`)
  if (!res.ok) throw new Error(`Failed to load vault.json (${String(res.status)})`)
  const bundle = (await res.json()) as VaultBundle
  return fromVaultBundle(bundle)
}

/**
 * Loads the MiniSearch index the build already emitted, rather than letting `useVaultSearch`
 * rebuild one in the browser. The build step was serializing and precaching `search-index.json`
 * while nothing fetched it — paying for the download AND then re-tokenizing every note on the
 * phone. `loadSearchIndex` deserializes in one pass.
 */
async function fetchSearchIndex() {
  const res = await fetch(`${import.meta.env.BASE_URL}search-index.json`)
  if (!res.ok) throw new Error(`Failed to load search-index.json (${String(res.status)})`)
  return loadSearchIndex(await res.text())
}

export function useSearchIndexQuery() {
  return useQuery({
    queryKey: ['vault-search-index'],
    queryFn: fetchSearchIndex,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useVaultIndexQuery() {
  return useQuery({
    queryKey: ['vault-index'],
    queryFn: fetchVaultIndex,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
