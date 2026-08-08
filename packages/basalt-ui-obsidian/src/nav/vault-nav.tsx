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
 * Indentation is never a computed pixel offset: each nesting level wraps its children in one more
 * `pl="md"` box, so depth is expressed purely through recursion + the Mantine spacing scale.
 * Expanded/collapsed state persists via `useLocalStorage`, the same primitive `BasaltShell` uses
 * for its own collapse state (`shell/index.tsx`).
 */
import { useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Box, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'
import { VX, alpha } from 'basalt-ui/tokens'
import type { VaultNote, VaultTreeNode } from 'obsidian-vault-core'
import { useVault } from '../context.js'

export type VaultNavProps = {
  readonly activePath?: string
  /** localStorage key for the persisted expanded-folder set. */
  readonly storageKey?: string
  readonly className?: string
}

/** Comfortable on a phone, tighter once there's room — never a raw px literal. */
const ROW_PADDING_Y = { base: 'sm', sm: 'xs' } as const

const ACTIVE_ROW_STYLE = {
  backgroundColor: alpha(VX.ink, 0.08),
  borderRadius: 'var(--vx-radius-tight)',
} as const

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

type RowLabelProps = {
  readonly label: string
  readonly active: boolean
  readonly rightSection?: ReactNode
}

function RowLabel({ label, active, rightSection }: RowLabelProps) {
  return (
    <Group
      gap="xs"
      wrap="nowrap"
      py={ROW_PADDING_Y}
      px="xs"
      style={active ? ACTIVE_ROW_STYLE : undefined}
    >
      <Text size="sm" fw={active ? 600 : 400} truncate="end">
        {label}
      </Text>
      {rightSection}
    </Group>
  )
}

type VaultNavRowProps = {
  readonly node: VaultTreeNode
  readonly activePath: string | undefined
  readonly expanded: ReadonlySet<string>
  readonly onToggle: (path: string) => void
}

function VaultNavRow({ node, activePath, expanded, onToggle }: VaultNavRowProps) {
  const { hrefFor, renderLink } = useVault()

  if (node.kind === 'note') {
    if (node.note === undefined) return null
    const note = node.note
    return renderLink(
      hrefFor(note),
      <RowLabel label={note.title} active={note.path === activePath} />,
    )
  }

  const folderNote = folderNoteOf(node)
  const children = (node.children ?? []).filter(
    (child) => folderNote === undefined || child.note?.path !== folderNote.path,
  )
  const isOpen = expanded.has(node.path)
  const active = folderNote !== undefined && folderNote.path === activePath
  const chevron = (
    <Text component="span" size="xs" c="dimmed">
      {isOpen ? '▾' : '▸'}
    </Text>
  )

  return (
    <Box>
      <Group gap="xs" wrap="nowrap" align="center">
        <UnstyledButton
          onClick={() => onToggle(node.path)}
          aria-expanded={isOpen}
          aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
          py={ROW_PADDING_Y}
          px="xs"
        >
          {chevron}
        </UnstyledButton>
        {folderNote !== undefined ? (
          renderLink(hrefFor(folderNote), <RowLabel label={node.name} active={active} />)
        ) : (
          <UnstyledButton onClick={() => onToggle(node.path)} style={{ flex: 1 }}>
            <RowLabel label={node.name} active={active} />
          </UnstyledButton>
        )}
      </Group>
      {isOpen && children.length > 0 && (
        <Box pl="md">
          <Stack gap={0}>
            {children.map((child) => (
              <VaultNavRow
                key={child.path}
                node={child}
                activePath={activePath}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  )
}

export function VaultNav({
  activePath,
  storageKey = 'basalt-ui-obsidian:vault-nav-expanded',
  className,
}: VaultNavProps) {
  const { index } = useVault()
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
  // `defaultValue` only applies on first mount, and VaultNav never remounts across navigations —
  // so arriving at a note via search or a backlink left its folder collapsed and the active row
  // invisible. Re-reveal the active note's ancestors whenever it changes, additively so a folder
  // the user deliberately expanded elsewhere stays open.
  useEffect(() => {
    if (activePath === undefined) return
    const ancestors = ancestorFolderPaths(activePath)
    if (ancestors.length === 0) return
    setExpanded((prev) => {
      const next = new Set(prev)
      const before = next.size
      for (const path of ancestors) next.add(path)
      // Bail out when nothing changed — returning a fresh array unconditionally would write to
      // localStorage and re-render on every navigation.
      return next.size === before ? prev : [...next]
    })
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

  return (
    <Stack gap={0} role="tree" {...(className !== undefined && { className })}>
      {(index.tree.children ?? []).map((child) => (
        <VaultNavRow
          key={child.path}
          node={child}
          activePath={activePath}
          expanded={expandedSet}
          onToggle={toggle}
        />
      ))}
    </Stack>
  )
}
