/**
 * `SidebarPanels` — the `kind: 'custom'` entry in `BasaltShell`'s `sidebarBlocks`, desktop-only: a
 * sticky strip of five icon tabs (Tree/Search/Tags/Bookmarks/Recent) above whichever of the five
 * panels is currently selected.
 *
 * Selection is local state persisted to `localStorage` under `brain:sidebar-panel` — deliberately
 * NOT URL-driven. The desktop sidebar sits BESIDE a note: switching to Tags while reading a note must
 * not navigate away from it, and a single pathname can't encode "show note X" and "show panel Y" at
 * once. The five NAV destinations (`../lib/nav.tsx`, rendered by basalt-ui's own shell as the sidebar
 * section above this strip and as the mobile bottom bar) are URL-driven for exactly the opposite
 * reason — there the panel IS the whole page, so the URL is the natural, shareable,
 * back-button-friendly source of truth for it.
 *
 * `TABS` reads from `../lib/browse-surfaces.ts` — the single source of truth for the five browse
 * surfaces' labels/icons/order for THIS strip; `../lib/nav.tsx` is the routed counterpart. This strip
 * renders icons at 16px (the shell's bar uses 18px), deliberately.
 */
import { useState } from 'react'
import { UnstyledButton } from '@mantine/core'
import {
  VaultBookmarksPanel,
  VaultRecentPanel,
  VaultSearchPanel,
  VaultTagsPanel,
  VaultTreePanel,
} from 'basalt-ui-obsidian'
import { BROWSE_SURFACES } from '../lib/browse-surfaces'
import type { BrowseSurfaceKey } from '../lib/browse-surfaces'
import { useNavigateToSearch } from '../lib/navigate-to-search'
import { useSearchIndexQuery } from '../lib/vault-data'
import classes from './sidebar-panels.module.css'

type PanelKey = BrowseSurfaceKey

const STORAGE_KEY = 'brain:sidebar-panel'
const DEFAULT_PANEL: PanelKey = 'tree'

const TABS = BROWSE_SURFACES

/** Exported for `sidebar-panels.test.ts` — no consumer outside this module needs the guard. */
export function isPanelKey(value: string | null): value is PanelKey {
  return (
    value === 'tree' ||
    value === 'search' ||
    value === 'tags' ||
    value === 'bookmarks' ||
    value === 'recent'
  )
}

/** Guarded for SSR (`typeof window`) and private-mode Safari / quota-exceeded (`try`/`catch`) — same
 * two guards this package's own panels apply to their `localStorage` reads (`bookmarks-panel.tsx`,
 * `use-recently-viewed.ts`). Exported for `sidebar-panels.test.ts`. */
export function loadPanel(): PanelKey {
  if (typeof window === 'undefined') return DEFAULT_PANEL
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isPanelKey(raw) ? raw : DEFAULT_PANEL
  } catch {
    return DEFAULT_PANEL
  }
}

/** Exported for `sidebar-panels.test.ts`. */
export function savePanel(panel: PanelKey): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, panel)
  } catch {
    // quota exceeded / private-mode Safari — the selection just doesn't persist this session
  }
}

export type SidebarPanelsProps = {
  readonly activePath: string | undefined
}

export function SidebarPanels({ activePath }: SidebarPanelsProps) {
  const [panel, setPanel] = useState<PanelKey>(loadPanel)
  // The build-time MiniSearch index, same reasoning as `../routes/search.tsx` — passed only once
  // loaded, since `VaultSearchPanel` builds its own fallback from the vault index in the meantime.
  const { data: searchIndex } = useSearchIndexQuery()

  const select = (next: PanelKey): void => {
    setPanel(next)
    savePanel(next)
  }

  // A `search`-type bookmark (`VaultBookmarksPanel`'s `onOpenSearch`) navigates to the full `/search`
  // page rather than switching this strip to its own `search` tab — the query needs a shareable,
  // back-button-friendly URL more than it needs to stay inside the sidebar.
  const onOpenSearch = useNavigateToSearch()

  return (
    <div>
      <div role="group" aria-label="Browse vault" className={classes.strip}>
        {TABS.map(({ key, label, Icon }) => {
          const selected = panel === key
          return (
            <UnstyledButton
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={selected}
              data-selected={selected}
              onClick={() => select(key)}
              className={classes.tab}
            >
              <Icon size={16} aria-hidden="true" />
            </UnstyledButton>
          )
        })}
      </div>
      {panel === 'tree' && <VaultTreePanel {...(activePath !== undefined && { activePath })} />}
      {panel === 'search' && (
        <VaultSearchPanel
          {...(activePath !== undefined && { activePath })}
          {...(searchIndex !== undefined && { searchIndex })}
        />
      )}
      {panel === 'tags' && <VaultTagsPanel {...(activePath !== undefined && { activePath })} />}
      {panel === 'bookmarks' && (
        <VaultBookmarksPanel
          {...(activePath !== undefined && { activePath })}
          onOpenSearch={onOpenSearch}
        />
      )}
      {panel === 'recent' && <VaultRecentPanel {...(activePath !== undefined && { activePath })} />}
    </div>
  )
}
