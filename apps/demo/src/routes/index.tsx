/**
 * Vault index route — splits by breakpoint rather than rendering the same panel everywhere, because
 * the desktop sidebar (`../components/sidebar-panels.tsx`) already carries the note tree PERMANENTLY
 * beside the content column. Rendering `VaultTreePanel` here too on desktop showed the identical tree
 * twice — narrow in the sidebar, wide in the content column. Below `sm` there is no sidebar (the
 * phone's tab bar is the only nav), so the tree stays here unchanged — it's the whole "Tree" tab
 * reached from the bottom bar. At `sm` and up, the content column's job is to be a landing surface
 * instead, and most-recently-edited notes is the one view that earns that slot the desktop sidebar
 * doesn't already own.
 *
 * `hiddenFrom`/`visibleFrom` (CSS breakpoints), not a JS branch: `useSizeClass()` answers `compact`
 * on the first paint and the real class one commit later, which would flash the tree on desktop.
 * Since basalt-ui 1.31 `sm` IS the shell's compact/medium boundary (52.5em) — exactly where the
 * sidebar that carries the tree appears — so this swap mirrors shell chrome rather than guessing a
 * page width, and is waived below rather than moved onto a container.
 */
import { Box } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { VaultRecentPanel, VaultTreePanel } from 'basalt-ui-obsidian'
import { BrowsePage } from '../components/browse-page'

function IndexPage() {
  return (
    <>
      {/* Each branch wraps its OWN `BrowsePage` (title + panel), not just the panel — `display: none`
          removes a hidden branch from the accessibility tree entirely, so only the visible branch's
          `<h1>` is ever exposed. Wrapping only the panel would leave both titles in the DOM at once. */}
      {/* theme-allow raw-breakpoint — mirrors the shell's own sidebar presence (compact class), CSS-only so desktop never flashes the tree */}
      <Box hiddenFrom="sm">
        <BrowsePage title="Vault">
          <VaultTreePanel />
        </BrowsePage>
      </Box>
      {/* theme-allow raw-breakpoint — the other half of the shell-chrome swap above */}
      <Box visibleFrom="sm">
        <BrowsePage title="Recently updated">
          <VaultRecentPanel />
        </BrowsePage>
      </Box>
    </>
  )
}

export const Route = createFileRoute('/')({ component: IndexPage })
