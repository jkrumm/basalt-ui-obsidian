/**
 * `loadPanel`/`savePanel`/`isPanelKey` — the local-state persistence `SidebarPanels` reads/writes on
 * mount and on every tab switch (`../src/components/sidebar-panels.tsx`'s own doc explains why this
 * is `localStorage`, not the URL). Plain functions, testable without mounting the component — same
 * "no-mount" convention `vault-icons.test.tsx`/`vault-search-spotlight.test.ts` already follow in
 * this app (two React copies in this workspace trip "Invalid hook call" the moment anything mounts).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { isPanelKey, loadPanel, savePanel } from '../src/components/sidebar-panels.js'

const STORAGE_KEY = 'brain:sidebar-panel'

describe('isPanelKey', () => {
  test('accepts each of the five panel keys', () => {
    for (const key of ['tree', 'search', 'tags', 'bookmarks', 'recent']) {
      expect(isPanelKey(key)).toBe(true)
    }
  })

  test('rejects an unrecognized string and null', () => {
    expect(isPanelKey('nonsense')).toBe(false)
    expect(isPanelKey(null)).toBe(false)
  })
})

describe('loadPanel', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('falls back to the default panel when nothing is stored', () => {
    expect(loadPanel()).toBe('tree')
  })

  test('reads back a previously saved panel', () => {
    window.localStorage.setItem(STORAGE_KEY, 'bookmarks')
    expect(loadPanel()).toBe('bookmarks')
  })

  test('falls back to the default panel when the stored value is not a recognized key', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-a-panel')
    expect(loadPanel()).toBe('tree')
  })

  describe('with a throwing localStorage', () => {
    const realLocalStorage = window.localStorage

    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: () => {
            throw new Error('private-mode Safari / quota exceeded')
          },
          setItem: () => {
            throw new Error('private-mode Safari / quota exceeded')
          },
        },
      })
    })

    afterEach(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: realLocalStorage,
      })
    })

    test('loadPanel falls back to the default panel instead of throwing', () => {
      expect(() => loadPanel()).not.toThrow()
      expect(loadPanel()).toBe('tree')
    })

    test('savePanel swallows the write instead of throwing', () => {
      expect(() => savePanel('recent')).not.toThrow()
    })
  })
})
