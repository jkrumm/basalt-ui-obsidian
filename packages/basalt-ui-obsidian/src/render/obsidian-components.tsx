/**
 * `basalt-ui` `<Markdown>` component overrides for the Obsidian-flavored element shapes
 * `useObsidianMarkdown` feeds it: a (possibly folded) callout blockquote, an internal wikilink, a
 * sized image, table cells, GFM task-list items/checkboxes, and a Dataview fence. Each override
 * reads the hast attributes `obsidian-vault-core`'s remark plugins wrote (via `ExtraProps.node` for
 * the custom `data-*` markers — react-markdown does not otherwise surface them as props) — or, for
 * the plain GFM shapes (task lists, table cells), the standard hast properties react-markdown
 * already exposes — and falls through to basalt's own default element behaviour when no marker
 * applies, so an ordinary blockquote/link/image/list in the same note renders exactly as basalt
 * would render it unstyled.
 */
import type { CSSProperties, JSX, ReactNode } from 'react'
import type { ExtraProps } from 'react-markdown'
import { Callout } from 'basalt-ui/content'
import type { CalloutKind, FenceRenderer, FenceRenderers } from 'basalt-ui/content'

import type { VaultLinkRenderer } from '../context.js'
import classes from './obsidian-components.module.css'

type BlockquoteProps = JSX.IntrinsicElements['blockquote'] & ExtraProps
type LinkProps = JSX.IntrinsicElements['a'] & ExtraProps
type ImgProps = JSX.IntrinsicElements['img'] & ExtraProps
type TableCellProps = JSX.IntrinsicElements['td'] & ExtraProps
type TableHeaderCellProps = JSX.IntrinsicElements['th'] & ExtraProps
type ListItemProps = JSX.IntrinsicElements['li'] & ExtraProps
type CheckboxProps = JSX.IntrinsicElements['input'] & ExtraProps

/** A hard cap under which `remarkObsidianImageSize`'s width hint means "inline icon" rather than
 * "a real embedded image" — the vault's own inline icons run 28–56px; this floor gives real
 * headroom above that measured range while still excluding ordinary embeds. */
const INLINE_ICON_MAX_WIDTH = 64
const INLINE_ICON_GAP = 4

const CALLOUT_KINDS: readonly CalloutKind[] = ['info', 'good', 'warn', 'bad']

function isCalloutKind(value: unknown): value is CalloutKind {
  return typeof value === 'string' && (CALLOUT_KINDS as readonly string[]).includes(value)
}

type CalloutFold = 'open' | 'closed'

function isCalloutFold(value: unknown): value is CalloutFold {
  return value === 'open' || value === 'closed'
}

/** Per-kind ink for a folded callout's `<summary>` — the same mapping `Callout`'s own CSS module
 * keys `--callout-ink` to (`callout.module.css`), reproduced here because that class is private to
 * basalt-ui and the summary sits OUTSIDE `Callout`'s own root (see `ObsidianFoldedCallout`'s doc). */
const CALLOUT_FOLD_INK: Record<CalloutKind, string> = {
  info: 'var(--vx-accent)',
  good: 'var(--vx-good-solid)',
  warn: 'var(--vx-warn-solid)',
  bad: 'var(--vx-bad-solid)',
}

/** Widens `Callout`'s title/body font-size (`--vx-text-md`, 15px) to match the 16px article body
 * it interrupts (`--vx-text-lg`) — a token-to-token remap, never a raw px value, and scoped to just
 * this `Callout`'s own DOM subtree since CSS custom properties only cascade to descendants. */
const CALLOUT_TEXT_STYLE = { '--vx-text-md': 'var(--vx-text-lg)' } as CSSProperties

/** `[!type]` with no same-line title leaves nothing for a folded callout's `<summary>` to show —
 * title-cases the raw Obsidian type keyword (`info`, `warning`, …) as the fallback. */
function fallbackFoldTitle(rawType: unknown): string {
  const text = typeof rawType === 'string' && rawType !== '' ? rawType : 'note'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * A folded callout (`[!info]-`/`[!info]+`) — basalt-ui's `Callout` has no collapse support of its
 * own, so the `<details>`/`<summary>` wrapper lives here, AROUND `Callout` rather than inside it:
 * nesting `<details>` inside `Callout`'s body would still need a title somewhere, and passing
 * `title` to `Callout` here (in addition to the `<summary>` text) would render it twice. Native
 * `<details>` needs no open/closed state of its own — `open={fold === 'open'}` sets the initial
 * DOM state and the browser owns every toggle after that.
 */
function ObsidianFoldedCallout({
  kind,
  title,
  rawType,
  fold,
  children,
}: {
  readonly kind: CalloutKind
  readonly title: string | undefined
  readonly rawType: unknown
  readonly fold: CalloutFold
  readonly children: ReactNode
}) {
  return (
    <details className={classes.foldRoot} open={fold === 'open'}>
      <summary className={classes.foldSummary} style={{ color: CALLOUT_FOLD_INK[kind] }}>
        {title ?? fallbackFoldTitle(rawType)}
      </summary>
      <Callout kind={kind} style={CALLOUT_TEXT_STYLE}>
        {children}
      </Callout>
    </details>
  )
}

/**
 * `blockquote` — `remarkObsidianCallout` marks a callout blockquote's hast node with
 * `data-callout-kind` (plus optional `data-callout-title`/`data-callout-fold`). Anything else is a
 * plain quote and falls through to a bare `<blockquote>`, matching basalt's own default for the
 * non-alert case. A fold marker (`data-callout-fold`) routes to `ObsidianFoldedCallout`; its
 * absence keeps the plain, always-expanded `Callout` this override already rendered.
 */
export function ObsidianBlockquote({ node, children }: BlockquoteProps) {
  const kind = node?.properties?.['data-callout-kind']
  if (!isCalloutKind(kind)) return <blockquote>{children}</blockquote>

  const titleProp = node?.properties?.['data-callout-title']
  const title = typeof titleProp === 'string' ? titleProp : undefined
  const fold = node?.properties?.['data-callout-fold']

  if (isCalloutFold(fold)) {
    return (
      <ObsidianFoldedCallout
        kind={kind}
        title={title}
        rawType={node?.properties?.['data-callout']}
        fold={fold}
      >
        {children}
      </ObsidianFoldedCallout>
    )
  }

  return (
    <Callout kind={kind} style={CALLOUT_TEXT_STYLE} {...(title !== undefined && { title })}>
      {children}
    </Callout>
  )
}

/**
 * `img` — `remarkObsidianImageSize` emits `width`/`height` as ordinary hast properties (already
 * exposed as the standard `width`/`height` props, no `node` digging needed). Missing/empty `src`
 * skips the element entirely, and `loading="lazy"` is kept — both matching basalt's own default.
 * `decoding="async"` is added unconditionally — off the main thread either way, never a downside.
 *
 * Sizing also decides how the image sits relative to surrounding text: an icon-sized embed
 * (`INLINE_ICON_MAX_WIDTH` floor — the vault's own inline icons measure 28–56px, always via this
 * same width hint) gets `vertical-align: middle` plus a small trailing gap, so it sits on the text
 * baseline instead of the awkward default gap under an inline replaced element. Anything else
 * (unsized, or a genuinely large embed) renders `display: block` — a standalone image alone in its
 * own paragraph reads as a block, not as inline content vertical-align has nothing to align against.
 *
 * A WIDTH-ONLY size hint (`![|56]`, no `x`-height) gives no true aspect ratio to reserve — modern
 * browsers already derive an implicit `aspect-ratio` from `width`+`height` HTML attributes when
 * BOTH are present, so that case needs nothing extra here. Width-only is different: the vault's own
 * width-only images are square icons in practice (verified against the target vault), so a 1:1 CSS
 * `aspect-ratio` reserves the right amount of layout space without guessing a wrong pixel height —
 * `object-fit: contain` alongside it means a width-only embed that turns out NOT to be square
 * letterboxes inside that reserved box instead of stretching to fill it.
 */
export function ObsidianImage({ src, alt, width, height }: ImgProps) {
  if (typeof src !== 'string' || src === '') return <span aria-label={alt} />
  const numericWidth = typeof width === 'number' ? width : Number(width)
  const isInlineIcon =
    Number.isFinite(numericWidth) && numericWidth > 0 && numericWidth <= INLINE_ICON_MAX_WIDTH
  const isWidthOnly = width !== undefined && height === undefined

  const baseStyle: CSSProperties = isInlineIcon
    ? { verticalAlign: 'middle', marginRight: INLINE_ICON_GAP }
    : { display: 'block' }
  const style: CSSProperties = isWidthOnly
    ? { ...baseStyle, aspectRatio: '1 / 1', objectFit: 'contain' }
    : baseStyle

  return (
    <img
      src={src}
      alt={alt ?? ''}
      loading="lazy"
      decoding="async"
      style={style}
      {...(width !== undefined && { width })}
      {...(height !== undefined && { height })}
    />
  )
}

/**
 * `td`/`th` — basalt's own `Markdown` doesn't override table cells at all, so they inherit
 * `overflow-wrap: anywhere` from `Prose`'s root (correct for prose body text, wrong for a narrow
 * label column: measured on a Wild Rift note's item-choice table, "Second"/"Boots"/"Fourth" wrapped
 * mid-word as "Seco nd"/"Boot s"/"Fourt h"). Restore normal word-boundary wrapping for cells
 * specifically — basalt's own `table { display: block; overflow-x: auto }` already gives a wide
 * table its own horizontal scroll instead of crushing columns or scrolling the article, so nothing
 * else about table layout needs to change.
 *
 * `classes.cell`/`classes.headerCell` add a narrow-viewport font-size bump on top (13.5px/11px
 * desktop-density numerals read too small as the READING size on a 393px screen) — a `@media` rule
 * has to live in a real stylesheet, so it's the one piece here that can't be inline `style`.
 */
const CELL_WRAP_STYLE = { overflowWrap: 'normal', wordBreak: 'normal' } as const

export function ObsidianTableCell({ node: _node, style, className, ...rest }: TableCellProps) {
  const mergedClassName = [classes.cell, className].filter(Boolean).join(' ')
  return <td className={mergedClassName} style={{ ...CELL_WRAP_STYLE, ...style }} {...rest} />
}

export function ObsidianTableHeaderCell({
  node: _node,
  style,
  className,
  ...rest
}: TableHeaderCellProps) {
  const mergedClassName = [classes.headerCell, className].filter(Boolean).join(' ')
  return <th className={mergedClassName} style={{ ...CELL_WRAP_STYLE, ...style }} {...rest} />
}

/**
 * `li` — GFM task-list items (`- [ ] …`/`- [x] …`) come out of `mdast-util-to-hast` with
 * `className="task-list-item"` (the `github-markdown-css` convention it borrows to hide the
 * bullet) plus a leading `<input type="checkbox" disabled>` — the class is a standard hast/React
 * prop already, no `node` digging needed. `list-style` only resets for THAT item; an ordinary `li`
 * in the same list (or a different list entirely) is untouched.
 */
export function ObsidianListItem({ node: _node, className, style, ...rest }: ListItemProps) {
  const isTaskItem =
    typeof className === 'string' && className.split(' ').includes('task-list-item')
  const mergedStyle: CSSProperties | undefined = isTaskItem
    ? { ...style, listStyleType: 'none' }
    : style
  return (
    <li
      {...(className !== undefined && { className })}
      {...(mergedStyle !== undefined && { style: mergedStyle })}
      {...rest}
    />
  )
}

function TaskCheckboxGlyph({ checked }: { readonly checked: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" strokeWidth={2} />
      {checked && (
        <path d="M7 12.5l3 3l7-7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

/**
 * `input` — the ONE input shape this markdown pipeline ever produces is a task-list checkbox
 * (`mdast-util-to-hast` always marks it `disabled`, so it was already inert — just OS-chrome-styled
 * to look otherwise). Swapped for a non-interactive glyph rather than a restyled `<input
 * disabled>`: a disabled native control still renders with `appearance: auto` unless every browser
 * default is fought individually, and this is a read-only reader — nothing here should look
 * tappable. `role="img"` + `aria-label` keeps the checked/unchecked state announced to assistive
 * tech (same pattern basalt's own `MermaidDiagram` uses for a decorative-but-meaningful SVG).
 * A non-checkbox `<input>` never reaches this pipeline, but falls through to a plain one regardless.
 */
export function ObsidianTaskCheckbox({ type, node: _node, ...rest }: CheckboxProps) {
  // This renders markdown-authored HTML, not app chrome: the node comes from the vault's own
  // source, so there is no Mantine control to swap in and no props seam to thread one through.
  // Since 1.20.0 the annotation needs a rule id AND a reason introduced by a separator; a
  // comment-only line directly above the finding also works, but only the ONE line immediately
  // above it — a multi-line rationale ending in prose waives nothing, so this stays trailing.
  if (type !== 'checkbox') return <input type={type} {...rest} /> // theme-allow raw-form-control — vault-authored markup

  const isChecked = rest.checked === true
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    <span
      role="img"
      aria-label={isChecked ? 'checked' : 'unchecked'}
      className={classes.taskCheckbox}
      style={{ color: isChecked ? 'var(--vx-accent)' : 'var(--vx-muted)' }}
    >
      <TaskCheckboxGlyph checked={isChecked} />
    </span>
  )
}

/**
 * `dataview`/`dataviewjs` fence renderer — this is a READER, not Obsidian: a Dataview query can't
 * run here, so it renders as a labelled, visibly inert block instead of pretending to be runnable
 * code (the default `CodeBlock` fallback offers a copy button for a query that can't be pasted
 * anywhere useful, and tags it with no language at all since `dataview` isn't a real Shiki grammar).
 */
function ObsidianDataviewFence({ code }: { readonly code: string }) {
  return (
    <div className={classes.dataview}>
      <p className={classes.dataviewCaption}>Dataview query (not evaluated)</p>
      <pre className={classes.dataviewCode}>{code}</pre>
    </div>
  )
}

const dataviewFenceRenderer: FenceRenderer = ({ code }) => <ObsidianDataviewFence code={code} />

export const OBSIDIAN_FENCE_RENDERERS: FenceRenderers = {
  dataview: dataviewFenceRenderer,
  dataviewjs: dataviewFenceRenderer,
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
