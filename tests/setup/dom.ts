/**
 * `bun test` preload — registered via `[test].preload` in bunfig.toml. Runs once per process,
 * before any test file, so React 19 + Testing Library have a real DOM.
 *
 * Trimmed from basalt-ui's equivalent (`basalt-ui/tests/setup/dom.ts`) to the three pieces this
 * repo actually needs; the stream/abort restoration there exists for its streaming-agent tests and
 * has no consumer here.
 *
 * 1. `GlobalRegistrator.register()` installs `window`/`document` as globals.
 * 2. happy-dom ships no `ResizeObserver`, `matchMedia`, or `document.fonts`, all of which Mantine
 *    v9 touches on mount. Shimmed, guarded on `typeof` so a future happy-dom wins over the shim.
 * 3. Testing Library's auto-cleanup silently NO-OPS under `bun test` — RTL checks for a GLOBAL
 *    `afterEach`, which Bun exposes only as a `bun:test` export. Wired by hand below; without it
 *    every test's DOM leaks into the next. See oven-sh/bun#7044.
 *
 * Import order matters: `@testing-library/react` reads `typeof document` at module-evaluation
 * time, and static imports hoist above `register()` — hence the dynamic import at the bottom.
 */
import { afterEach } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

if (typeof window.ResizeObserver === 'undefined') {
  class ResizeObserverShim {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = ResizeObserverShim as unknown as typeof ResizeObserver
}

if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

if (typeof document.fonts === 'undefined') {
  // `Document.fonts` is readonly, so it cannot be restored by assignment the way `matchMedia` can.
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { addEventListener: () => {}, removeEventListener: () => {} },
  })
}

const { cleanup } = await import('@testing-library/react')

afterEach(() => {
  cleanup()
})
