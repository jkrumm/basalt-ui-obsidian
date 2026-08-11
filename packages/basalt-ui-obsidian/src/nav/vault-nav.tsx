/**
 * VaultNav — a real WAI-ARIA tree over `VaultIndex.tree`, built on `@mantine/core`'s `Tree`/
 * `useTree`. `AppSidebar`'s `SidebarItem.children` (basalt-ui/shell) is one level deep, rendered as
 * a hover popover — a vault nests arbitrarily deep, so this component owns its own `role="tree"`
 * widget instead of projecting into `SidebarItem`.
 *
 * A prior version of this file hand-rolled the whole tree (traversal, roving tabindex, arrow-key
 * handling, type-ahead) because Mantine's `Tree` only grew CONTROLLED `expandedState`/`selectedState`
 * in v9 — before that, `useTree`'s state was fully internal and had nowhere for this component's own
 * `activePath`-derived selection to plug in. That's no longer true (verified against the installed
 * `@mantine/core@9.3.2`): `useTree({ expandedState, onExpandedStateChange, selectedState })` runs on
 * `useUncontrolled`, so both are fully controllable from outside. Selection here is still DERIVED,
 * never held — `selectedState` is computed from `activePath` every render and `select`/
 * `toggleSelected` are never called (`selectOnClick={false}`, `allowRangeSelection={false}`, and this
 * file's own click handlers never touch the controller's selection API either).
 *
 * `data` maps `VaultIndex.tree` to Mantine's `TreeNodeData[]` (`{ value, label, children }`),
 * `value` always a vault-relative path. `buildTreeNodeData` does this once (`useMemo`, keyed on
 * `index.tree`) and populates four parallel lookup maps keyed by that same path — `nodesByPath` (the
 * original `VaultTreeNode`, since `TreeNodeData` can't carry it), `namesByPath` (display name, for
 * type-ahead), `hasChildrenByPath` (a folder's visible-children count, for the Enter/Space
 * toggle-if-folder guard below) and `selectableValueByPath` (a note's OWN path -> its row's `value` —
 * identity for a plain note, but the FOLDER's path for a folder-note, since that row's `value` is the
 * folder, not the note; see the folder-note paragraph below). A FIFTH map, `labelIdByPath`, is built
 * in the SAME `useMemo` right after (see the `aria-labelledby` paragraph below) rather than inside
 * `buildTreeNodeData` itself, since it needs `reactId` (a hook value `buildTreeNodeData` — a plain
 * function — has no access to). One pass, one source of truth, same "don't re-derive it twice"
 * discipline the old flat-list builder followed.
 *
 * Mantine owns almost all keyboard handling now: ArrowUp/Down move focus across every visible
 * `[role="treeitem"]` in document order, ArrowRight/Left expand/collapse and step into/out of a
 * subtree — all via `TreeNode`'s own `onKeyDown`, which calls `stopPropagation` for those four keys
 * plus Space, so they never reach this component. `Home`/`End`/`Enter`/type-ahead have no Mantine
 * equivalent and are NOT intercepted, so they bubble to the tree root — `useTreeKeyboardExtras`
 * (`use-tree-keyboard-extras.ts`) owns that handler, reading `document.activeElement`/`data-value`
 * instead of a hand-maintained flat list, since the currently-focused `<li>` already carries
 * `data-value` (see `TreeNode`'s own render). `expandOnSpace={false}` on `<Tree>` is what lets Space
 * through: Mantine's default toggles ANY node (leaf or folder) on Space, but this file only ever
 * toggles a folder — same guard that hook's Enter case uses.
 *
 * `expandedState` persists via the same `useLocalStorage` under `storageKey` as before, and the
 * ancestors-of-`activePath` auto-expand effect is untouched — only the STORAGE SHAPE feeding it
 * changed. Mantine's `TreeExpandedState` is `Record<string, boolean>` keyed by `value`, not the old
 * `Set<string>`, so `expanded` (the persisted `readonly string[]`) is converted both ways:
 * `expandedRecord` (array -> record) is what's handed to `useTree`, and `handleExpandedStateChange`
 * (record -> array) is what writes back. That handler also FILTERS to folder paths only — Mantine's
 * own ArrowRight/Space, run on a leaf note, unconditionally call `expand()`/`toggleExpanded()` on it
 * (no `hasChildren` guard internally), which would otherwise leak note paths into the persisted
 * expanded set as harmless-but-growing cruft.
 *
 * Folder-note convention (unchanged): a folder containing `{folderName}.md` (e.g. `Areas/Gaming/
 * Wild Rift/Wild Rift.md`) is itself navigable — the folder-note child is hidden from `children`
 * (the folder row IS that note now) and the row's label links to it. A folder without one stays a
 * plain, non-link label that only toggles. `visibleChildrenOf`/`folderNoteOf` are the one place this
 * rule is expressed, read by both `buildTreeNodeData` and `VaultNavRow` so they can't disagree.
 *
 * THREE a11y gaps in Mantine 9.3.2's non-virtualized `<li role="treeitem">` are patched by ONE hook,
 * `useTreeItemA11ySync` (`use-tree-item-a11y-sync.ts`) — see that file's own doc for the full
 * per-patch rationale AND for why its effect carries a real dependency array rather than running
 * unconditionally. The brief for this rewrite flagged the first two below; the third turned up
 * empirically once real nesting was actually rendered and is arguably the more serious of the three:
 *
 * 1. No `aria-expanded` on the `<li>` at all (only the virtualized `FlatTreeNode` path sets it).
 * 2. The built-in roving tabindex is STATIC: `tabIndex: rootIndex === 0 ? 0 : -1` on every render,
 *    which never follows focus — tab out and back always lands on row 1. Tracking WHICH node last had
 *    keyboard focus is this file's own job (`focusedPath`, updated by one delegated `onFocus` on the
 *    tree root — `focusin` bubbles, and `event.target` is reliably the specific `<li>` that received
 *    it, no ancestor-vs-target ambiguity since there's exactly one listener, not one per row); making
 *    that preference stick, including validating it against the live `<li>`s, is
 *    `useTreeItemA11ySync`'s.
 * 3. Mantine's `<li>` carries NEITHER `aria-label` NOR `aria-labelledby`, so its accessible name falls
 *    back to "name from content" — which, in a REAL nested tree, recurses into every descendant
 *    `<li>` too. A folder's computed name ends up being its own label PLUS every visible descendant's
 *    label concatenated (measured live: the `Wild Rift` folder's row named itself "Wild Rift Runes").
 *    This is not a corner case a consumer could trigger, it breaks EVERY folder with visible children,
 *    immediately — worse than the two gaps the brief called out. The fix is the same shape as the old
 *    file's own `aria-labelledby`, just applied imperatively here instead of declaratively, for the
 *    same "don't own the `<li>`" reason patches 1 and 2 are imperative — pointing at `labelIdByPath`
 *    (below), NOT a `sanitizeForId(path)` substitution: two distinct legal vault paths
 *    (`Projects/Notes.md` and `Projects-Notes.md`) sanitize to the same string, which would collide
 *    two rows' ids and misdirect `aria-labelledby` for one of them. `labelIdByPath` instead assigns
 *    ids by MAP-ITERATION ORDER (`vault-nav-label-${reactId}-${index}`) over the exact same
 *    `nodesByPath` `buildTreeNodeData` already builds — one pass, collision-free by construction
 *    rather than by hoping path characters don't collide, and `reactId` (`useId()`) still keeps two
 *    simultaneously-mounted `VaultNav`s (the desktop sidebar and the mobile drawer) from colliding
 *    with EACH OTHER.
 *
 * `aria-level` is the one attribute deliberately NOT patched in, unlike the old hand-rolled tree. The
 * DOM here is REAL nesting — `<li role="treeitem"><ul role="group"><li role="treeitem">...` — and per
 * the ARIA tree pattern, level is computed implicitly from that structure when no explicit
 * `aria-level` is present; Mantine simply relies on the implicit computation rather than stamping the
 * attribute. That is spec-valid, not a regression, so nothing here re-adds it.
 *
 * Row chrome: hover is still plain CSS `:hover` reacting through `--vault-nav-hover-ink` (see
 * `vault-nav.module.css`), `active` is still derived from `activePath`/Mantine's own `selectedState`
 * (never transient), never JS-toggled per row.
 *
 * Indentation stays STRUCTURAL (each level a real nested `[role="group"]` `<ul>`, `vault-nav.module
 * .css`'s `.group`) rather than Mantine's own `--label-offset`/`withLines` line-guide system —
 * `withLines` positions its connector lines purely from `--label-offset` (a cumulative offset FROM
 * THE ROOT), which assumes indentation is applied that same way. This file's indentation instead
 * compounds through nested `<ul>` margins, one real DOM level at a time, so a Mantine-drawn line
 * would be computed against a coordinate system this file's rows don't actually sit in and would
 * misalign. Re-architecting indentation onto `--label-offset` to make the two agree was possible but
 * riskier to get right without a live render to check against (no dev server was run for this change)
 * than keeping the existing, already-considered indent guide — which also does something Mantine's
 * default doesn't: fades in only on hover/focus-within instead of always-on, matching the "quiet
 * affordance" the underline treatment elsewhere in this file goes for. `withLines` stays off;
 * `levelOffset={14}` is still set (chrome pass ask) since Mantine sets `--label-offset` on the `<li>`
 * regardless of whether this file's CSS reads it, so a sane value costs nothing to carry.
 *
 * The icon slot (`RowIcon`) now ALWAYS renders something: the consumer's Iconize-mapped icon
 * (`node.icon` + `renderIcon`) when both are present, else a small built-in inline-SVG fallback
 * (folder-open/folder-closed/note) so a row is never a blank gutter next to text — the "ragged text
 * list" the chrome pass targets. Iconize still takes precedence when configured; nothing here changes
 * that half. The chevron (`RowChevron`) similarly draws its own inline SVG by default, replacing the
 * literal `▸` glyph the old file used (a Unicode character renders differently per platform, which
 * was the biggest "not native" tell) — `renderChevron` (`context.tsx`) lets a consumer swap in a real
 * icon-library glyph instead; both stay icon-library-free without one wired.
 *
 * The `renderLink` seam: `VaultLinkRenderer` (`context.tsx`, untouched here) is only
 * `(href, children) => ReactNode`, so it hands back a consumer-owned element (a plain `<a>`, or a
 * router `<Link>`) this file cannot set further props on — see the `aria-labelledby` paragraph above
 * for the one place that now costs something. `tabIndex={-1}` is still applied imperatively to every
 * anchor (also `useTreeItemA11ySync`), because an anchor left in the tab order would give the tree
 * ~26 tab stops and defeat the roving tabindex outright — same reasoning as before, folded into that
 * hook alongside the other two patches since all three walk the same DOM.
 *
 * `VaultNav`'s own body is composition over these pieces: `buildTreeNodeData` derives the tree data
 * and lookup maps, `useLocalStorage` + the ancestor-expand effect bridge `expanded`/`expandedRecord`,
 * `useTreeKeyboardExtras` owns the keys Mantine doesn't handle, and `useTreeItemA11ySync` owns the
 * imperative DOM patch. Kept as four separate pieces rather than one large function for the same
 * reason `RowIcon`/`RowChevron`/`buildTreeNodeData` are already split out above.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import { Text, Tree, useTree } from '@mantine/core'
import type { RenderTreeNodePayload, TreeNodeData } from '@mantine/core'
import { useLocalStorage, useReducedMotion } from '@mantine/hooks'
import { alpha, VX } from 'basalt-ui/tokens'
import type { VaultNote, VaultTreeNode } from 'obsidian-vault-core'
import type { VaultChevronRenderer, VaultIconRenderer } from '../context.js'
import { useVault } from '../context.js'
import { useTreeItemA11ySync } from './use-tree-item-a11y-sync.js'
import { useTreeKeyboardExtras } from './use-tree-keyboard-extras.js'
import classes from './vault-nav.module.css'

/** Pixel size of the icon slot. Matches Mantine's own `Tree` demo weight (`size={14}`); the wrapping
 * span also carries `opacity: 0.75` (same demo) so an icon sits under the label, not over it. */
const ROW_ICON_SIZE_PX = 14

/** Mirrors Mantine's own `TreeExpandedState` (`Record<node.value, boolean>`) — not imported because
 * `@mantine/core`'s `Tree` barrel re-exports `useTree`'s INPUT/RETURN types but not this one. */
type TreeExpandedRecord = Record<string, boolean>

export type VaultNavProps = {
  readonly activePath?: string
  /** localStorage key for the persisted expanded-folder set. */
  readonly storageKey?: string
  readonly className?: string
  /** Fires whenever a note row is selected (a plain note, or a folder-note link) — the demo shell's
   * mobile drawer wires this to close itself on navigation; the desktop aside instance leaves it
   * unset. Never fires for a chevron toggle (expanding a folder isn't navigating). */
  readonly onNavigate?: () => void
  /** Renders each folder row's recursive note count, right-aligned and dimmed — see `VaultNavRow`'s
   * count span. Default `false` so every existing caller renders exactly as before. `panels/
   * tree-panel.tsx`'s `VaultTreePanel` passes `true`. */
  readonly showCounts?: boolean
}

/** The note that makes `node`'s own row navigable — a child note whose basename === the folder's name.
 * Exported for `panels/bookmarks-panel.tsx`, which applies the same folder-note rule to decide
 * whether a `folder`-type bookmark links anywhere — one implementation, so the two can't disagree. */
export function folderNoteOf(node: VaultTreeNode): VaultNote | undefined {
  return node.children?.find((child) => child.kind === 'note' && child.note?.basename === node.name)
    ?.note
}

/** Recursive note count under `node`, folder-notes included (counted once, as a note — not doubled
 * for also making their folder navigable). Exported for `panels/tree-panel.tsx`'s summary strip,
 * which needs the same count `VaultNav`'s own `showCounts` row optionally shows — one
 * implementation, not two that could quietly disagree on what counts as "in" a folder. */
export function countNotes(node: VaultTreeNode): number {
  if (node.kind === 'note') return node.note === undefined ? 0 : 1
  return (node.children ?? []).reduce((sum, child) => sum + countNotes(child), 0)
}

type VisibleChildren = {
  readonly folderNote: VaultNote | undefined
  readonly children: readonly VaultTreeNode[]
}

/** The folder-note (if any) plus the child list with that folder-note filtered out — the ONE place
 * this rule is expressed, read by both `buildTreeNodeData` and `VaultNavRow` so they can never
 * disagree on what's visible under a folder. */
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

/** The lookup maps built alongside Mantine's `TreeNodeData[]` — see the module doc's `data` paragraph.
 * `labelIdByPath` is populated separately, in `VaultNav` itself, since it needs `useId()` — see the
 * module doc's `aria-labelledby` paragraph for why it's index-based rather than derived from the path. */
type TreeBuildResult = {
  readonly data: TreeNodeData[]
  readonly nodesByPath: ReadonlyMap<string, VaultTreeNode>
  readonly namesByPath: ReadonlyMap<string, string>
  readonly hasChildrenByPath: ReadonlyMap<string, boolean>
  readonly selectableValueByPath: ReadonlyMap<string, string>
  readonly labelIdByPath: ReadonlyMap<string, string>
  /** Every folder's own `countNotes(node)` result, keyed by path — see `VaultNavRow`'s count span
   * for why this is read from here instead of calling `countNotes` per row per render. */
  readonly folderCountsByPath: ReadonlyMap<string, number>
}

function buildTreeNodeData(
  nodes: readonly VaultTreeNode[],
  nodesByPath: Map<string, VaultTreeNode>,
  namesByPath: Map<string, string>,
  hasChildrenByPath: Map<string, boolean>,
  selectableValueByPath: Map<string, string>,
  folderCountsByPath: Map<string, number>,
): TreeNodeData[] {
  const out: TreeNodeData[] = []
  for (const node of nodes) {
    if (node.kind === 'note') {
      if (node.note === undefined) continue
      nodesByPath.set(node.path, node)
      namesByPath.set(node.path, node.note.title)
      hasChildrenByPath.set(node.path, false)
      selectableValueByPath.set(node.note.path, node.path)
      out.push({ value: node.path, label: node.note.title })
      continue
    }
    const { folderNote, children } = visibleChildrenOf(node)
    nodesByPath.set(node.path, node)
    namesByPath.set(node.path, node.name)
    hasChildrenByPath.set(node.path, children.length > 0)
    folderCountsByPath.set(node.path, countNotes(node))
    if (folderNote !== undefined) selectableValueByPath.set(folderNote.path, node.path)
    const childData = buildTreeNodeData(
      children,
      nodesByPath,
      namesByPath,
      hasChildrenByPath,
      selectableValueByPath,
      folderCountsByPath,
    )
    out.push({
      value: node.path,
      label: node.name,
      ...(childData.length > 0 && { children: childData }),
    })
  }
  return out
}

/** Hand-drawn, icon-library-free chevron — replaces the old literal `▸` glyph. Always points right;
 * `RowChevron` rotates the wrapping box on expand. */
function DefaultChevronIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={10}
      height={10}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5.5 3l5 5-5 5" />
    </svg>
  )
}

type FallbackIconKind = 'folder-open' | 'folder-closed' | 'note'

/** Built-in row icon used whenever Iconize has no `node.icon`, or the consumer supplied no
 * `renderIcon` — see the module doc's icon-slot paragraph. Hand-drawn, icon-library-free. */
function FallbackIcon({ kind }: { readonly kind: FallbackIconKind }) {
  const shared = {
    viewBox: '0 0 16 16',
    width: ROW_ICON_SIZE_PX,
    height: ROW_ICON_SIZE_PX,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': 'true' as const,
  }
  if (kind === 'folder-open') {
    return (
      <svg {...shared}>
        <path d="M1.5 5.5a1 1 0 0 1 1-1h3.4l1.2 1.3H13a1 1 0 0 1 .97 1.24l-.9 3.6a1 1 0 0 1-.97.76H3a1 1 0 0 1-1-1z" />
      </svg>
    )
  }
  if (kind === 'folder-closed') {
    return (
      <svg {...shared}>
        <path d="M1.5 4.5a1 1 0 0 1 1-1h3.4l1.2 1.3H13a1 1 0 0 1 1 1v6.2a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1z" />
      </svg>
    )
  }
  return (
    <svg {...shared}>
      <path d="M4 1.5h5L12.5 5v9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" />
      <path d="M9 1.5V5h3.5" />
    </svg>
  )
}

type RowLabelProps = {
  /** Matches the `aria-labelledby` `useTreeItemA11ySync` stamps onto this row's `<li>` — see the
   * module doc's third patch paragraph for why that's imperative, not declarative. */
  readonly id: string
  readonly label: string
  readonly color: string
  readonly weight: number
  /** Marks the row as navigable in its own right — see the underline note below. */
  readonly underline?: boolean
}

/**
 * The text this file owns inside a row. The `text-decoration-line` is always set HERE, never left to
 * an ancestor: a descendant that specifies its own value stops the anchor's underline from painting
 * through it regardless of the anchor's computed value — the same belt to `vault-nav.module.css`'s
 * suspenders. `flex: 1` lets this component also serve as the flex item directly (the toggle-only
 * folder-label case, which has no wrapping wrapper of its own). `fontSize: 13` overrides the
 * `size="sm"` token (14px) — Obsidian's own sidebar runs closer to 13px; kept as an explicit style
 * rather than hunting for a smaller `size` token so this stays independent of basalt-ui's scale.
 *
 * `underline` is that decision made deliberately rather than inherited. Obsidian's own explorer
 * underlines exactly those folders that have a folder note, because those rows do two different
 * things — the chevron expands, the label navigates — and nothing else in the row distinguishes
 * them from a folder that only expands. The underline is drawn in the label's own resolved color at
 * 25% alpha rather than the browser default, which lands on the text at full strength and reads as
 * a link in a body of prose instead of a quiet affordance in a dense tree.
 */
function RowLabel({ id, label, color, weight, underline = false }: RowLabelProps) {
  return (
    <Text
      id={id}
      size="sm"
      fw={weight}
      truncate="end"
      style={{
        color,
        fontSize: 13,
        textDecoration: underline ? 'underline' : 'none',
        ...(underline && {
          textDecorationColor: alpha(color, 0.25),
          textUnderlineOffset: 2,
        }),
        minWidth: 0,
        flex: 1,
      }}
    >
      {label}
    </Text>
  )
}

type RowIconProps = {
  readonly icon: string | undefined
  readonly renderIcon: VaultIconRenderer | undefined
  readonly fallback: FallbackIconKind
}

/** Renders `node.icon` via the consumer's `renderIcon` seam when both are present, else the built-in
 * `FallbackIcon` — see the module doc's icon-slot paragraph. `aria-hidden` because the row's
 * accessible name is entirely the label (see the module doc's `aria-labelledby` paragraph). */
function RowIcon({ icon, renderIcon, fallback }: RowIconProps) {
  const content =
    icon !== undefined && renderIcon !== undefined ? (
      renderIcon(icon)
    ) : (
      <FallbackIcon kind={fallback} />
    )
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
        opacity: 0.75,
      }}
    >
      {content}
    </span>
  )
}

type RowChevronProps = {
  readonly expanded: boolean
  readonly reduceMotion: boolean
  readonly onToggle: () => void
  readonly renderChevron: VaultChevronRenderer | undefined
}

/** The chevron box also serves as the notes' alignment spacer (rendered empty, un-clickable, via
 * `RowChevronSpacer` below) — same box, same width at every depth and pointer density, no second
 * exported class. `stopPropagation` keeps this click from ALSO bubbling into the row's own onClick
 * (which would double-toggle a folder-note-less folder) or the anchor's onNavigate (folder-note
 * case) — see `VaultNavRow`. `data-testid` is a test-only hook: the chevron is `aria-hidden` and
 * carries no text a11y query can target now that it's an SVG rather than the old `▸` glyph. */
function RowChevron({ expanded, reduceMotion, onToggle, renderChevron }: RowChevronProps) {
  return (
    <span
      className={classes.chevron}
      aria-hidden="true"
      data-testid="vault-nav-chevron"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: VX.muted,
        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: reduceMotion ? 'none' : 'transform 120ms ease',
      }}
    >
      {renderChevron !== undefined ? renderChevron() : <DefaultChevronIcon />}
    </span>
  )
}

/** Empty, un-clickable — reserves the exact same box `RowChevron` occupies so note and folder labels
 * stay aligned at every depth and pointer density. */
function RowChevronSpacer() {
  return <span className={classes.chevron} aria-hidden="true" />
}

type VaultNavRowProps = {
  readonly vaultNode: VaultTreeNode
  /** Matches the `aria-labelledby` `useTreeItemA11ySync` stamps onto this row's `<li>`. */
  readonly labelId: string
  readonly active: boolean
  readonly expanded: boolean
  readonly hasChildren: boolean
  readonly onToggle: () => void
  readonly onNavigate: (() => void) | undefined
  readonly reduceMotion: boolean
  readonly showCounts: boolean
  /** Folder-only — `folderCountsByPath.get(vaultNode.path)`, precomputed once per tree build rather
   * than walked here. Unused when `vaultNode.kind === 'note'`. */
  readonly count: number | undefined
}

/** The content Mantine's `TreeNode` renders INSIDE its own `<li>` — see the module doc for why this
 * component does not, and cannot, own that `<li>` itself. */
function VaultNavRow({
  vaultNode,
  labelId,
  active,
  expanded,
  hasChildren,
  onToggle,
  onNavigate,
  reduceMotion,
  showCounts,
  count,
}: VaultNavRowProps) {
  const { hrefFor, renderLink, renderIcon, renderChevron } = useVault()

  if (vaultNode.kind === 'note') {
    if (vaultNode.note === undefined) return null
    const note = vaultNode.note
    // Resting color reads `--vault-nav-hover-ink` (set by `.row:hover`) with the resting shade as
    // its `var()` fallback — see the module doc. Active bypasses the hover var entirely; it's
    // never a transient state, so it can just resolve straight to ink.
    const color = active ? VX.ink : `var(--vault-nav-hover-ink, ${VX.ink2})`
    return (
      <div className={classes.row} data-active={active || undefined} onClick={onNavigate}>
        <RowChevronSpacer />
        <RowIcon icon={vaultNode.icon} renderIcon={renderIcon} fallback="note" />
        <div className={classes.anchorReset} style={{ flex: 1, minWidth: 0 }}>
          {renderLink(
            hrefFor(note),
            <RowLabel id={labelId} label={note.title} color={color} weight={active ? 600 : 400} />,
          )}
        </div>
      </div>
    )
  }

  const folderNote = folderNoteOf(vaultNode)
  const color = active ? VX.ink : `var(--vault-nav-hover-ink, ${VX.muted})`

  return (
    <div
      className={classes.row}
      data-active={active || undefined}
      // A folder with no folder-note has no link of its own — the whole row toggles, not just the
      // chevron. A folder WITH one only toggles from the chevron; the row's click goes to the link
      // instead, via the wrapping anchorReset div's own onClick below.
      onClick={folderNote === undefined ? onToggle : undefined}
    >
      <RowChevron
        expanded={hasChildren && expanded}
        reduceMotion={reduceMotion}
        onToggle={onToggle}
        renderChevron={renderChevron}
      />
      <RowIcon
        icon={vaultNode.icon}
        renderIcon={renderIcon}
        fallback={hasChildren && expanded ? 'folder-open' : 'folder-closed'}
      />
      {folderNote !== undefined ? (
        <div className={classes.anchorReset} style={{ flex: 1, minWidth: 0 }} onClick={onNavigate}>
          {renderLink(
            hrefFor(folderNote),
            <RowLabel id={labelId} label={vaultNode.name} color={color} weight={600} underline />,
          )}
        </div>
      ) : (
        <RowLabel id={labelId} label={vaultNode.name} color={color} weight={600} />
      )}
      {showCounts && (
        // `aria-hidden`: the row's accessible name is already computed via `aria-labelledby`
        // (`useTreeItemA11ySync`, pointing at `labelId`) — appending a bare number here without it
        // would still be excluded from that computation, but stamping it anyway keeps this span
        // inert under any future a11y-name strategy too, not just today's. `margin-left: auto`
        // pins it to the row's right edge regardless of whether the label side is a link or plain
        // text (both are `flex: 1` already).
        <span
          aria-hidden="true"
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
            color: VX.muted,
          }}
        >
          {count}
        </span>
      )}
    </div>
  )
}

export function VaultNav({
  activePath,
  storageKey = 'basalt-ui-obsidian:vault-nav-expanded',
  className,
  onNavigate,
  showCounts = false,
}: VaultNavProps) {
  const { index } = useVault()
  const rootRef = useRef<HTMLUListElement>(null)
  const reduceMotion = useReducedMotion()
  const [focusedPath, setFocusedPath] = useState<string | undefined>(undefined)

  // Per-instance prefix so two simultaneously-mounted `VaultNav`s (the desktop sidebar and the
  // mobile drawer) never stamp the same `id` — see the module doc's third patch paragraph.
  const reactId = useId()

  const {
    data: treeData,
    nodesByPath,
    namesByPath,
    hasChildrenByPath,
    selectableValueByPath,
    labelIdByPath,
    folderCountsByPath,
  } = useMemo<TreeBuildResult>(() => {
    const nodesByPath = new Map<string, VaultTreeNode>()
    const namesByPath = new Map<string, string>()
    const hasChildrenByPath = new Map<string, boolean>()
    const selectableValueByPath = new Map<string, string>()
    const folderCountsByPath = new Map<string, number>()
    const data = buildTreeNodeData(
      index.tree.children ?? [],
      nodesByPath,
      namesByPath,
      hasChildrenByPath,
      selectableValueByPath,
      folderCountsByPath,
    )
    // Index-based, not derived from the path's characters — see the module doc's `aria-labelledby`
    // paragraph: two distinct legal vault paths can sanitize to the same string, which would collide
    // two rows' ids. `nodesByPath`'s iteration order is the exact depth-first order `buildTreeNodeData`
    // just walked, so this is a second pass over identity, not a re-derivation.
    const labelIdByPath = new Map<string, string>()
    let labelIndex = 0
    for (const path of nodesByPath.keys()) {
      labelIdByPath.set(path, `vault-nav-label-${reactId}-${labelIndex}`)
      labelIndex += 1
    }
    return {
      data,
      nodesByPath,
      namesByPath,
      hasChildrenByPath,
      selectableValueByPath,
      labelIdByPath,
      folderCountsByPath,
    }
  }, [index.tree, reactId])

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
  const expandedRecord = useMemo<TreeExpandedRecord>(
    () => Object.fromEntries(expanded.map((path) => [path, true])),
    [expanded],
  )

  // Mantine's own ArrowRight/Space toggle ANY node, leaf notes included (no `hasChildren` guard in
  // `TreeNode`'s handler) — filtering to folders here keeps that from leaking note paths into the
  // persisted expanded set. See the module doc.
  const handleExpandedStateChange = useCallback(
    (next: TreeExpandedRecord) => {
      const nextArr = Object.entries(next)
        .filter(([path, isExpanded]) => isExpanded && nodesByPath.get(path)?.kind === 'folder')
        .map(([path]) => path)
      setExpanded((prev) => (sameMembers(prev, nextArr) ? prev : nextArr))
    },
    [setExpanded, nodesByPath],
  )

  // Derived, never held — see the module doc. A folder-note's selectable `value` is its FOLDER's
  // path (`selectableValueByPath`), not the note's own path, since that's the row Mantine renders.
  const selectedState = useMemo(() => {
    if (activePath === undefined) return []
    const value = selectableValueByPath.get(activePath)
    return value === undefined ? [] : [value]
  }, [activePath, selectableValueByPath])
  const selectedValue = selectedState[0]

  const tree = useTree({
    expandedState: expandedRecord,
    onExpandedStateChange: handleExpandedStateChange,
    selectedState,
  })

  const renderNode = useCallback(
    (payload: RenderTreeNodePayload) => {
      const vaultNode = nodesByPath.get(payload.node.value)
      const labelId = labelIdByPath.get(payload.node.value)
      if (vaultNode === undefined || labelId === undefined) return null
      return (
        <VaultNavRow
          vaultNode={vaultNode}
          labelId={labelId}
          active={payload.selected}
          expanded={payload.expanded}
          hasChildren={payload.hasChildren}
          onToggle={() => tree.toggleExpanded(payload.node.value)}
          onNavigate={onNavigate}
          reduceMotion={reduceMotion}
          showCounts={showCounts}
          count={folderCountsByPath.get(payload.node.value)}
        />
      )
    },
    [nodesByPath, labelIdByPath, tree, onNavigate, reduceMotion, showCounts, folderCountsByPath],
  )

  // Single delegated focus tracker — `focusin` bubbles, and with exactly one listener (at the tree
  // root, not one per row) `event.target` is unambiguously the `<li>` that actually received focus.
  const handleTreeFocus = useCallback((event: FocusEvent<HTMLUListElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'treeitem') return
    setFocusedPath(target.dataset['value'])
  }, [])

  // Home/End/Enter/type-ahead — everything else (arrows, Space) is handled by Mantine's own
  // `TreeNode` and never reaches this handler. See `use-tree-keyboard-extras.ts`.
  const handleRootKeyDown = useTreeKeyboardExtras({
    rootRef,
    namesByPath,
    hasChildrenByPath,
    toggleExpanded: tree.toggleExpanded,
  })

  // The three-in-one a11y/focus patch — see `use-tree-item-a11y-sync.ts`.
  useTreeItemA11ySync({
    rootRef,
    hasChildrenByPath,
    expandedSet,
    focusedPath,
    selectedValue,
    labelIdByPath,
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
    <Tree
      ref={rootRef}
      {...(className !== undefined && { className })}
      data={treeData}
      tree={tree}
      renderNode={renderNode}
      aria-label="Vault notes"
      levelOffset={14}
      withLines={false}
      expandOnClick={false}
      expandOnSpace={false}
      selectOnClick={false}
      allowRangeSelection={false}
      onKeyDown={handleRootKeyDown}
      onFocus={handleTreeFocus}
      classNames={{ root: classes.tree, node: classes.item, subtree: classes.group }}
    />
  )
}
