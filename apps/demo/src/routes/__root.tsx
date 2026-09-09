/**
 * Root route — loads the build-time vault bundle via react-query, then wraps the page tree in
 * `<VaultProvider>` (the one seam every basalt-ui-obsidian component reads from) and `<BasaltShell>`
 * (app chrome).
 *
 * Navigation is ONE typed definition — `VAULT_NAV` (`../lib/nav.tsx`) — resolved by `useNav` and
 * spread onto the shell, which renders it as both the desktop sidebar section and the mobile bottom
 * bar. Against basalt-ui 1.14 this app hand-rolled that bar (a `<nav>` of router `Link`s plus ~50
 * lines of CSS) because the shell's own mobile tabs raised a full-viewport `Drawer` rather than
 * navigating; 1.19's bar IS a set of destinations, so the hand-rolled one and its stylesheet are
 * gone.
 *
 * The five browse destinations appear TWICE on desktop by design, and the two are different things:
 * the sidebar section navigates (each tab is a full page with a shareable URL), while the
 * `sidebarBlocks` strip (`../components/sidebar-panels.tsx`) switches a LOCAL panel beside the note
 * you are reading without leaving it. Before this migration the five routes had no desktop entry
 * point at all.
 */
import { Box, Group, Loader } from '@mantine/core'
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { BasaltShell, EmptyState } from 'basalt-ui'
import { useBasaltNav, useNav } from 'basalt-ui/router-tanstack'
import { VaultProvider, encodeSlugPath } from 'basalt-ui-obsidian'
import type { VaultHrefResolver, VaultLinkRenderer } from 'basalt-ui-obsidian'
import { SidebarPanels } from '../components/sidebar-panels'
import { VAULT_NAV } from '../lib/nav'
import { useVaultIndexQuery } from '../lib/vault-data'
import { renderVaultChevron, renderVaultIcon } from '../lib/vault-icons'
import { openVaultSearch, VaultSearchSpotlight } from '../lib/vault-search-spotlight'

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

function RootLayout() {
  const { data: index, isLoading, isError, error } = useVaultIndexQuery()
  const { currentPath } = useBasaltNav()
  const nav = useNav(VAULT_NAV)

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
        {...nav}
        search={{ onOpen: openVaultSearch }}
        // basalt-ui 1.26.0 removed `sidebarNavExtra` outright; a `kind: 'custom'` block is its
        // documented replacement and keeps every property this strip relied on — same DOM position
        // (last child of the sidebar's own nav scroll region), same CSS-only hiding in the collapsed
        // rail, still desktop-only (a custom block is deliberately NOT projected into the mobile
        // More sheet, `sidebar-block-model.ts`). `key` is basalt's list key, not a React one.
        sidebarBlocks={[
          { kind: 'custom', key: 'vault-panels', node: <SidebarPanels activePath={activePath} /> },
        ]}
      >
        {/* The note tree used to render as a second, content-level nav column (its own `<aside>`,
            beside `<Outlet />`) — now it's a `sidebarBlocks` entry on `BasaltShell` instead
            (`../components/sidebar-panels.tsx`), appended after `sections` inside the SHELL's own nav
            `ScrollArea` (see `SidebarBlock`'s JSDoc in `basalt-ui`). That scroll region is entirely
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
      </BasaltShell>
    </VaultProvider>
  )
}

export const Route = createRootRoute({ component: RootLayout })
