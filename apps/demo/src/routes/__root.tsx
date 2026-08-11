/**
 * Root route — loads the build-time vault bundle via react-query, then wraps the page tree in
 * `<VaultProvider>` (the one seam every basalt-ui-obsidian component reads from) and `<BasaltShell>`
 * (app chrome).
 *
 * `BasaltShell`'s own `sections` prop only takes flat href items (app-level chrome nav), not an
 * arbitrary tree — so the actual note tree (`VaultNav`) renders through `sidebarNavExtra` instead,
 * the SAME sidebar column `sections` renders into (appended after them, inside its nav
 * `ScrollArea`). `sections` still carries a "Home" destination above the tree — see the comment on
 * `sections` below for why that entry earns its place rather than collapsing to `sections={[]}`.
 */
import {
  Box,
  Drawer,
  Group,
  Loader,
  NavLink as MantineNavLink,
  ScrollArea,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { NavLinkRenderer, SidebarSection } from 'basalt-ui'
import { BasaltShell, EmptyState } from 'basalt-ui'
import { useBasaltNav } from 'basalt-ui/router-tanstack'
import { VaultNav, VaultProvider, encodeSlugPath } from 'basalt-ui-obsidian'
import type { VaultHrefResolver, VaultLinkRenderer } from 'basalt-ui-obsidian'
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

/** The mobile note-tree drawer trigger — same inline-glyph convention as `IconHome` above. */
function IconMenu() {
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
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  )
}

/** The mobile search-tab trigger — same inline-glyph convention as `IconHome` above. */
function IconSearch() {
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
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35 -4.35" />
    </svg>
  )
}

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
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false)

  // Selecting a note must close the drawer regardless of how it happened (a row click, the vault
  // search spotlight, browser back/forward) — `currentPath` already changes for all of those, so
  // this is the one place that has to know, rather than threading a close call through every
  // possible navigation source. `VaultNav`'s own `onNavigate` (wired below) covers the common
  // click case synchronously, before the route even changes; this is the fallback for the rest.
  useEffect(() => {
    closeDrawer()
  }, [currentPath, closeDrawer])

  // Kept, not collapsed to `sections={[]}`: `VaultNav` renders `index.tree.children` only — there
  // is no root-level row in the tree itself that links back to `/`, so this is still the sole way
  // back to the index route. It now sits directly above the tree in the same sidebar column
  // (the section-spacing rule puts one divider between them), which is the same brand/search/
  // home/tree order Obsidian's own sidebar uses.
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
        sidebarNavExtra={<VaultNav {...(activePath !== undefined && { activePath })} />}
      >
        {/* The note tree used to render as a second, content-level nav column (its own `<aside>`,
            beside `<Outlet />`) — now it's `sidebarNavExtra` on `BasaltShell` instead, appended
            after `sections` inside the SHELL's own nav `ScrollArea` (see that prop's JSDoc in
            `basalt-ui/shell`). That scroll region is entirely the sidebar's: bounded to the
            sidebar's own height, independent of this content column. It was never involved in the
            page-level scrolling below, so removing the old aside changes nothing about it.
            `<Outlet />` was always in normal page flow with no height/overflow of its own — that's
            what lets `position: sticky` on `ArticleLayout`'s TOC rail, several ancestors down, pick
            up scroll range against the viewport. Still true with the aside gone; verified against
            `article-layout.module.css`, whose `.tocRail` sticks off the same document scroll this
            `<Box>` has always deferred to. */}
        <Box p="md">
          <Outlet />
        </Box>
        <Drawer
          opened={drawerOpened}
          onClose={closeDrawer}
          position="left"
          size={280}
          padding={0}
          title="Notes"
          // `padding={0}` is for the BODY — the tree brings its own `p="sm"` below and a doubled
          // inset wastes scarce phone width. But Mantine's `padding` prop feeds the header too,
          // which left the "Notes" title and its close button flush against the screen edges. The
          // header gets its inset back through its own class rather than by raising `padding`.
          classNames={{ body: 'vault-nav-drawer-body', header: 'vault-nav-drawer-header' }}
        >
          <ScrollArea h="100%" p="sm">
            <VaultNav {...(activePath !== undefined && { activePath })} onNavigate={closeDrawer} />
          </ScrollArea>
        </Drawer>
        {/* Mobile bottom action bar: replaces `BasaltShell`'s own built-in mobile nav (the whole
            `footer.mantine-AppShell-footer` is hidden in `styles/safe-area.css` — hiding only the
            `nav` inside it left an opaque fixed box painting over this bar), whose
            "Vault" tab opened a sheet containing only the Home link and whose "More" tab duplicated
            it via the full navbar overlay — neither surfaced the actual note tree. Three direct
            actions instead: home (the app-shell header this app deletes at every breakpoint,
            `styles/safe-area.css`, was the only other back-to-home affordance), the note tree (this
            file's own `Drawer` above) and search (`openVaultSearch`,
            `../lib/vault-search-spotlight`). */}
        <Box component="nav" hiddenFrom="sm" aria-label="Primary" className="mobile-shell-tabbar">
          {/* A real router `Link`, not a click handler — cmd-click, long-press, and open-in-new-tab
              all need a genuine anchor `href` underneath, which only `Link` provides. */}
          <Link to="/" className="mobile-shell-tab" aria-label="Go to vault home">
            <IconHome />
            <Text component="span" className="mobile-shell-tab-label">
              Home
            </Text>
          </Link>
          <UnstyledButton
            type="button"
            className="mobile-shell-tab"
            onClick={openDrawer}
            aria-label="Open note tree"
          >
            <IconMenu />
            <Text component="span" className="mobile-shell-tab-label">
              Vault
            </Text>
          </UnstyledButton>
          <UnstyledButton
            type="button"
            className="mobile-shell-tab"
            onClick={openVaultSearch}
            aria-label="Open search"
          >
            <IconSearch />
            <Text component="span" className="mobile-shell-tab-label">
              Search
            </Text>
          </UnstyledButton>
        </Box>
      </BasaltShell>
    </VaultProvider>
  )
}

export const Route = createRootRoute({ component: RootLayout })
