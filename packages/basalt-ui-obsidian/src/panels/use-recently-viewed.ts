/**
 * `useRecentlyViewed` / `recordNoteView` — a `localStorage`-backed "recently viewed notes" log,
 * newest-first, deduped by path, capped at 100 entries.
 *
 * Framework-free storage plus a `useSyncExternalStore` READER: `recordNoteView` is a plain function
 * a click handler calls directly (not a hook — a note view happens in response to navigation, not
 * component render), while `useRecentlyViewed` is the reactive half every mounted `recent-panel.tsx`
 * subscribes through. A bare `useState` initializer would only read `localStorage` once, at mount —
 * recording a view and then navigating to the Recent panel (the exact flow this hook exists for)
 * would render whatever was there BEFORE that view. The module-level `listeners` set plus one shared
 * `storage` event listener (attached once, on first subscribe, never torn down — same lifetime as
 * the module itself) is what makes `recordNoteView` reach every subscriber synchronously in the SAME
 * tab, and every OTHER open tab asynchronously via the native `storage` event (which never fires in
 * the tab that made the write).
 *
 * `getSnapshot` returns `cachedSnapshot` by reference, never a freshly-built array — `useSyncExternalStore`
 * calls `getSnapshot` on every render to check whether a re-render is needed, and a NEW array
 * reference on every call (even with identical contents) would make every render "look" changed and
 * loop.
 */
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'basalt-ui-obsidian:recent-views'
const MAX_ENTRIES = 100

export type RecentView = {
  readonly path: string
  /** Epoch ms of the view. */
  readonly at: number
}

type Listener = () => void

const listeners = new Set<Listener>()
let cachedSnapshot: readonly RecentView[] = []
let cacheLoaded = false
let storageListenerAttached = false

function isRecentView(value: unknown): value is RecentView {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RecentView).path === 'string' &&
    Number.isFinite((value as RecentView).at)
  )
}

/** Guarded for SSR (`typeof window`) and private-mode Safari / malformed JSON / quota-exceeded
 * (`try`/`catch`) — same two guards `bookmarks-panel.tsx`'s own `localStorage` reads/writes apply.
 * Capped at `MAX_ENTRIES` here too, not just in `recordNoteView` — an oversized stored value (written
 * by a future version with a higher cap, or edited by hand) would otherwise render unbounded until
 * the next write re-caps it. */
function readStorage(): RecentView[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isRecentView).slice(0, MAX_ENTRIES) : []
  } catch {
    return []
  }
}

function writeStorage(entries: readonly RecentView[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // quota exceeded / private-mode Safari — the view just doesn't persist this session
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

/** One shared listener for the module's whole lifetime, not one per `subscribe` call — a `storage`
 * event only ever needs to refresh the ONE shared `cachedSnapshot`; every subscriber's own React
 * re-render then follows from `notify()`, same as a same-tab write. */
function ensureStorageListener(): void {
  if (storageListenerAttached || typeof window === 'undefined') return
  storageListenerAttached = true
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return
    cachedSnapshot = readStorage()
    cacheLoaded = true
    notify()
  })
}

/** Records a view of `path`: moves it to the front (deduped, not duplicated) with a fresh `at`,
 * capped at 100 entries, and notifies every subscribed `useRecentlyViewed()` in this tab
 * synchronously. */
export function recordNoteView(path: string): void {
  const current = cacheLoaded ? cachedSnapshot : readStorage()
  const rest = current.filter((entry) => entry.path !== path)
  const next = [{ path, at: Date.now() }, ...rest].slice(0, MAX_ENTRIES)
  cachedSnapshot = next
  cacheLoaded = true
  writeStorage(next)
  notify()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  ensureStorageListener()
  return () => listeners.delete(listener)
}

function getSnapshot(): readonly RecentView[] {
  if (!cacheLoaded) {
    cachedSnapshot = readStorage()
    cacheLoaded = true
  }
  return cachedSnapshot
}

/** Newest-first `{ path, at }` list, re-reading whenever `recordNoteView` runs (same tab) or another
 * tab's `storage` event fires for this key — see the module doc. */
export function useRecentlyViewed(): readonly RecentView[] {
  return useSyncExternalStore(subscribe, getSnapshot)
}
