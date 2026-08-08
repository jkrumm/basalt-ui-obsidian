/**
 * `obsidian-vault-core/search` — a MiniSearch index over a `VaultIndex`'s notes (build/serialize/
 * load), plus the JSON-serializable `VaultBundle` a browser can fetch and rehydrate without
 * re-reading the vault from disk.
 */
export { buildSearchIndex, loadSearchIndex, serializeSearchIndex } from './build-index.js'
export type { SearchDocument } from './build-index.js'

export { fromVaultBundle, toVaultBundle } from './bundle.js'
export type { VaultBundle } from './bundle.js'
