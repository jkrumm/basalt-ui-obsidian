/**
 * Service-worker registration that actually delivers a deploy.
 *
 * `basaltAppPlugin`'s default `injectRegister: 'auto'` emits a `registerSW.js` whose entire body is
 * `navigator.serviceWorker.register('/sw.js')`. That registers the worker and nothing else: no
 * update polling, and no reaction when a new worker takes over. Combined with a cache-first
 * precache of the whole app, the effect is that a freshly deployed build does not reach an open
 * tab. `registerType: 'autoUpdate'` puts `skipWaiting` + `clientsClaim` in the generated `sw.js`,
 * so the NEW worker does activate and claim the page — but the page has already rendered from the
 * OLD precache by then, and nothing tells it to re-render. You get the new build on some later
 * navigation, which for an installed PWA that resumes from background instead of cold-starting can
 * be never. Measured during development: every deploy required manually unregistering the worker
 * and clearing caches before the change was visible.
 *
 * Two additions fix that, and both are needed:
 *
 * - a periodic `update()` — the browser only checks for a new `sw.js` at registration and roughly
 *   daily after that, so a tab left open (or a PWA resumed from background) never looks. `sw.js` is
 *   served `no-cache` (`nginx.conf`), so each check is one conditional request that 304s when
 *   nothing shipped.
 * - a `controllerchange` reload — the half `autoUpdate` leaves out. When the new worker claims the
 *   page, reload once so the document and its assets come from the new precache.
 *
 * Written against the bare `navigator.serviceWorker` API rather than `virtual:pwa-register`, whose
 * only advantage here was `immediate: true` sugar and which drags in `workbox-window` as a runtime
 * dependency (the build fails outright without it). Ten lines of platform API is the cheaper half
 * of that trade — see `rules/dependency-hygiene.md`.
 *
 * The `refreshing` latch matters: `controllerchange` can fire more than once (a second deploy
 * landing mid-reload, or the browser firing it again after `skipWaiting`), and an unlatched
 * `location.reload()` there is a reload loop that bricks the app instead of updating it.
 */

/** How often an open tab asks whether a new worker shipped. */
const UPDATE_POLL_MS = 60_000

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    globalThis.location.reload()
  })

  // `load`, not immediately: registration competes with the app's own first paint for bandwidth,
  // and the precache fetch is the whole vault. Matches what the vendored `registerSW.js` did.
  globalThis.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
      setInterval(() => {
        void registration.update()
      }, UPDATE_POLL_MS)
    })
  })
}
