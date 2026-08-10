/**
 * VaultNav — a real WAI-ARIA tree over `VaultIndex.tree`. `AppSidebar`'s `SidebarItem.children`
 * (basalt-ui/shell) is one level deep, rendered as a hover popover — a vault nests arbitrarily
 * deep, so this component owns its own `role="tree"` widget instead of projecting into
 * `SidebarItem`.
 *
 * DOM shape follows the pattern GitHub Primer's `TreeView` and VS Code both use — a native
 * `<ul role="tree">` / `<li role="treeitem">` / `<ul role="group">` tree, NOT the flat
 * `role="tree"`-on-a-`<div>`-full-of-`<div>`s this file used to render (which carried the role
 * with nothing under it for a screen reader to navigate). Mantine's own `Tree`/`useTree` was
 * deliberately NOT adopted: its roving tabindex owns the `<li>` and its `selectOnClick` model owns
 * selection state, while this component's selection is DERIVED from `activePath`, not held — the
 * two ownership models collide.
 *
 * Roving tabindex: exactly one `<li role="treeitem">` carries `tabIndex={0}` at a time (every
 * other is `-1`) — `tabbablePath` below, preferring the keyboard-focused node, else the node
 * matching `activePath`, else the first visible node. Every arrow/Home/End/type-ahead handler moves
 * focus imperatively via `focusNode` (which just calls `.focus()` on the target `<li>` through
 * `itemRefs`) and lets the row's own `onFocus` record where focus landed — no separate "what's
 * current" bookkeeping. That landing is recorded in BOTH a `focusedPath` state (for rendering
 * `tabIndex`) and a `focusedPathRef` (for the handlers to read synchronously); see `handleRowFocus`
 * for why one of the two is not enough.
 *
 * All keyboard handling reads off ONE memoised flat list, `visibleNodes` (built by
 * `pushVisibleNodes`, depth-first, skipping the children of a collapsed folder) — this is what
 * "don't re-implement traversal per key handler" cashes out to: ArrowDown/Up/Home/End index into
 * it directly, ArrowRight/Left lean on its `parentPath`/`hasChildren`/`isExpanded` fields, and
 * type-ahead scans it circularly from the current index. The RECURSIVE render tree
 * (`VaultNavRow`) is a separate, deliberately duplicate-free consumer of the same
 * `visibleChildrenOf` helper the flat builder uses — one produces real nested `<li>`/`<ul>` DOM,
 * the other produces the order keyboard nav walks; both agree because both filter children the
 * same way.
 *
 * Folder-note convention (unchanged): a folder containing `{folderName}.md` (e.g. `Areas/Gaming/
 * Wild Rift/Wild Rift.md`) is itself navigable — the folder-note child is hidden from the
 * rendered children (the folder row IS that note now) and the row's label links to it. A folder
 * without one stays a plain, non-link `<span>` label that only toggles expansion.
 *
 * Row chrome: hover moved OFF a per-row `useState` (26 rows re-rendering on `mousemove`) and onto
 * plain CSS `:hover` — see `vault-nav.module.css`'s doc for the `--vault-nav-hover-ink` custom
 * property that lets a label's resolved text color still react to ancestor hover without any JS.
 * `active` (derived from `activePath`, not transient) stays JS-computed and resolves straight to
 * `VX.ink`/`data-active` — CSS then decides whether hover or active wins the background via source
 * order (see the stylesheet).
 *
 * Indentation is now STRUCTURAL — each level is a real nested `<ul role="group">` rather than a
 * flat `depth * 12px` inline offset — because a flat offset cannot draw an indent guide. The
 * guide itself lives entirely in `vault-nav.module.css`, on the `classes.tree`/`classes.group`
 * CSS-module classes. Not on bare `[role='tree']`/`[role='group']` attribute selectors: a CSS
 * module rewrites class names only, so an attribute selector would ship from this package as a
 * GLOBAL rule and restyle every tree on a consumer's page.
 * The chevron's own CSS box (`classes.chevron`) is reused, empty and un-clickable, as the
 * notes' alignment spacer too — same box, same width at both pointer densities, no second class.
 *
 * The icon slot (`RowIcon`) sits between the chevron spacer and the label, inside the same row
 * flex both already live in — no new wrapper, no per-row state. It reads `node.icon` (set by
 * `obsidian-vault-core`'s `buildTree` from Iconize's `data.json`) and the `renderIcon` seam
 * (`context.tsx`) and renders nothing unless BOTH are present, matching Obsidian itself: a node
 * with no configured icon reserves no icon space. `aria-hidden` because the row's accessible name
 * is entirely the label (`aria-labelledby` -> `RowLabel`'s `id`), same reasoning as the chevron.
 * Sized at 14px — the same pixel value `RowLabel`'s `size="sm"` `Text` resolves to — so the icon
 * reads as optically matched to the label rather than towering over or shrinking under it; the
 * actual SVG sizing is the consumer's `renderIcon` call, this file only bounds the wrapping box.
 *
 * The `renderLink` seam: `VaultLinkRenderer` (`context.tsx`, untouched here) is only
 * `(href, children) => ReactNode`, so it hands back a consumer-owned element (a plain `<a>`, or a
 * router `<Link>`) whose props this file cannot set. Both things the ideal DOM would put on that
 * anchor are therefore placed elsewhere. `aria-labelledby` targets the `id` on the `Text` rendered
 * AS the anchor's children — any element carrying that id satisfies the ARIA reference, it need
 * not be an ancestor — which is fully sufficient for the accessible name. `tabIndex={-1}` is
 * applied imperatively after commit (see the effect near the bottom of `VaultNav`), because an
 * anchor left in the tab order would give the tree ~26 tab stops and defeat the roving tabindex
 * outright.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { Text } from '@mantine/core'
import { useLocalStorage, useReducedMotion } from '@mantine/hooks'
import { VX } from 'basalt-ui/tokens'
import { foldDiacritics } from 'obsidian-vault-core/search'
import type { VaultNote, VaultTreeNode } from 'obsidian-vault-core'
import type { VaultIconRenderer } from '../context.js'
import { useVault } from '../context.js'
import classes from './vault-nav.module.css'

/** Pixel size of the icon slot — matches `RowLabel`'s `size="sm"` `Text`, see the module doc. */
const ROW_ICON_SIZE_PX = 14

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

/** Type-ahead accumulates typed characters within this window before the buffer resets. */
const TYPE_AHEAD_TIMEOUT_MS = 500

/** The note that makes `node`'s own row navigable — a child note whose basename === the folder's name. */
function folderNoteOf(node: VaultTreeNode): VaultNote | undefined {
  return node.children?.find((child) => child.kind === 'note' && child.note?.basename === node.name)
    ?.note
}

type VisibleChildren = {
  readonly folderNote: VaultNote | undefined
  readonly children: readonly VaultTreeNode[]
}

/** The folder-note (if any) plus the child list with that folder-note filtered out — the ONE place
 * this rule is expressed, read by both the flat-list builder and the recursive renderer so they
 * can never disagree on what's visible under a folder. */
function visibleChildrenOf(node: VaultTreeNode): VisibleChildren {
  const folderNote = folderNoteOf(node)
  const children = (node.children ?? []).filter(
    (child) => folderNote === undefined || child.note?.path !== folderNote.path,
  )
  return { folderNote, children }
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

/** `id` attributes can't contain a `/` or a space (both legal in a vault path) without at least
 * being unambiguous about it — collapse anything that isn't already id-safe to `-`. */
function sanitizeForId(path: string): string {
  return path.replace(/[^a-zA-Z0-9_-]/g, '-')
}

/** One row's flattened shape — depth-first VISIBLE order, i.e. skipping the subtree of any
 * collapsed folder. This is the single list every keyboard handler and the roving-tabindex
 * fallback read from; nothing here re-derives it. */
type FlatNode = {
  readonly path: string
  readonly depth: number
  readonly parentPath: string | undefined
  readonly name: string
  readonly node: VaultTreeNode
  readonly hasChildren: boolean
  readonly isExpanded: boolean
  /** The note this row navigates to on click/Enter — a note's own path, or a folder's folder-note
   * path. `undefined` for a toggle-only folder with no folder note. */
  readonly selectablePath: string | undefined
}

function pushVisibleNodes(
  nodes: readonly VaultTreeNode[],
  expanded: ReadonlySet<string>,
  depth: number,
  parentPath: string | undefined,
  out: FlatNode[],
): void {
  for (const node of nodes) {
    if (node.kind === 'note') {
      if (node.note === undefined) continue
      out.push({
        path: node.path,
        depth,
        parentPath,
        name: node.note.title,
        node,
        hasChildren: false,
        isExpanded: false,
        selectablePath: node.note.path,
      })
      continue
    }
    const { folderNote, children } = visibleChildrenOf(node)
    const isExpanded = expanded.has(node.path)
    out.push({
      path: node.path,
      depth,
      parentPath,
      name: node.name,
      node,
      hasChildren: children.length > 0,
      isExpanded,
      selectablePath: folderNote?.path,
    })
    if (isExpanded) pushVisibleNodes(children, expanded, depth + 1, node.path, out)
  }
}

type RowLabelProps = {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly weight: number
}

/**
 * The text this file owns inside a row — also the element `aria-labelledby` points at (`id`),
 * since the seam that renders the actual `<a>` (`renderLink`) is consumer-owned and can't take an
 * `id` prop directly (see the module doc's "known seam limitation"). `textDecoration: 'none'` set
 * HERE (not on an ancestor) is deliberate: a descendant that specifies its own
 * `text-decoration-line` stops the anchor's underline from painting through it, regardless of the
 * anchor's own computed value — the same belt to `vault-nav.module.css`'s suspenders. `flex: 1`
 * lets this component also serve as the flex item directly (the toggle-only folder-label case,
 * which has no wrapping wrapper of its own).
 */
function RowLabel({ id, label, color, weight }: RowLabelProps) {
  return (
    <Text
      id={id}
      size="sm"
      fw={weight}
      truncate="end"
      style={{ color, textDecoration: 'none', minWidth: 0, flex: 1 }}
    >
      {label}
    </Text>
  )
}

type RowIconProps = {
  readonly icon: string | undefined
  readonly renderIcon: VaultIconRenderer | undefined
}

/** Renders `node.icon` via the consumer's `renderIcon` seam, or nothing at all when either half is
 * missing — see the module doc's icon-slot paragraph. `aria-hidden` because the row's accessible
 * name lives entirely on `RowLabel`. */
function RowIcon({ icon, renderIcon }: RowIconProps) {
  if (icon === undefined || renderIcon === undefined) return null
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: ROW_ICON_SIZE_PX,
        height: ROW_ICON_SIZE_PX,
      }}
    >
      {renderIcon(icon)}
    </span>
  )
}

type VaultNavRowProps = {
  readonly node: VaultTreeNode
  readonly depth: number
  readonly activePath: string | undefined
  readonly expanded: ReadonlySet<string>
  readonly tabbablePath: string | undefined
  readonly onToggle: (path: string) => void
  readonly onNavigate: (() => void) | undefined
  readonly onRowFocus: (path: string) => void
  readonly registerRef: (path: string, el: HTMLLIElement | null) => void
}

function VaultNavRow({
  node,
  depth,
  activePath,
  expanded,
  tabbablePath,
  onToggle,
  onNavigate,
  onRowFocus,
  registerRef,
}: VaultNavRowProps) {
  const { hrefFor, renderLink, renderIcon } = useVault()
  const reactId = useId()
  const labelId = `vault-nav-label-${reactId}-${sanitizeForId(node.path)}`
  const tabIndex = tabbablePath === node.path ? 0 : -1

  // `onFocus` is React's binding for the native `focusin`, which BUBBLES — and in a real tree the
  // `<li>`s are nested, so focusing a leaf also fires this on every ancestor row, outermost LAST.
  // Without the target check the outermost ancestor therefore always wins and "where is focus" ends
  // up recorded as the top-level folder: measured live, ArrowDown from `Shyvana` (4 levels deep)
  // moved to `Engineering`, the node after `Areas`, because focus had been recorded as `Areas`
  // every single time. Only the row the event actually landed on may report itself.
  const handleFocus = (event: FocusEvent<HTMLLIElement>) => {
    if (event.target === event.currentTarget) onRowFocus(node.path)
  }

  if (node.kind === 'note') {
    if (node.note === undefined) return null
    const note = node.note
    const active = note.path === activePath
    // Resting color reads `--vault-nav-hover-ink` (set by `.row:hover`) with the resting shade as
    // its `var()` fallback — see the module doc. Active bypasses the hover var entirely; it's
    // never a transient state, so it can just resolve straight to ink.
    const color = active ? VX.ink : `var(--vault-nav-hover-ink, ${VX.ink2})`
    return (
      <li
        ref={(el) => registerRef(node.path, el)}
        className={classes.item}
        role="treeitem"
        aria-level={depth}
        aria-selected={active}
        aria-labelledby={labelId}
        tabIndex={tabIndex}
        onFocus={handleFocus}
      >
        <div className={classes.row} data-active={active || undefined} onClick={onNavigate}>
          {/* Empty, un-clickable — reserves the exact same box the chevron occupies so note and
              folder labels stay aligned at every depth and pointer density. */}
          <span className={classes.chevron} aria-hidden="true" />
          <RowIcon icon={node.icon} renderIcon={renderIcon} />
          <div className={classes.anchorReset} style={{ flex: 1, minWidth: 0 }}>
            {renderLink(
              hrefFor(note),
              <RowLabel
                id={labelId}
                label={note.title}
                color={color}
                weight={active ? 600 : 400}
              />,
            )}
          </div>
        </div>
      </li>
    )
  }

  const { folderNote, children } = visibleChildrenOf(node)
  const isOpen = expanded.has(node.path)
  const active = folderNote !== undefined && folderNote.path === activePath
  const color = active ? VX.ink : `var(--vault-nav-hover-ink, ${VX.muted})`
  // `aria-expanded` only belongs on an item that can actually expand — present for every folder,
  // ABSENT entirely (not `false`) for one with no children, same as it's already absent for notes.
  const ariaExpanded = children.length > 0 ? isOpen : undefined

  return (
    <li
      ref={(el) => registerRef(node.path, el)}
      className={classes.item}
      role="treeitem"
      aria-level={depth}
      aria-expanded={ariaExpanded}
      aria-selected={active}
      aria-labelledby={labelId}
      tabIndex={tabIndex}
      onFocus={handleFocus}
    >
      <div
        className={classes.row}
        data-active={active || undefined}
        // A folder with no folder-note has no link of its own — the whole row toggles, not just
        // the chevron. A folder WITH one only toggles from the chevron (below); the row's click
        // goes to the link instead, via the wrapping anchorReset div's own onClick.
        onClick={folderNote === undefined ? () => onToggle(node.path) : undefined}
      >
        <span
          className={classes.chevron}
          aria-hidden="true"
          onClick={(event) => {
            // Stops this from ALSO bubbling into the row's own onClick above (which would double
            // -toggle a folder-note-less folder back to its starting state) or into the anchor's
            // onNavigate below (which would fire onNavigate for a mere expand/collapse).
            event.stopPropagation()
            onToggle(node.path)
          }}
          style={{
            color: VX.muted,
            fontSize: VX.text.md,
            display: 'inline-block',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 120ms ease',
          }}
        >
          ▸
        </span>
        <RowIcon icon={node.icon} renderIcon={renderIcon} />
        {folderNote !== undefined ? (
          <div
            className={classes.anchorReset}
            style={{ flex: 1, minWidth: 0 }}
            onClick={onNavigate}
          >
            {renderLink(
              hrefFor(folderNote),
              <RowLabel id={labelId} label={node.name} color={color} weight={600} />,
            )}
          </div>
        ) : (
          <RowLabel id={labelId} label={node.name} color={color} weight={600} />
        )}
      </div>
      {isOpen && children.length > 0 && (
        <ul className={classes.group} role="group">
          {children.map((child) => (
            <VaultNavRow
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              expanded={expanded}
              tabbablePath={tabbablePath}
              onToggle={onToggle}
              onNavigate={onNavigate}
              onRowFocus={onRowFocus}
              registerRef={registerRef}
            />
          ))}
        </ul>
      )}
    </li>
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
  const itemRefs = useRef(new Map<string, HTMLLIElement>())
  const typeAheadBufferRef = useRef('')
  const typeAheadTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [focusedPath, setFocusedPath] = useState<string | undefined>(undefined)

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

  const visibleNodes = useMemo(() => {
    const out: FlatNode[] = []
    pushVisibleNodes(index.tree.children ?? [], expandedSet, 1, undefined, out)
    return out
  }, [index.tree, expandedSet])

  // Roving-tabindex target, in order of preference: the node the user last moved keyboard focus
  // to (if it's still visible), else the node matching `activePath`, else the first visible node.
  const tabbablePath = useMemo(() => {
    if (focusedPath !== undefined && visibleNodes.some((n) => n.path === focusedPath)) {
      return focusedPath
    }
    const activeNode =
      activePath === undefined
        ? undefined
        : visibleNodes.find((n) => n.selectablePath === activePath)
    return activeNode?.path ?? visibleNodes[0]?.path
  }, [focusedPath, activePath, visibleNodes])

  const registerRef = useCallback((path: string, el: HTMLLIElement | null) => {
    if (el === null) itemRefs.current.delete(path)
    else itemRefs.current.set(path, el)
  }, [])

  // Imperative — every keyboard move calls this, which calls `.focus()` on the target `<li>`; the
  // row's own `onFocus` (see `VaultNavRow`) round-trips that back through `handleRowFocus`.
  const focusNode = useCallback((path: string) => {
    itemRefs.current.get(path)?.focus()
  }, [])

  // Focus is recorded TWICE, and the duplication is the point. `focusedPath` state drives which
  // `<li>` renders `tabIndex={0}`, so it has to be state. But a keydown handler reading that state
  // reads it through the closure it was created with, and React has not re-rendered yet — so two
  // arrow presses inside one batch (key repeat, a synthetic test, a fast typist) would both
  // navigate from the SAME stale origin. Measured live before this ref existed: Home then two
  // ArrowDowns landed on `Areas`, `Thresh`, `Thresh` instead of `Areas`, `Engineering`, `Gaming`.
  // The ref is written synchronously inside the focus event, so the handler always resolves the
  // node the user is actually standing on.
  const focusedPathRef = useRef<string | undefined>(undefined)
  const handleRowFocus = useCallback((path: string) => {
    focusedPathRef.current = path
    setFocusedPath(path)
  }, [])

  // Enter: click the anchor if the row has one (reusing the exact same path a mouse click takes,
  // onNavigate included), else toggle the folder.
  const activateCurrent = useCallback(
    (flat: FlatNode) => {
      const li = itemRefs.current.get(flat.path)
      const anchor = li?.querySelector('a')
      if (anchor !== null && anchor !== undefined) {
        anchor.click()
        return
      }
      if (flat.node.kind === 'folder') toggle(flat.path)
    },
    [toggle],
  )

  useEffect(
    () => () => {
      if (typeAheadTimerRef.current !== undefined) clearTimeout(typeAheadTimerRef.current)
    },
    [],
  )

  const handleTypeAhead = useCallback(
    (char: string) => {
      if (typeAheadTimerRef.current !== undefined) clearTimeout(typeAheadTimerRef.current)
      typeAheadBufferRef.current += char
      const buffer = foldDiacritics(typeAheadBufferRef.current.toLowerCase())
      typeAheadTimerRef.current = setTimeout(() => {
        typeAheadBufferRef.current = ''
      }, TYPE_AHEAD_TIMEOUT_MS)

      const count = visibleNodes.length
      if (count === 0 || buffer === '') return
      const currentPath = focusedPathRef.current ?? tabbablePath
      const currentIndex =
        currentPath === undefined ? -1 : visibleNodes.findIndex((n) => n.path === currentPath)

      // Scan circularly starting just after the current node, so repeated presses of the same
      // letter cycle through every match instead of always landing on the first one.
      for (let offset = 1; offset <= count; offset++) {
        const candidate = visibleNodes[(currentIndex + offset + count) % count]
        if (candidate === undefined) continue
        if (foldDiacritics(candidate.name.toLowerCase()).startsWith(buffer)) {
          focusNode(candidate.path)
          return
        }
      }
    },
    [visibleNodes, tabbablePath, focusNode],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      const currentPath = focusedPathRef.current ?? tabbablePath
      if (currentPath === undefined) return
      const currentIndex = visibleNodes.findIndex((n) => n.path === currentPath)
      const current = visibleNodes[currentIndex]
      if (current === undefined) return

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          const next = visibleNodes[currentIndex + 1]
          if (next !== undefined) focusNode(next.path)
          return
        }
        case 'ArrowUp': {
          event.preventDefault()
          const prev = visibleNodes[currentIndex - 1]
          if (prev !== undefined) focusNode(prev.path)
          return
        }
        case 'ArrowRight': {
          event.preventDefault()
          if (current.node.kind !== 'folder') return
          if (!current.isExpanded) {
            if (current.hasChildren) toggle(current.path)
            return
          }
          const child = visibleNodes[currentIndex + 1]
          if (child !== undefined && child.parentPath === current.path) focusNode(child.path)
          return
        }
        case 'ArrowLeft': {
          event.preventDefault()
          if (current.node.kind === 'folder' && current.isExpanded) {
            toggle(current.path)
            return
          }
          if (current.parentPath !== undefined) focusNode(current.parentPath)
          return
        }
        case 'Home': {
          event.preventDefault()
          const first = visibleNodes[0]
          if (first !== undefined) focusNode(first.path)
          return
        }
        case 'End': {
          event.preventDefault()
          const last = visibleNodes[visibleNodes.length - 1]
          if (last !== undefined) focusNode(last.path)
          return
        }
        case 'Enter': {
          event.preventDefault()
          activateCurrent(current)
          return
        }
        case ' ': {
          event.preventDefault()
          if (current.node.kind === 'folder') toggle(current.path)
          return
        }
        default: {
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            handleTypeAhead(event.key)
          }
        }
      }
    },
    [tabbablePath, visibleNodes, focusNode, toggle, activateCurrent, handleTypeAhead],
  )

  // The roving tabindex above only actually rovers if the `<li>`s are the tree's ONLY tab stops —
  // but `renderLink` hands back a consumer-rendered anchor, and its seam
  // (`VaultLinkRenderer: (href, children) => ReactNode`) has nowhere to pass `tabIndex`, so every
  // one of those anchors arrives natively focusable. Left alone that is ~26 tab stops through a
  // sidebar the WAI-ARIA tree pattern says should be exactly one, which is worse than the plain
  // link list this replaced. So they're taken out of the tab order here, imperatively, since the
  // seam gives no declarative way to do it. Nothing else changes: the anchors keep their `href`,
  // stay fully clickable, and `Enter` still routes through `anchor.click()` (`activateCurrent`), so
  // cmd-click, middle-click and open-in-new-tab all behave exactly as before.
  //
  // No dependency array on purpose: which anchors exist is the CONSUMER's render output, not
  // something this component can enumerate a dependency for. Re-applying after every commit is
  // both cheap (a few dozen attribute writes, no state, so no re-render loop) and the only version
  // that cannot silently miss a link.
  useEffect(() => {
    const anchors = rootRef.current?.querySelectorAll('a')
    if (anchors === undefined) return
    for (const anchor of anchors) anchor.tabIndex = -1
  })

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
      <ul className={classes.tree} role="tree" aria-label="Vault notes" onKeyDown={handleKeyDown}>
        {(index.tree.children ?? []).map((child) => (
          <VaultNavRow
            key={child.path}
            node={child}
            depth={1}
            activePath={activePath}
            expanded={expandedSet}
            tabbablePath={tabbablePath}
            onToggle={toggle}
            onNavigate={onNavigate}
            onRowFocus={handleRowFocus}
            registerRef={registerRef}
          />
        ))}
      </ul>
    </div>
  )
}
