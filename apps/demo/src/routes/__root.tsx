/**
 * Root route — loads the build-time vault bundle via react-query, then wraps the page tree in
 * `<VaultProvider>` (the one seam every basalt-ui-obsidian component reads from) and `<BasaltShell>`
 * (app chrome).
 *
 * `BasaltShell`'s own `sections` prop only takes flat href items (app-level chrome nav), not an
 * arbitrary tree — so the five browse panels render through `sidebarNavExtra` instead
 * (`../components/sidebar-panels.tsx`), the SAME sidebar column `sections` renders into. `sections`
 * still carries a "Home" destination above that strip: on desktop, `SidebarPanels`' Tree tab only
 * switches a local panel (it deliberately does not navigate — see its own doc), `BasaltShell`'s
 * brand is not a link, and the tree renders no root row — without this entry there is no in-app way
 * back to `/` at all. It is a *route* (`href: '/'`), while the tab strip below it switches *panels*;
 * that distinction is what lets both earn their place in the same column.
 */
import { Box, Group, Loader, NavLink as MantineNavLink, Text } from '@mantine/core'
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import type { NavLinkRenderer, SidebarSection } from 'basalt-ui'
import { BasaltShell, EmptyState } from 'basalt-ui'
import { useBasaltNav } from 'basalt-ui/router-tanstack'
import { VaultProvider, encodeSlugPath } from 'basalt-ui-obsidian'
import type { VaultHrefResolver, VaultLinkRenderer } from 'basalt-ui-obsidian'
import { SidebarPanels } from '../components/sidebar-panels'
import { BROWSE_SURFACES } from '../lib/browse-surfaces'
import type { BrowseSurfaceKey } from '../lib/browse-surfaces'
import { useVaultIndexQuery } from '../lib/vault-data'
import { renderVaultChevron, renderVaultIcon } from '../lib/vault-icons'
import { openVaultSearch, VaultSearchSpotlight } from '../lib/vault-search-spotlight'

/** Inline glyph — matches the shell's own icon-dependency-free convention (no @tabler/icons). */
function IconHome() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  )
}

/** The five browse surfaces' hrefs, in tab-bar order — derived from `../lib/browse-surfaces.ts`'s
 * `key` (single source of truth for label/icon/order), since the mobile bottom bar below needs an
 * actual route to `<Link to>` and the shared module intentionally stays route-agnostic so
 * `../components/sidebar-panels.tsx` can read the same `key` as a local-state switch instead. */
const MOBILE_TABS: readonly {
  readonly key: BrowseSurfaceKey
  readonly label: string
  readonly Icon: LucideIcon
  readonly href: '/' | '/search' | '/tags' | '/bookmarks' | '/recent'
}[] = BROWSE_SURFACES.map((surface) => ({
  ...surface,
  href:
    surface.key === 'tree' ? '/' : (`/${surface.key}` as '/search' | '/tags' | '/bookmarks' | '/recent'),
}))

// Mirrors VaultProvider's own default (context.tsx) explicitly, so the URL shape stays a documented
// contract of this app's routing rather than an implicit package default.
const hrefFor: VaultHrefResolver = (note, anchor) => {
  // Per-segment encoding, not the raw slug: `#`, `?` and `%` are legal in Obsidian filenames and
  // structural in a URL — see `encodeSlugPath`'s doc. `routes/$.tsx` reads the splat param, which
  // TanStack Router hands back already decoded, so the round trip closes.
  const base = `/${encodeSlugPath(note.slug)}`
  if (anchor === undefined || anchor === '') return base
  const heading = note.headings.find((h) => h.text.toLowerCase() === anchor.toLowerCase())
  return `${base}#${heading?.slug ?? anchor}`
}

/** Inverse of {@link encodeSlugPath} — recovers a vault slug from an encoded pathname. */
function decodeSlugPath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join('/')
}

const renderLink: VaultLinkRenderer = (href, children) => <Link to={href as never}>{children}</Link>

const renderNavLink: NavLinkRenderer = (item, { active }) => (
  <MantineNavLink
    component={Link}
    to={(item.href ?? '/') as never}
    label={item.label}
    leftSection={item.icon}
    active={active}
  />
)

function RootLayout() {
  const { data: index, isLoading, isError, error } = useVaultIndexQuery()
  const { currentPath, isActive } = useBasaltNav()

  // Restores the one route the sidebar had no other way back to — see the module doc for why this
  // entry, alone, earns a place beside `sidebarNavExtra`'s panel-switching strip.
  const sections: SidebarSection[] = [
    {
      label: 'Vault',
      items: [{ key: 'home', label: 'Home', icon: <IconHome />, href: '/', active: isActive('/') }],
    },
  ]

  if (isLoading) {
    return (
      <Group h="100dvh" justify="center" align="center">
        <Loader />
      </Group>
    )
  }

  if (isError || index === undefined) {
    return (
      <Group h="100dvh" justify="center" align="center">
        <EmptyState
          title="Vault failed to load"
          description={error instanceof Error ? error.message : 'Unknown error loading vault.json'}
        />
      </Group>
    )
  }

  // `currentPath` is the raw pathname, so it carries whatever `hrefFor` encoded — decode it back
  // before looking the note up, or every slug with a space or umlaut misses `bySlug`.
  const activeSlug = currentPath === '/' ? undefined : decodeSlugPath(currentPath.slice(1))
  const activePath = activeSlug !== undefined ? index.bySlug.get(activeSlug)?.path : undefined

  return (
    <VaultProvider
      index={index}
      hrefFor={hrefFor}
      renderLink={renderLink}
      renderIcon={renderVaultIcon}
      renderChevron={renderVaultChevron}
    >
      <VaultSearchSpotlight />
      <BasaltShell
        brand={{ name: 'Brain' }}
        sections={sections}
        renderNavLink={renderNavLink}
        search={{ onOpen: openVaultSearch }}
        sidebarNavExtra={<SidebarPanels activePath={activePath} />}
      >
        {/* The note tree used to render as a second, content-level nav column (its own `<aside>`,
            beside `<Outlet />`) — now it's inside `sidebarNavExtra` on `BasaltShell` instead
            (`../components/sidebar-panels.tsx`), appended after `sections` inside the SHELL's own nav
            `ScrollArea` (see that prop's JSDoc in `basalt-ui/shell`). That scroll region is entirely
            the sidebar's: bounded to the sidebar's own height, independent of this content column. It
            was never involved in the page-level scrolling below, so removing the old aside changes
            nothing about it. `<Outlet />` was always in normal page flow with no height/overflow of
            its own — that's what lets `position: sticky` on `ArticleLayout`'s TOC rail, several
            ancestors down, pick up scroll range against the viewport. Still true with the aside gone;
            verified against `article-layout.module.css`, whose `.tocRail` sticks off the same
            document scroll this `<Box>` has always deferred to. `BrowsePage` (the five browse routes'
            own wrapper) relies on that same contract — see its module doc. */}
        <Box p="md">
          <Outlet />
        </Box>
        {/* Mobile bottom tab bar: five full-page browse routes, replacing `BasaltShell`'s own
            built-in mobile nav (the whole `footer.mantine-AppShell-footer` is hidden in
            `styles/safe-area.css` — hiding only the `nav` inside it left an opaque fixed box painting
            over this bar), whose "Vault" tab opened a sheet containing only the Home link and whose
            "More" tab duplicated it via the full navbar overlay — neither surfaced the actual note
            tree. Each tab IS its destination page now (`../routes/index.tsx`, `tags.tsx`,
            `bookmarks.tsx`, `recent.tsx`, `search.tsx`) rather than a drawer/spotlight trigger, so the
            URL is always a real, shareable, back-button-friendly pointer at whichever browse surface
            is open — the opposite of the desktop sidebar strip's local-state switch (see
            `sidebar-panels.tsx`'s own doc for why that asymmetry is deliberate). */}
        <Box component="nav" hiddenFrom="sm" aria-label="Primary" className="mobile-shell-tabbar">
          {MOBILE_TABS.map(({ href, label, Icon }) => {
            // `exact: true` even for `/`, whose own `isActive` already forces exact matching
            // (`useBasaltNav`'s own doc) — explicit here so every tab in this list follows the same
            // rule and none of the five can accidentally prefix-match a note route.
            const active = isActive(href, { exact: true })
            return (
              // A real router `Link`, not a click handler — cmd-click, long-press, and
              // open-in-new-tab all need a genuine anchor `href` underneath, which only `Link`
              // provides.
              <Link
                key={href}
                to={href}
                className="mobile-shell-tab"
                aria-label={label}
                data-active={active || undefined}
                {...(active && { 'aria-current': 'page' as const })}
              >
                <Icon size={18} aria-hidden="true" />
                <Text component="span" className="mobile-shell-tab-label">
                  {label}
                </Text>
              </Link>
            )
          })}
        </Box>
      </BasaltShell>
    </VaultProvider>
  )
}

export const Route = createRootRoute({ component: RootLayout })
