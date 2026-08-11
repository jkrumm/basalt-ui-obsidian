/**
 * `BrowsePage` — the shared wrapper behind all five browse routes (`routes/index.tsx`,
 * `routes/search.tsx`, `routes/tags.tsx`, `routes/bookmarks.tsx`, `routes/recent.tsx`). Renders a
 * plain page heading above the panel body — one real `<h1>` per page, so a screen reader's page
 * structure actually reflects the surface a phone's bottom tab bar (or a desktop sidebar tab) just
 * switched to, rather than five pages sharing one implicit "app" heading.
 *
 * These five static paths sit alongside the existing `$.tsx` splat note route. TanStack ranks static
 * segments above a splat, so `/tags` etc. always win the match — but a top-level vault note whose
 * slug is literally `tags`/`search`/`recent`/`bookmarks` would become permanently unreachable at its
 * own URL. This is a known, accepted constraint rather than something worth a runtime guard: the
 * vault's own contract forbids root-level notes ("Never write to the vault root — always into a
 * dated/classified folder", `brain/CLAUDE.md`), so a top-level note of any name — these five included
 * — cannot exist in the first place, not just "doesn't today".
 *
 * No `Card`/`Paper`/border/shadow: the panels this wraps (`src/panels/`) are flat lists, and the page
 * chrome around them stays flat too, matching the panel body itself. `maw={780}` keeps a phone's
 * page unaffected (its viewport is already narrower) while stopping a desktop-width list of 28px rows
 * from stretching across the whole content column. The page scrolls WITH the document — no inner
 * `overflow`/`height` here — because `__root.tsx`'s `<Outlet/>` is deliberately left in normal flow
 * so `$.tsx`'s note route can rely on a sticky TOC rail measuring scroll range against the viewport;
 * introducing an inner scroll container on this wrapper would silently break that for every route
 * sharing it.
 */
import type { ReactNode } from 'react'
import { Box, Text } from '@mantine/core'

export type BrowsePageProps = {
  readonly title: string
  readonly children: ReactNode
}

export function BrowsePage({ title, children }: BrowsePageProps) {
  return (
    <Box maw={780}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0 10px' }}>
        <Text component="h1" style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          {title}
        </Text>
      </div>
      {children}
    </Box>
  )
}
