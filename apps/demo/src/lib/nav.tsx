/**
 * `VAULT_NAV` — the ONE typed navigation definition (basalt-ui 1.19 `defineNav`).
 *
 * It drives BOTH surfaces `BasaltShell` renders: the desktop sidebar section and the mobile bottom
 * bar. `useNav(VAULT_NAV)` (`routes/__root.tsx`) resolves active state through the router and hands
 * back `{ sections, mobileNav }` to spread onto the shell — replacing the hand-rolled `<nav>` tab
 * bar, its stylesheet, and the `renderNavLink` callback this app carried against basalt-ui 1.14,
 * when the shell's own mobile tabs raised a `Drawer` instead of navigating.
 *
 * Every destination is `mobile: 'tab'`, which is exactly `MOBILE_MAX_TABS_DEFAULT` (5) — nothing
 * overflows, so `projectMobileNav` renders five link slots and no "More".
 *
 * `link: linkOptions({...})` rather than a flat `to` is load-bearing, not cosmetic: TanStack's
 * validator is an assignability check and does no excess-property checking, so a flat shape would
 * let a metadata typo compile silently (see `defineNav`'s own doc). The `Register` augmentation that
 * makes `to` a checked literal lives in `../main.tsx`; without it every `to` widens to `string` and
 * this file validates nothing while reporting zero errors.
 *
 * `BROWSE_SURFACES` (`./browse-surfaces.ts`) stays separate on purpose — it is the desktop sidebar
 * strip's LOCAL-STATE switch (see `components/sidebar-panels.tsx`), not a set of routes.
 */
import { linkOptions } from '@tanstack/react-router'
import { defineNav, navGroup } from 'basalt-ui/router-tanstack'
import { Bookmark, Clock, ListTree, Search, Tags } from 'lucide-react'

/** Matches the shell's own slot glyphs; the desktop sidebar row uses the same node. */
const ICON = 18

export const VAULT_NAV = defineNav({
  groups: [
    navGroup({ id: 'vault', label: 'Vault' }, [
      {
        id: 'tree',
        label: 'Tree',
        icon: <ListTree size={ICON} />,
        mobile: 'tab',
        link: linkOptions({ to: '/' }),
      },
      {
        id: 'search',
        label: 'Search',
        icon: <Search size={ICON} />,
        mobile: 'tab',
        // Exact, like every entry here: the five browse routes are siblings of the `$` splat note
        // route, and a prefix match would keep a tab lit while a note page is open.
        exact: true,
        link: linkOptions({ to: '/search' }),
      },
      {
        id: 'tags',
        label: 'Tags',
        icon: <Tags size={ICON} />,
        mobile: 'tab',
        exact: true,
        link: linkOptions({ to: '/tags' }),
      },
      {
        id: 'bookmarks',
        label: 'Bookmarks',
        short: 'Marks',
        icon: <Bookmark size={ICON} />,
        mobile: 'tab',
        exact: true,
        link: linkOptions({ to: '/bookmarks' }),
      },
      {
        id: 'recent',
        label: 'Recent',
        icon: <Clock size={ICON} />,
        mobile: 'tab',
        exact: true,
        link: linkOptions({ to: '/recent' }),
      },
    ]),
  ],
})
