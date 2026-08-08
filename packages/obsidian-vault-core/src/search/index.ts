/**
 * `obsidian-vault-core/search` — a MiniSearch index over a `VaultIndex`'s notes (build/serialize/
 * load), plus the JSON-serializable `VaultBundle` a browser can fetch and rehydrate without
 * re-reading the vault from disk. Also the framework-free half of the search UI: diacritic folding,
 * markdown-to-text flattening, snippet building, and match highlighting — one implementation shared
 * between the build-time index and the browser-side display, so they cannot diverge.
 */
export { buildSearchIndex, loadSearchIndex, serializeSearchIndex } from './build-index.js'
export type { SearchDocument } from './build-index.js'

export { fromVaultBundle, toVaultBundle } from './bundle.js'
export type { VaultBundle } from './bundle.js'

export { foldDiacritics } from './fold-diacritics.js'
export { highlightSegments } from './highlight.js'
export type { HighlightSegment } from './highlight.js'
export { buildSnippet } from './snippet.js'
export { stripMarkdownToText } from './strip-markdown.js'
