/**
 * `VaultBundle` — a plain JSON-serializable snapshot of a {@link VaultIndex} that a browser can
 * `fetch` and rehydrate via {@link fromVaultBundle}, closing the round trip
 * `toVaultBundle -> JSON.stringify -> JSON.parse -> fromVaultBundle`.
 *
 * Every note appears in the bundle EXACTLY ONCE, in `notes`. A `VaultIndex` holds the same note
 * object under four references — `notes[]`, `byPath`, `bySlug`, and again inside `tree` — which is
 * free in memory and anything but free through `JSON.stringify`, since it has no notion of shared
 * identity and writes a full copy each time. Serializing the index verbatim turned ~750 KB of
 * markdown into a 3.6 MB payload. The maps are derived on rehydration instead, and the tree ships
 * note PATHS which `fromVaultBundle` relinks — this is a phone-facing payload, so a 3-4x size
 * multiplier for data the client can trivially recompute is not a tradeoff worth making.
 */
import { resolveLinkPath } from '../links.js'
import type {
  VaultBacklink,
  VaultBookmark,
  VaultIndex,
  VaultNote,
  VaultTreeNode,
} from '../types.js'

/** A {@link VaultTreeNode} with the note object replaced by its path — see the module doc. */
export type VaultBundleTreeNode = {
  readonly name: string
  readonly path: string
  readonly kind: 'folder' | 'note'
  readonly children?: readonly VaultBundleTreeNode[]
  /** Carried through verbatim from {@link VaultTreeNode.icon} — see its doc. */
  readonly icon?: string
}

export type VaultBundle = {
  /** Bumped whenever the shape changes, so a stale cached bundle is detectable rather than fatal. */
  readonly version: 2
  readonly notes: readonly VaultNote[]
  readonly backlinks: Readonly<Record<string, readonly VaultBacklink[]>>
  readonly tags: Readonly<Record<string, readonly string[]>>
  readonly tree: VaultBundleTreeNode
  /** Added in version 2 — see `fromVaultBundle`'s `bundle.bookmarks ?? []` for the pre-2 fallback. */
  readonly bookmarks: readonly VaultBookmark[]
}

function stripTree(node: VaultTreeNode): VaultBundleTreeNode {
  return {
    name: node.name,
    path: node.path,
    kind: node.kind,
    ...(node.children !== undefined && { children: node.children.map(stripTree) }),
    ...(node.icon !== undefined && { icon: node.icon }),
  }
}

function relinkTree(
  node: VaultBundleTreeNode,
  byPath: ReadonlyMap<string, VaultNote>,
): VaultTreeNode {
  const note = node.kind === 'note' ? byPath.get(node.path) : undefined
  return {
    name: node.name,
    path: node.path,
    kind: node.kind,
    ...(node.children !== undefined && {
      children: node.children.map((child) => relinkTree(child, byPath)),
    }),
    ...(note !== undefined && { note }),
    ...(node.icon !== undefined && { icon: node.icon }),
  }
}

export function toVaultBundle(index: VaultIndex): VaultBundle {
  return {
    version: 2,
    notes: index.notes,
    backlinks: Object.fromEntries(index.backlinks),
    tags: Object.fromEntries(index.tags),
    tree: stripTree(index.tree),
    bookmarks: index.bookmarks,
  }
}

export function fromVaultBundle(bundle: VaultBundle): VaultIndex {
  // Backfilled here rather than left to each consumer: the type says `mtime: number`, but a
  // stale pre-version-2 cached bundle can hand back `undefined`. A version-2 bundle is the
  // common case, so this is one pass over ~100 objects, which is cheaper than every future
  // consumer having to remember a guard the type says it doesn't need.
  const notes = bundle.notes.map((note) => ({
    ...note,
    mtime: Number.isFinite(note.mtime) ? note.mtime : 0,
  }))
  const byPath = new Map(notes.map((note) => [note.path, note]))
  const bySlug = new Map(notes.map((note) => [note.slug, note]))
  const paths = [...byPath.keys()]

  return {
    notes,
    byPath,
    bySlug,
    backlinks: new Map(Object.entries(bundle.backlinks)),
    tags: new Map(Object.entries(bundle.tags)),
    tree: relinkTree(bundle.tree, byPath),
    // The demo app precaches `vault.json` in a service worker, so a client can rehydrate a bundle
    // built before this field existed — tolerate that instead of crashing on a stale cache.
    bookmarks: bundle.bookmarks ?? [],
    resolve(target: string, fromPath: string): VaultNote | undefined {
      const resolvedPath = resolveLinkPath(target, fromPath, paths)
      return resolvedPath !== undefined ? byPath.get(resolvedPath) : undefined
    },
  }
}
