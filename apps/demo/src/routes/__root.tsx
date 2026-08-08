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
import { Box, Group, Loader, NavLink as MantineNavLink, ScrollArea } from '@mantine/core'
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import type { NavLinkRenderer, SidebarSection } from 'basalt-ui'
import { BasaltShell, EmptyState } from 'basalt-ui'
import { useBasaltNav } from 'basalt-ui/router-tanstack'
import { VX } from 'basalt-ui/tokens'
import { VaultNav, VaultProvider, encodeSlugPath,} from 'basalt-ui-obsidian'
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
        <Group align="flex-start" wrap="nowrap" gap={0} h="100%">
          <Box
            component="aside"
            w={280}
            h="100%"
            style={{ borderRight: `1px solid ${VX.surface.hairline}`, flexShrink: 0 }}
          >
            <ScrollArea h="100%" p="sm">
              <VaultNav {...(activePath !== undefined && { activePath })} />
            </ScrollArea>
          </Box>
          <Box flex={1} h="100%" style={{ minWidth: 0, overflow: 'auto' }} p="md">
            <Outlet />
          </Box>
        </Group>
      </BasaltShell>
    </VaultProvider>
  )
}

export const Route = createRootRoute({ component: RootLayout })
