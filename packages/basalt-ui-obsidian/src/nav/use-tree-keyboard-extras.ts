/**
 * `useTreeKeyboardExtras` — the keys Mantine's `Tree`/`TreeNode` don't handle. `TreeNode`'s own
 * `onKeyDown` covers ArrowUp/Down/Left/Right and Space (`stopPropagation`d there, so they never
 * reach this hook's handler), leaving `Home`/`End`/`Enter`/type-ahead with no Mantine equivalent —
 * those bubble all the way to the tree root's `onKeyDown`, which is the handler this hook returns.
 *
 * Reads `document.activeElement`/`data-value` instead of a hand-maintained flat list — the
 * currently-focused `<li>` already carries `data-value` (Mantine's own `TreeNode` render) and
 * `[role="treeitem"]` document order already IS the visible depth-first order, since a collapsed
 * folder's subtree isn't in the DOM at all (no `display: none` filtering needed, unlike Mantine's
 * own internal ArrowUp/Down handler which supports `keepMounted`).
 *
 * `toggleIfFolder` is the one guard this hook enforces beyond what Mantine gives for free: Enter and
 * Space (via `<Tree expandOnSpace={false}>`, which is what lets Space bubble here at all — see
 * `vault-nav.tsx`) both toggle a folder, never a leaf note, matching the old hand-rolled tree's own
 * behaviour and keeping leaf paths out of the persisted expanded set the same way
 * `handleExpandedStateChange`'s filter does for Mantine's own ArrowRight/Space handling.
 */
import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import { foldDiacritics } from 'obsidian-vault-core/search'

/** Type-ahead accumulates typed characters within this window before the buffer resets. */
const TYPE_AHEAD_TIMEOUT_MS = 500

export type UseTreeKeyboardExtrasOptions = {
  readonly rootRef: RefObject<HTMLUListElement | null>
  readonly namesByPath: ReadonlyMap<string, string>
  readonly hasChildrenByPath: ReadonlyMap<string, boolean>
  readonly toggleExpanded: (path: string) => void
}

export function useTreeKeyboardExtras({
  rootRef,
  namesByPath,
  hasChildrenByPath,
  toggleExpanded,
}: UseTreeKeyboardExtrasOptions): (event: KeyboardEvent<HTMLUListElement>) => void {
  const typeAheadBufferRef = useRef('')
  const typeAheadTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(
    () => () => {
      if (typeAheadTimerRef.current !== undefined) clearTimeout(typeAheadTimerRef.current)
    },
    [],
  )

  const handleTypeAhead = useCallback(
    (char: string) => {
      const root = rootRef.current
      if (root === null) return
      if (typeAheadTimerRef.current !== undefined) clearTimeout(typeAheadTimerRef.current)
      typeAheadBufferRef.current += char
      const buffer = foldDiacritics(typeAheadBufferRef.current.toLowerCase())
      typeAheadTimerRef.current = setTimeout(() => {
        typeAheadBufferRef.current = ''
      }, TYPE_AHEAD_TIMEOUT_MS)

      const items = Array.from(root.querySelectorAll<HTMLElement>('[role="treeitem"]'))
      const count = items.length
      if (count === 0 || buffer === '') return
      const activeElement = document.activeElement
      const currentPath =
        activeElement instanceof HTMLElement ? activeElement.dataset['value'] : undefined
      const currentIndex =
        currentPath === undefined
          ? -1
          : items.findIndex((el) => el.dataset['value'] === currentPath)

      // Scan circularly starting just after the current node, so repeated presses of the same
      // letter cycle through every match instead of always landing on the first one.
      for (let offset = 1; offset <= count; offset++) {
        const candidate = items[(currentIndex + offset + count) % count]
        const path = candidate?.dataset['value']
        const name = path === undefined ? undefined : namesByPath.get(path)
        if (
          candidate !== undefined &&
          name !== undefined &&
          foldDiacritics(name.toLowerCase()).startsWith(buffer)
        ) {
          candidate.focus()
          return
        }
      }
    },
    [rootRef, namesByPath],
  )

  const toggleIfFolder = useCallback(
    (element: HTMLElement) => {
      const path = element.dataset['value']
      if (path !== undefined && hasChildrenByPath.get(path) === true) toggleExpanded(path)
    },
    [hasChildrenByPath, toggleExpanded],
  )

  return useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      const root = rootRef.current
      if (root === null) return
      switch (event.key) {
        case 'Home': {
          event.preventDefault()
          root.querySelector<HTMLElement>('[role="treeitem"]')?.focus()
          return
        }
        case 'End': {
          event.preventDefault()
          const items = root.querySelectorAll<HTMLElement>('[role="treeitem"]')
          items[items.length - 1]?.focus()
          return
        }
        case 'Enter': {
          event.preventDefault()
          const current = document.activeElement
          if (!(current instanceof HTMLElement) || current.getAttribute('role') !== 'treeitem')
            return
          // Click the anchor if the row has one (reusing the exact same path a mouse click takes,
          // onNavigate included), else toggle the folder.
          const anchor = current.querySelector('a')
          if (anchor !== null) {
            anchor.click()
            return
          }
          toggleIfFolder(current)
          return
        }
        case ' ': {
          event.preventDefault()
          const current = document.activeElement
          if (current instanceof HTMLElement && current.getAttribute('role') === 'treeitem') {
            toggleIfFolder(current)
          }
          return
        }
        default: {
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            handleTypeAhead(event.key)
          }
        }
      }
    },
    [rootRef, toggleIfFolder, handleTypeAhead],
  )
}
