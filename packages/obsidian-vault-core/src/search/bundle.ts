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
import type { VaultBacklink, VaultIndex, VaultNote, VaultTreeNode } from '../types.js'

/** A {@link VaultTreeNode} with the note object replaced by its path — see the module doc. */
export type VaultBundleTreeNode = {
  readonly name: string
  readonly path: string
  readonly kind: 'folder' | 'note'
  readonly children?: readonly VaultBundleTreeNode[]
}

export type VaultBundle = {
  /** Bumped whenever the shape changes, so a stale cached bundle is detectable rather than fatal. */
  readonly version: 1
  readonly notes: readonly VaultNote[]
  readonly backlinks: Readonly<Record<string, readonly VaultBacklink[]>>
  readonly tags: Readonly<Record<string, readonly string[]>>
  readonly tree: VaultBundleTreeNode
}

function stripTree(node: VaultTreeNode): VaultBundleTreeNode {
  return {
    name: node.name,
    path: node.path,
    kind: node.kind,
    ...(node.children !== undefined && { children: node.children.map(stripTree) }),
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
  }
}

export function toVaultBundle(index: VaultIndex): VaultBundle {
  return {
    version: 1,
    notes: index.notes,
    backlinks: Object.fromEntries(index.backlinks),
    tags: Object.fromEntries(index.tags),
    tree: stripTree(index.tree),
  }
}

export function fromVaultBundle(bundle: VaultBundle): VaultIndex {
  const byPath = new Map(bundle.notes.map((note) => [note.path, note]))
  const bySlug = new Map(bundle.notes.map((note) => [note.slug, note]))
  const paths = [...byPath.keys()]

  return {
    notes: bundle.notes,
    byPath,
    bySlug,
    backlinks: new Map(Object.entries(bundle.backlinks)),
    tags: new Map(Object.entries(bundle.tags)),
    tree: relinkTree(bundle.tree, byPath),
    resolve(target: string, fromPath: string): VaultNote | undefined {
      const resolvedPath = resolveLinkPath(target, fromPath, paths)
      return resolvedPath !== undefined ? byPath.get(resolvedPath) : undefined
    },
  }
}
