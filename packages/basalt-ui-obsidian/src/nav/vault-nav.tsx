/**
 * VaultNav — a real recursive tree over `VaultIndex.tree`. `AppSidebar`'s `SidebarItem.children`
 * (basalt-ui/shell) is one level deep, rendered as a hover popover — a vault nests arbitrarily
 * deep, so this component owns its own collapsible tree instead of projecting into `SidebarItem`.
 *
 * Folder-note convention: a folder containing `{folderName}.md` (e.g. `Areas/Gaming/Wild
 * Rift/Wild Rift.md`) is itself navigable — the folder-note child is hidden from the rendered
 * children (the folder row IS that note now) and the row's label links to it. A folder without
 * one stays a plain label that only toggles expansion.
 *
 * Row chrome: VaultNav owns its own appearance instead of depending on the consumer's `renderLink`
 * styling — hover/active background, text color/weight, and the disclosure chevron are all inline
 * `VX.*`/`alpha()` styling on components this file renders directly (`rowVisualStyle`/`RowLabel`
 * below). The one exception is the anchor's own UA-default color/underline: `renderLink` hands back
 * a consumer-rendered element whose defaults live directly ON it, which an ancestor's inline style
 * cannot reach — see `vault-nav.module.css`'s doc for why that one piece needs a real stylesheet
 * rule, and `useVaultSearch`/`Backlinks` for the same `renderLink` seam used unstyled elsewhere.
 *
 * Indentation is a flat `depth * INDENT_PX` inline offset applied to each row directly, not a
 * recursive `pl="md"` wrapper — the wrapper approach compounded with the chevron button's own
 * padding into ~36px per level and a ~110px opening gutter four levels deep. Expanded/collapsed
 * state persists via `useLocalStorage`, the same primitive `BasaltShell` uses for its own collapse
 * state (`shell/index.tsx`), but the ACTIVE path's ancestors always win: the effect below REPLACES
 * (not unions) the expanded set on every navigation, so the tree reads "collapsed except the active
 * path" instead of accumulating every folder a session ever opened.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Box, Stack, Text, UnstyledButton } from '@mantine/core'
import { useLocalStorage, useReducedMotion } from '@mantine/hooks'
import { VX, alpha } from 'basalt-ui/tokens'
import type { VaultNote, VaultTreeNode } from 'obsidian-vault-core'
import { useVault } from '../context.js'
import classes from './vault-nav.module.css'

export type VaultNavProps = {
  readonly activePath?: string
  /** localStorage key for the persisted expanded-folder set. */
  readonly storageKey?: string
  readonly className?: string
  /** Fires whenever a note row is selected (a plain note, or a folder-note link) — the demo shell's
   * mobile drawer wires this to close itself on navigation; the desktop aside instance leaves it
   * unset. Never fires for a chevron toggle (expanding a folder isn't navigating). */
  readonly onNavigate?: () => void
}

/** Per-level indent — a flat step applied directly to each row (see the module doc). */
const INDENT_PX = 12
const ROW_GAP = 8
const ROW_PADDING_Y = 6

/** The note that makes `node`'s own row navigable — a child note whose basename === the folder's name. */
function folderNoteOf(node: VaultTreeNode): VaultNote | undefined {
  return node.children?.find((child) => child.kind === 'note' && child.note?.basename === node.name)
    ?.note
}

/** Vault-relative folder paths from the root down to (excluding) the note itself. */
function ancestorFolderPaths(path: string): string[] {
  const segments = path.split('/').slice(0, -1)
  const paths: string[] = []
  let current = ''
  for (const segment of segments) {
    current = current === '' ? segment : `${current}/${segment}`
    paths.push(current)
  }
  return paths
}

/** Two lists contain the same paths, order and prior insertion history ignored. */
function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((path) => set.has(path))
}

type RowLabelProps = {
  readonly label: string
  readonly color: string
  readonly weight: number
}

/**
 * The text this file owns inside a row. `textDecoration: 'none'` set HERE (not on an ancestor) is
 * deliberate: a descendant that specifies its own `text-decoration-line` stops the anchor's
 * underline from painting through it, regardless of the anchor's own computed value — the same
 * belt to `vault-nav.module.css`'s suspenders. `color` is likewise always an explicit resolved
 * value, never `inherit` — inheriting would pull the anchor's own UA link color (the direct
 * parent), not the row's resolved one.
 */
function RowLabel({ label, color, weight }: RowLabelProps) {
  return (
    <Text
      size="sm"
      fw={weight}
      truncate="end"
      style={{ color, textDecoration: 'none', minWidth: 0 }}
    >
      {label}
    </Text>
  )
}

type VaultNavRowProps = {
  readonly node: VaultTreeNode
  readonly activePath: string | undefined
  readonly expanded: ReadonlySet<string>
  readonly onToggle: (path: string) => void
  readonly depth: number
  readonly onNavigate?: () => void
}

/** Resolved background/rail for a row's interaction state — the single source both the note and
 * folder branches read, so hover/active look identical regardless of which one rendered it. */
function rowVisualStyle({
  hovered,
  active,
  depth,
}: {
  hovered: boolean
  active: boolean
  depth: number
}): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: ROW_GAP,
    paddingLeft: depth * INDENT_PX,
    paddingRight: 8,
    paddingTop: ROW_PADDING_Y,
    paddingBottom: ROW_PADDING_Y,
    borderRadius: 'var(--vx-radius-tight)',
    cursor: 'pointer',
    backgroundColor: active
      ? alpha(VX.accent, 0.12)
      : hovered
        ? alpha(VX.ink, 0.06)
        : 'transparent',
    boxShadow: active ? `inset 3px 0 0 ${VX.accent}` : 'none',
    transition: 'background-color 120ms ease',
  }
}

function VaultNavRow({
  node,
  activePath,
  expanded,
  onToggle,
  depth,
  onNavigate,
}: VaultNavRowProps) {
  const { hrefFor, renderLink } = useVault()
  const [hovered, setHovered] = useState(false)
  const hoverHandlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  }

  if (node.kind === 'note') {
    if (node.note === undefined) return null
    const note = node.note
    const active = note.path === activePath
    const color = active || hovered ? VX.ink : VX.ink2
    return (
      <div
        className={classes.row}
        data-active={active || undefined}
        style={rowVisualStyle({ hovered, active, depth })}
        onClick={onNavigate}
        {...hoverHandlers}
      >
        <div className={classes.anchorReset} style={{ flex: 1, minWidth: 0 }}>
          {renderLink(
            hrefFor(note),
            <RowLabel label={note.title} color={color} weight={active ? 600 : 400} />,
          )}
        </div>
      </div>
    )
  }

  const folderNote = folderNoteOf(node)
  const children = (node.children ?? []).filter(
    (child) => folderNote === undefined || child.note?.path !== folderNote.path,
  )
  const isOpen = expanded.has(node.path)
  const active = folderNote !== undefined && folderNote.path === activePath
  // Structural, not content — a folder label rests a shade dimmer than a note's (`VX.muted` vs
  // `VX.ink2`), on top of the bold weight below and the chevron, so a folder row reads differently
  // from a note row at a glance, not just by a ~6px triangle.
  const color = active || hovered ? VX.ink : VX.muted

  const chevron = (
    <UnstyledButton
      onClick={() => onToggle(node.path)}
      aria-expanded={isOpen}
      aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
      className={classes.chevron}
    >
      <Text
        component="span"
        size="xs"
        style={{
          color: VX.faint,
          display: 'inline-block',
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 120ms ease',
        }}
      >
        ▸
      </Text>
    </UnstyledButton>
  )

  return (
    <Box>
      <div
        className={classes.row}
        data-active={active || undefined}
        style={rowVisualStyle({ hovered, active, depth })}
        {...hoverHandlers}
      >
        {chevron}
        {folderNote !== undefined ? (
          <div
            className={classes.anchorReset}
            style={{ flex: 1, minWidth: 0 }}
            onClick={onNavigate}
          >
            {renderLink(
              hrefFor(folderNote),
              <RowLabel label={node.name} color={color} weight={600} />,
            )}
          </div>
        ) : (
          <UnstyledButton
            onClick={() => onToggle(node.path)}
            style={{ flex: 1, minWidth: 0, textAlign: 'left' }}
          >
            <RowLabel label={node.name} color={color} weight={600} />
          </UnstyledButton>
        )}
      </div>
      {isOpen && children.length > 0 && (
        <Stack gap={0}>
          {children.map((child) => (
            <VaultNavRow
              key={child.path}
              node={child}
              activePath={activePath}
              expanded={expanded}
              onToggle={onToggle}
              depth={depth + 1}
              {...(onNavigate !== undefined && { onNavigate })}
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}

export function VaultNav({
  activePath,
  storageKey = 'basalt-ui-obsidian:vault-nav-expanded',
  className,
  onNavigate,
}: VaultNavProps) {
  const { index } = useVault()
  const rootRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const defaultExpanded = useMemo(
    () => (activePath === undefined ? [] : ancestorFolderPaths(activePath)),
    [activePath],
  )
  const [expanded, setExpanded] = useLocalStorage<readonly string[]>({
    key: storageKey,
    defaultValue: defaultExpanded,
    getInitialValueInEffect: false,
    // No cross-tab sync needed for nav-expand state; disabling it also avoids a same-window
    // self-triggered update landing outside the event that caused it.
    sync: false,
  })

  // Collapsed-except-active-path: REPLACES the expanded set with the new active note's ancestors
  // rather than unioning into it. The prior additive behavior let a folder opened while reading one
  // note (e.g. `Areas/Engineering`) stay expanded forever, even after navigating to an unrelated
  // note (`wiki/engineering/index`) whose own ancestors share no path with it. A no-op guard keeps
  // this from writing to localStorage (and re-rendering) when the ancestors haven't actually changed.
  useEffect(() => {
    if (activePath === undefined) return
    const ancestors = ancestorFolderPaths(activePath)
    setExpanded((prev) => (sameMembers(prev, ancestors) ? prev : ancestors))
  }, [activePath, setExpanded])

  const expandedSet = useMemo(() => new Set(expanded), [expanded])
  const toggle = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return [...next]
      })
    },
    [setExpanded],
  )

  // Scroll the active row into view — re-runs once `expanded` actually contains the new active
  // path's ancestors (the effect above sets that asynchronously via `setExpanded`), so the row
  // exists in the DOM by the time this queries for it. `scrollIntoView` is unavailable in some test
  // DOMs, hence the guard.
  useEffect(() => {
    if (activePath === undefined) return
    const activeRow = rootRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    if (activeRow === null || activeRow === undefined) return
    if (typeof activeRow.scrollIntoView !== 'function') return
    activeRow.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [activePath, expanded, reduceMotion])

  return (
    <div ref={rootRef} {...(className !== undefined && { className })}>
      <Stack gap={0} role="tree">
        {(index.tree.children ?? []).map((child) => (
          <VaultNavRow
            key={child.path}
            node={child}
            activePath={activePath}
            expanded={expandedSet}
            onToggle={toggle}
            depth={0}
            {...(onNavigate !== undefined && { onNavigate })}
          />
        ))}
      </Stack>
    </div>
  )
}
