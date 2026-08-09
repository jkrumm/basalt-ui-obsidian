/**
 * Root route — loads the build-time vault bundle via react-query, then wraps the page tree in
 * `<VaultProvider>` (the one seam every basalt-ui-obsidian component reads from) and `<BasaltShell>`
 * (app chrome).
 *
 * `BasaltShell`'s own `sections` prop only takes flat href items (app-level chrome nav), not an
 * arbitrary tree — so the actual note tree (`VaultNav`) renders as a content-level nav column here
 * instead, alongside the routed page (`<Outlet />`). `sections` carries just a "Home" destination
 * back to the index route.
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
import { VX } from 'basalt-ui/tokens'
import { VaultNav, VaultProvider, encodeSlugPath } from 'basalt-ui-obsidian'
import type { VaultHrefResolver, VaultLinkRenderer } from 'basalt-ui-obsidian'
import { useVaultIndexQuery } from '../lib/vault-data'
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
    <VaultProvider index={index} hrefFor={hrefFor} renderLink={renderLink}>
      <VaultSearchSpotlight />
      <BasaltShell
        brand={{ name: 'Brain' }}
        sections={sections}
        renderNavLink={renderNavLink}
        search={{ onOpen: openVaultSearch }}
      >
        {/* `sm` (48em) is `BasaltShell`'s own navbar breakpoint (`shell/index.tsx`'s
            `navbar={{ breakpoint: 'sm' }}`) — matched here rather than a new one, so the tree
            column and the shell's own rail collapse at the same viewport width.
            No explicit height/overflow on this row: both children now stay in NORMAL page flow and
            the page itself scrolls (via `AppShell.Main`), which is what lets `position: sticky`
            below (and `ArticleLayout`'s own sticky TOC rail, several ancestors down inside
            `<Outlet />`) actually pick up scroll range against the viewport. A bounded,
            internally-scrolling column looked right on paper but its height never reliably tracked
            `100dvh` across `AppShell`'s breakpoints, leaving the aside `position: static` with a
            dead multi-thousand-pixel tail once the page outgrew it — and the same bounded
            `overflow: auto` on the content column starved the TOC's sticky ancestor of any actual
            scroll range. */}
        <Group align="flex-start" wrap="nowrap" gap={0}>
          <Box
            component="aside"
            visibleFrom="sm"
            w={280}
            style={{
              borderRight: `1px solid ${VX.surface.hairline}`,
              flexShrink: 0,
              position: 'sticky',
              top: 'var(--app-shell-header-height, 0px)',
              maxHeight: 'calc(100dvh - var(--app-shell-header-height, 0px))',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ScrollArea style={{ flex: 1, minHeight: 0 }} p="sm">
              <VaultNav {...(activePath !== undefined && { activePath })} />
            </ScrollArea>
          </Box>
          <Box flex={1} style={{ minWidth: 0 }} p="md">
            <Outlet />
          </Box>
        </Group>
        <Drawer
          opened={drawerOpened}
          onClose={closeDrawer}
          position="left"
          size={280}
          padding={0}
          title="Notes"
          classNames={{ body: 'vault-nav-drawer-body' }}
        >
          <ScrollArea h="100%" p="sm">
            <VaultNav {...(activePath !== undefined && { activePath })} onNavigate={closeDrawer} />
          </ScrollArea>
        </Drawer>
        {/* Mobile bottom action bar: replaces `BasaltShell`'s own built-in mobile nav (hidden via
            `.mantine-AppShell-footer nav { display: none }` in `styles/safe-area.css`), whose
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
