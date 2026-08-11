/**
 * `basalt-ui-obsidian` — React components that render an `obsidian-vault-core` index through
 * basalt-ui's content and shell primitives.
 *
 * The package deliberately adds NO markdown renderer of its own: `NoteView` drives basalt-ui's
 * `<Markdown>` and supplies Obsidian-specific behaviour through the two seams that component
 * already has — `remarkPlugins` (wikilinks, callouts, image size hints) and per-element
 * `components` overrides. Anything visual stays basalt-ui's; anything Obsidian-shaped is here.
 */
export { encodeSlugPath, useVault, VaultProvider } from './context.js'
export type {
  VaultChevronRenderer,
  VaultContextValue,
  VaultHrefResolver,
  VaultLinkRenderer,
  VaultProviderProps,
} from './context.js'

export { NoteView } from './render/note-view.js'
export type { NoteViewProps } from './render/note-view.js'
export { useObsidianMarkdown } from './render/use-obsidian-markdown.js'
export type { ObsidianMarkdownConfig } from './render/use-obsidian-markdown.js'

export { VaultNav } from './nav/vault-nav.js'
export type { VaultNavProps } from './nav/vault-nav.js'
export { Backlinks } from './nav/backlinks.js'
export type { BacklinksProps } from './nav/backlinks.js'
export { TagIndex } from './nav/tag-index.js'
export type { TagIndexProps } from './nav/tag-index.js'
export { folderPath, toVaultSearchActions, useVaultSearch } from './nav/use-vault-search.js'
export type {
  ToVaultSearchActionsOptions,
  UseVaultSearchOptions,
  UseVaultSearchResult,
  VaultSearchHit,
  VaultSpotlightAction,
} from './nav/use-vault-search.js'

// The sanitize schema is public because basalt-ui's `Markdown` runs `rehype-sanitize` LAST and
// unconditionally: without these additions the `data-callout*` / `data-wikilink` / `width` /
// `height` attributes this package emits are stripped before they reach a component override.
// `useObsidianMarkdown` already supplies it — this export is for consumers driving `<Markdown>`
// themselves.
export { OBSIDIAN_SANITIZE_SCHEMA } from './render/sanitize-schema.js'
export {
  createObsidianLinkComponent,
  ObsidianBlockquote,
  ObsidianImage,
} from './render/obsidian-components.js'
