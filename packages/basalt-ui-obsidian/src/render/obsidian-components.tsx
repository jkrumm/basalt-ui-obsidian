/**
 * `basalt-ui` `<Markdown>` component overrides for the three Obsidian-flavored element shapes
 * `useObsidianMarkdown`'s remark plugins produce: a callout blockquote, an internal wikilink, and a
 * sized image. Each override reads the hast attributes those plugins wrote (via `ExtraProps.node`
 * for the custom `data-*` markers — react-markdown does not otherwise surface them as props) and
 * falls through to basalt's own default element behaviour when the marker is absent, so an ordinary
 * blockquote/link/image in the same note renders exactly as basalt would render it unstyled.
 */
import type { JSX } from 'react'
import type { ExtraProps } from 'react-markdown'
import { Callout } from 'basalt-ui/content'
import type { CalloutKind } from 'basalt-ui/content'

import type { VaultLinkRenderer } from '../context.js'

type BlockquoteProps = JSX.IntrinsicElements['blockquote'] & ExtraProps
type LinkProps = JSX.IntrinsicElements['a'] & ExtraProps
type ImgProps = JSX.IntrinsicElements['img'] & ExtraProps

const CALLOUT_KINDS: readonly CalloutKind[] = ['info', 'good', 'warn', 'bad']

function isCalloutKind(value: unknown): value is CalloutKind {
  return typeof value === 'string' && (CALLOUT_KINDS as readonly string[]).includes(value)
}

/**
 * `blockquote` — `remarkObsidianCallout` marks a callout blockquote's hast node with
 * `data-callout-kind` (plus an optional `data-callout-title`). Anything else is a plain quote and
 * falls through to a bare `<blockquote>`, matching basalt's own default for the non-alert case.
 */
export function ObsidianBlockquote({ node, children }: BlockquoteProps) {
  const kind = node?.properties?.['data-callout-kind']
  if (!isCalloutKind(kind)) return <blockquote>{children}</blockquote>

  const title = node?.properties?.['data-callout-title']
  return (
    <Callout kind={kind} {...(typeof title === 'string' && { title })}>
      {children}
    </Callout>
  )
}

/**
 * `img` — `remarkObsidianImageSize` emits `width`/`height` as ordinary hast properties (already
 * exposed as the standard `width`/`height` props, no `node` digging needed). Missing/empty `src`
 * skips the element entirely, and `loading="lazy"` is kept — both matching basalt's own default.
 */
export function ObsidianImage({ src, alt, width, height }: ImgProps) {
  if (typeof src !== 'string' || src === '') return <span aria-label={alt} />
  return (
    <img
      src={src}
      alt={alt ?? ''}
      loading="lazy"
      {...(width !== undefined && { width })}
      {...(height !== undefined && { height })}
    />
  )
}

/**
 * `a` — factory closing over `renderLink` (from `useVault()`), so it has to be built inside
 * `useObsidianMarkdown` rather than exported as a bare component. An internal link carries
 * `data-wikilink` (set by `remarkObsidianWikilink`) and renders through the vault's `renderLink`;
 * anything else keeps basalt's own external-link handling verbatim, `rest` included — see the
 * comment above basalt's `LinkRenderer` in `markdown.tsx` for why dropping `rest` breaks GFM
 * footnote back-links.
 */
export function createObsidianLinkComponent(renderLink: VaultLinkRenderer) {
  return function ObsidianLink({ href, children, node, ...rest }: LinkProps) {
    if (href === undefined) return <span {...rest}>{children}</span>

    const isWikilink = node?.properties?.['data-wikilink'] !== undefined
    if (isWikilink) return renderLink(href, children)

    const external = href.startsWith('http://') || href.startsWith('https://')
    return (
      <a href={href} {...rest} {...(external && { target: '_blank', rel: 'noreferrer noopener' })}>
        {children}
      </a>
    )
  }
}
