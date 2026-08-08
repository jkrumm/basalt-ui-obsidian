/**
 * `useObsidianMarkdown` — the props basalt-ui's `<Markdown>` needs to render one note's body:
 * the three Obsidian remark plugins (`obsidian-vault-core/remark`) wired to this note's own
 * `path`, the `blockquote`/`a`/`img` overrides that read what those plugins wrote, and the
 * `sanitizeSchema` extension that keeps `Markdown`'s trailing `rehype-sanitize` pass from
 * stripping their attributes back off.
 *
 * Every returned value is `useMemo`'d on the inputs that can change it: `remarkPlugins` and the `a`
 * override on `[resolveWikilink, path]`/`[renderLink]`, `components` on the link override,
 * `sanitizeSchema` is a module-level constant. `<Markdown>` feeds `components`/`remarkPlugins`
 * straight into `React.memo`-gated streaming block renderers (see the module JSDoc + the
 * `fenceRenderers` prop doc in basalt's `markdown.tsx`), so an inline object/array literal here
 * would defeat that memoization on every parent render.
 */
import { useMemo } from 'react'
import {
  remarkObsidianCallout,
  remarkObsidianImageSize,
  remarkObsidianWikilink,
} from 'obsidian-vault-core/remark'
import type { MarkdownComponents, MarkdownProps } from 'basalt-ui/content'

import { useVault } from '../context.js'
import {
  createObsidianLinkComponent,
  ObsidianBlockquote,
  ObsidianImage,
} from './obsidian-components.js'
import { OBSIDIAN_SANITIZE_SCHEMA } from './sanitize-schema.js'

export type ObsidianMarkdownConfig = {
  /** Vault-relative path of the note being rendered — wikilink resolution is relative to this. */
  readonly path: string
}

/** The subset of `MarkdownProps` this hook produces — spread straight into `<Markdown {...x}>`. */
export type ObsidianMarkdownProps = Pick<
  MarkdownProps,
  'remarkPlugins' | 'components' | 'sanitizeSchema'
>

export function useObsidianMarkdown({ path }: ObsidianMarkdownConfig): ObsidianMarkdownProps {
  const { resolveWikilink, renderLink } = useVault()

  // unified's `PluggableList` expects the ATTACHER itself (a bare plugin function it calls to
  // produce the transformer, or a `[plugin, options]` tuple) — NOT an already-invoked transformer.
  // Calling `remarkObsidianWikilink({...})` here and putting the RESULT in this array would hand
  // unified a `(tree) => void` transformer that it then calls AS an attacher (with no `tree`
  // argument), which is what a prior version of this file did and which crashed inside
  // `findAndReplace` on an `undefined` tree.
  const remarkPlugins = useMemo(
    () => [
      [
        remarkObsidianWikilink,
        { resolve: (target: string, anchor?: string) => resolveWikilink(target, path, anchor) },
      ],
      remarkObsidianImageSize,
      remarkObsidianCallout,
    ],
    [resolveWikilink, path],
  )

  const linkComponent = useMemo(() => createObsidianLinkComponent(renderLink), [renderLink])

  const components = useMemo<MarkdownComponents>(
    () => ({
      blockquote: ObsidianBlockquote,
      a: linkComponent,
      img: ObsidianImage,
    }),
    [linkComponent],
  )

  return {
    remarkPlugins,
    components,
    sanitizeSchema: OBSIDIAN_SANITIZE_SCHEMA,
  }
}
