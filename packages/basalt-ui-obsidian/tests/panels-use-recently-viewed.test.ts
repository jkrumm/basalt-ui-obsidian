/**
 * `useRecentlyViewed` / `recordNoteView` — dedupe (a re-view moves an entry to the front instead of
 * duplicating it), the 100-entry cap, and same-tab reactivity (the module doc's own "a bare
 * `useState` initializer would render stale" concern).
 *
 * Both functions share ONE module-level store for the whole test file (`use-recently-viewed.ts`'s
 * own design — see its doc), so tests below deliberately use UNIQUE paths per test rather than
 * asserting an exact, isolated snapshot: the cap test's assertions (exactly 100 entries, newest
 * first) hold regardless of what earlier tests already wrote, which is what makes this file order-
 * independent without needing to reach into the module's private state to reset it.
 */
import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { recordNoteView, useRecentlyViewed } from '../src/panels/use-recently-viewed.js'

describe('useRecentlyViewed / recordNoteView', () => {
  test('dedupes by path: a re-view moves the entry to the front instead of duplicating it', () => {
    recordNoteView('dedupe-a.md')
    recordNoteView('dedupe-b.md')
    recordNoteView('dedupe-a.md')

    const { result } = renderHook(() => useRecentlyViewed())
    const paths = result.current.map((view) => view.path)

    expect(paths.filter((path) => path === 'dedupe-a.md')).toHaveLength(1)
    expect(paths.indexOf('dedupe-a.md')).toBeLessThan(paths.indexOf('dedupe-b.md'))
  })

  test('caps the log at 100 entries, newest first', () => {
    for (let i = 0; i < 150; i += 1) recordNoteView(`cap-${i}.md`)

    const { result } = renderHook(() => useRecentlyViewed())

    expect(result.current.length).toBe(100)
    expect(result.current[0]?.path).toBe('cap-149.md')
  })

  test('re-reads in the same tab when recordNoteView runs — no remount needed', () => {
    const { result } = renderHook(() => useRecentlyViewed())

    act(() => {
      recordNoteView('same-tab-live.md')
    })

    expect(result.current[0]?.path).toBe('same-tab-live.md')
  })
})
