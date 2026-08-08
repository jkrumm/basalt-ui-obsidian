/**
 * `obsidian-vault-core/remark` — three unified/remark plugins for the Obsidian-flavored markdown
 * syntax `readVault` doesn't otherwise touch: wikilinks, the pipe-encoded image size hint, and
 * callouts. Framework-free — operate on mdast only, no assumptions about the eventual renderer.
 */
export { remarkObsidianWikilink } from './wikilink.js'
export type { RemarkObsidianWikilinkOptions } from './wikilink.js'

export { remarkObsidianImageSize } from './image-size.js'

export { OBSIDIAN_CALLOUT_KIND, remarkObsidianCallout } from './callout.js'
export type { CalloutKind, ObsidianCalloutData } from './callout.js'
