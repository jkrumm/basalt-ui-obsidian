/**
 * `remarkObsidianWikilink` — replaces `[[target]]` / `[[target|alias]]` / `[[target#heading]]`
 * text (`![[embed]]` too, embeds are not otherwise treated specially — see the package README's
 * scope note) with mdast `link` nodes, using a consumer-supplied `resolve` callback to turn the
 * link target into a URL.
 *
 * An unresolved link (the callback returns `undefined`) is replaced with a plain `text` node —
 * the simpler of the two options this library considered (the other being a `link`-shaped node
 * with a `data-wikilink-dead` marker on some enclosing parent, which has no well-defined "parent"
 * for a bare inline match). A future renderer that needs to style dead links differently can
 * re-run the same `resolve` callback itself.
 */
import { findAndReplace } from 'mdast-util-find-and-replace'
import type { Link, PhrasingContent, Root } from 'mdast'

import { WIKILINK_RE as WIKILINK_SOURCE } from '../links.js'
import './mdast-data.js'

// Rebuilt from the shared pattern rather than redeclared, so this plugin and `extractLinks` can
// never drift — a private copy here already lagged one fix to the alias group. A fresh RegExp also
// keeps `lastIndex` state off the shared object.
const WIKILINK_RE = new RegExp(WIKILINK_SOURCE.source, 'g')

export type RemarkObsidianWikilinkOptions = {
  /**
   * Maps a link target to a URL. Receives the raw `#anchor` TEXT (Obsidian anchors are heading
   * text, not slugs) and must return the COMPLETE href including any fragment — slugifying the
   * anchor to match the renderer's heading ids is the caller's job, because only the caller knows
   * which slugger it uses. `headingSlug` from the package root is the one this library's own index
   * uses. Return `undefined` for a dead link.
   */
  readonly resolve: (target: string, anchor?: string) => string | undefined
}

function lastSegment(target: string): string {
  const index = target.lastIndexOf('/')
  return index === -1 ? target : target.slice(index + 1)
}

function createReplacer(resolve: RemarkObsidianWikilinkOptions['resolve']) {
  return (
    _fullMatch: string,
    targetGroup: string | undefined,
    anchorGroup: string | undefined,
    aliasGroup: string | undefined,
  ): PhrasingContent | string => {
    const target = (targetGroup ?? '').trim()
    const anchor = anchorGroup !== undefined ? anchorGroup.slice(1).trim() : undefined
    const alias = aliasGroup !== undefined ? aliasGroup.slice(1).trim() : undefined
    const displayText = alias !== undefined && alias !== '' ? alias : lastSegment(target)

    // `resolve` already received the anchor and owns the whole href — appending `#${anchor}` here
    // as well produced `/note#Heading#Heading` for every anchored link.
    const url = resolve(target, anchor)
    if (url === undefined) return displayText

    const link: Link = {
      type: 'link',
      url,
      children: [{ type: 'text', value: displayText }],
      data: { hProperties: { 'data-wikilink': '' } },
    }
    return link
  }
}

export function remarkObsidianWikilink(options: RemarkObsidianWikilinkOptions) {
  const replace = createReplacer(options.resolve)

  return (tree: Root): void => {
    findAndReplace(tree, [[WIKILINK_RE, replace]])
  }
}
