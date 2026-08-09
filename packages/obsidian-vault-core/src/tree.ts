/**
 * Builds the folder/file nav tree from a flat note list, optionally layering in two pieces of
 * Obsidian plugin config (`nav-config.ts`): per-path icons, and explicit per-folder sibling order.
 * Both are additive — omit `config` entirely (or either field) and the tree is exactly what it was
 * before this file grew a second argument: folders before notes, then title `localeCompare`.
 */
import type { VaultNote, VaultTreeNode } from './types.js'

type MutableFolder = {
  name: string
  path: string
  folders: Map<string, MutableFolder>
  notes: VaultNote[]
}

/** Icon map and explicit sibling order, both keyed the same way `nav-config.ts` produces them. */
export type BuildTreeConfig = {
  /** Vault-relative path (folder path, or a note's `path`/`slug`) -> Iconize icon name. */
  readonly icons?: ReadonlyMap<string, string>
  /** Folder path -> ordered child names, as parsed by `parseSortingSpec`/`collectSortingSpecs`. */
  readonly order?: ReadonlyMap<string, readonly string[]>
}

function createFolder(name: string, path: string): MutableFolder {
  return { name, path, folders: new Map(), notes: [] }
}

function titleOf(node: VaultTreeNode): string {
  return node.kind === 'note' ? (node.note?.title ?? node.name) : node.name
}

/** Iconize keys a note by its extension-less slug, but a note's tree `path` still carries `.md` —
 * so a note is looked up both ways; a folder only ever has the one form. */
function iconFor(
  path: string,
  slug: string | undefined,
  icons: ReadonlyMap<string, string> | undefined,
): string | undefined {
  if (icons === undefined) return undefined
  return icons.get(path) ?? (slug === undefined ? undefined : icons.get(slug))
}

/** Names a sorting-spec entry may match against: a folder's own name, or a note's basename/title. */
function candidateNames(node: VaultTreeNode): readonly string[] {
  if (node.kind === 'folder') return [node.name]
  const note = node.note
  return note === undefined ? [node.name] : [note.basename, note.title]
}

/** Index of the first matching candidate name in `orderList`, or -1 when the node isn't listed. */
function orderIndex(node: VaultTreeNode, orderList: readonly string[]): number {
  for (const name of candidateNames(node)) {
    const index = orderList.indexOf(name)
    if (index !== -1) return index
  }
  return -1
}

/** The original no-config ordering: folders before notes, then title compared case-insensitively. */
function defaultCompare(a: VaultTreeNode, b: VaultTreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
  return titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base' })
}

function sortChildren(
  children: VaultTreeNode[],
  orderList: readonly string[] | undefined,
): VaultTreeNode[] {
  if (orderList === undefined || orderList.length === 0) {
    return children.toSorted(defaultCompare)
  }

  // `toSorted` (like `Array.prototype.sort`) is a stable sort, so two children that are BOTH
  // unlisted keep the relative order `defaultCompare` gave them — "unlisted children fall after
  // listed ones in the old order" falls out of that stability rather than needing its own pass.
  return children.toSorted((a, b) => {
    const aIndex = orderIndex(a, orderList)
    const bIndex = orderIndex(b, orderList)
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return defaultCompare(a, b)
  })
}

function toTreeNode(folder: MutableFolder, config: BuildTreeConfig): VaultTreeNode {
  const children: VaultTreeNode[] = []

  for (const child of folder.folders.values()) children.push(toTreeNode(child, config))
  for (const note of folder.notes) {
    const icon = iconFor(note.path, note.slug, config.icons)
    children.push({
      name: note.basename,
      path: note.path,
      kind: 'note',
      note,
      ...(icon !== undefined && { icon }),
    })
  }

  const icon = iconFor(folder.path, undefined, config.icons)
  return {
    name: folder.name,
    path: folder.path,
    kind: 'folder',
    children: sortChildren(children, config.order?.get(folder.path)),
    ...(icon !== undefined && { icon }),
  }
}

export function buildTree(
  notes: readonly VaultNote[],
  config: BuildTreeConfig = {},
): VaultTreeNode {
  const root = createFolder('', '')

  for (const note of notes) {
    const segments = note.path.split('/')
    const dirSegments = segments.slice(0, -1)

    let current = root
    let currentPath = ''
    for (const segment of dirSegments) {
      currentPath = currentPath === '' ? segment : `${currentPath}/${segment}`
      let next = current.folders.get(segment)
      if (next === undefined) {
        next = createFolder(segment, currentPath)
        current.folders.set(segment, next)
      }
      current = next
    }

    current.notes.push(note)
  }

  return toTreeNode(root, config)
}
