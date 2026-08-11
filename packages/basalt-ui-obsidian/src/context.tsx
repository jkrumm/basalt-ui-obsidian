/**
 * `VaultProvider` / `useVault` — the one seam every component in this package reads from.
 *
 * The browser never runs `readVault` (it needs a filesystem). It fetches a `VaultBundle` emitted
 * at build time and rehydrates it with `fromVaultBundle`, so the provider takes an already-built
 * `VaultIndex` and adds the things a renderer needs on top of it: how a note path becomes a URL
 * (`hrefFor`), how a URL becomes a link element in whatever router the host app uses (`renderLink`),
 * how a `VaultTreeNode.icon` name becomes an element (`renderIcon`), and how a folder's expand/
 * collapse chevron is drawn (`renderChevron`). All four are consumer-supplied — this package stays
 * router-agnostic AND icon-library-agnostic, the same way `BasaltShell` does for routing.
 * `renderIcon` has no default (unlike `renderLink`'s plain `<a>`): there is no icon-library-free
 * fallback for a per-node Iconize icon, so a missing seam or a missing icon both mean "render
 * nothing" for THAT slot — see `vault-nav.tsx`'s row-icon slot, which then falls back to a small
 * built-in folder/note glyph so every row still gets an icon. `renderChevron` similarly has a
 * built-in default (a hand-drawn inline SVG, no library), so a consumer that doesn't wire it still
 * gets a real vector chevron instead of the raw Unicode glyph the old `VaultNav` rendered.
 */
import { createContext, use, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { VaultIndex, VaultNote } from 'obsidian-vault-core'

/** Turns a resolved note (plus an optional heading anchor) into an href. */
export type VaultHrefResolver = (note: VaultNote, anchor?: string) => string

/** Renders an internal link. `href` is already the output of {@link VaultHrefResolver}. */
export type VaultLinkRenderer = (href: string, children: ReactNode) => ReactNode

/** Renders a `VaultTreeNode.icon` name (an Iconize id like `LiCamera`) as an element. */
export type VaultIconRenderer = (iconName: string) => ReactNode

/** Renders a folder row's expand/collapse chevron. Rotation on expand is `VaultNav`'s own concern
 * (a CSS transform on the wrapping box), so this only ever needs to draw the resting, right-pointing
 * glyph. `undefined` falls back to `VaultNav`'s built-in inline-SVG chevron — see the module doc. */
export type VaultChevronRenderer = () => ReactNode

export type VaultContextValue = {
  readonly index: VaultIndex
  readonly hrefFor: VaultHrefResolver
  readonly renderLink: VaultLinkRenderer
  /** `undefined` when the consumer supplied none — see the module doc for why there's no default. */
  readonly renderIcon: VaultIconRenderer | undefined
  /** `undefined` when the consumer supplied none — `VaultNav` falls back to a built-in chevron. */
  readonly renderChevron: VaultChevronRenderer | undefined
  /**
   * Resolves a raw wikilink target from a note to a complete href, anchor included, or `undefined`
   * for a dead link. This is exactly the callback `remarkObsidianWikilink` wants — it is built
   * here so the anchor-slugging rule lives in one place.
   */
  readonly resolveWikilink: (
    target: string,
    fromPath: string,
    anchor?: string,
  ) => string | undefined
}

const VaultContext = createContext<VaultContextValue | undefined>(undefined)

export type VaultProviderProps = {
  readonly index: VaultIndex
  /** Default: `/${note.slug}` with the anchor slugged via the note's own heading slugs. */
  readonly hrefFor?: VaultHrefResolver
  /** Default: a plain `<a href>`. Supply a router `<Link>` for client-side navigation. */
  readonly renderLink?: VaultLinkRenderer
  /**
   * Default: no icon is rendered at all. Obsidian doesn't reserve icon space for a node its own
   * Iconize plugin has no entry for, and neither does this package — omit this prop and every
   * `VaultNav` row falls back to exactly today's icon-free layout.
   */
  readonly renderIcon?: VaultIconRenderer
  /** Default: `VaultNav`'s own built-in inline-SVG chevron — see the module doc. */
  readonly renderChevron?: VaultChevronRenderer
  readonly children: ReactNode
}

/**
 * Percent-encodes each path segment of a vault slug, leaving the `/` separators intact.
 *
 * Vault slugs are filesystem names, and Obsidian allows characters that are structural in a URL:
 * `#` starts a fragment, `?` a query, `%` an escape. `/Areas/Notes/C# basics` would route to
 * `/Areas/Notes/C` with a `# basics` fragment and the note would be unreachable — from a wikilink,
 * the nav tree, and search alike. Spaces and umlauts (`Ernährungsplan`) merely look wrong; the
 * first three actually break routing.
 */
export function encodeSlugPath(slug: string): string {
  return slug.split('/').map(encodeURIComponent).join('/')
}

function defaultHrefFor(note: VaultNote, anchor?: string): string {
  const base = `/${encodeSlugPath(note.slug)}`
  if (anchor === undefined || anchor === '') return base
  // Obsidian anchors are heading TEXT. Prefer the note's own parsed heading slug so the href
  // matches the id the renderer actually emitted; fall back to the raw text when the heading is
  // gone (a stale link), which at least degrades to a visible, debuggable fragment.
  const heading = note.headings.find((h) => h.text.toLowerCase() === anchor.toLowerCase())
  return `${base}#${heading?.slug ?? anchor}`
}

function defaultRenderLink(href: string, children: ReactNode): ReactNode {
  return <a href={href}>{children}</a>
}

export function VaultProvider({
  index,
  hrefFor,
  renderLink,
  renderIcon,
  renderChevron,
  children,
}: VaultProviderProps) {
  const value = useMemo<VaultContextValue>(() => {
    const href = hrefFor ?? defaultHrefFor
    return {
      index,
      hrefFor: href,
      renderLink: renderLink ?? defaultRenderLink,
      renderIcon,
      renderChevron,
      resolveWikilink: (target, fromPath, anchor) => {
        const note = index.resolve(target, fromPath)
        return note === undefined ? undefined : href(note, anchor)
      },
    }
  }, [index, hrefFor, renderLink, renderIcon, renderChevron])

  return <VaultContext value={value}>{children}</VaultContext>
}

export function useVault(): VaultContextValue {
  const value = use(VaultContext)
  if (value === undefined) throw new Error('useVault must be used inside a <VaultProvider>')
  return value
}
