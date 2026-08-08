/** Builds the folder/file nav tree from a flat note list. */
import type { VaultNote, VaultTreeNode } from './types.js'

type MutableFolder = {
  name: string
  path: string
  folders: Map<string, MutableFolder>
  notes: VaultNote[]
}

function createFolder(name: string, path: string): MutableFolder {
  return { name, path, folders: new Map(), notes: [] }
}

function titleOf(node: VaultTreeNode): string {
  return node.kind === 'note' ? (node.note?.title ?? node.name) : node.name
}

function sortChildren(children: VaultTreeNode[]): VaultTreeNode[] {
  return children.toSorted((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
    return titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base' })
  })
}

function toTreeNode(folder: MutableFolder): VaultTreeNode {
  const children: VaultTreeNode[] = []

  for (const child of folder.folders.values()) children.push(toTreeNode(child))
  for (const note of folder.notes) {
    children.push({ name: note.basename, path: note.path, kind: 'note', note })
  }

  return { name: folder.name, path: folder.path, kind: 'folder', children: sortChildren(children) }
}

export function buildTree(notes: readonly VaultNote[]): VaultTreeNode {
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

  return toTreeNode(root)
}
