/**
 * `obsidian-vault-core` — framework-free (no React, no DOM) parsing of an Obsidian vault
 * directory into a `VaultIndex`: every note, Obsidian's wikilink resolution semantics, backlinks,
 * tags, and a folder/file nav tree. See `./remark` for the Obsidian-flavored remark plugins and
 * `./search` for the MiniSearch index builder — both are separate subpath exports so a consumer
 * that only needs vault reading doesn't pull in unified/MiniSearch types.
 */
export { readVault } from './vault-reader.js'
export { readBookmarks } from './bookmarks.js'
export { resolveLinkPath } from './links.js'
export { slugify } from './slug.js'
export { collectSortingSpecs, parseSortingSpec, readFolderIcons } from './nav-config.js'

export type {
  ReadVaultOptions,
  VaultBacklink,
  VaultBookmark,
  VaultHeading,
  VaultIndex,
  VaultLink,
  VaultNote,
  VaultTreeNode,
} from './types.js'
