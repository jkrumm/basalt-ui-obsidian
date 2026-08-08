/**
 * `imageRuntimeCaching` — a workbox `runtimeCaching` entry that `CacheFirst`-caches vault images
 * served from an image CDN.
 *
 * The vault embeds hundreds of CDN-hosted icons (champion/item art, mostly 28-56px, referenced
 * inline in note tables — see `Areas/Gaming/Wild Rift/`) that `vite-plugin-pwa`'s precache never
 * sees: `globPatterns` in `vite.config.ts` only matches build output, and these are runtime-fetched
 * `<img>` requests against a separate origin, not bundled assets. Without a runtime-caching rule,
 * offline reading loses every image whose entry in the browser's evictable HTTP disk cache has
 * expired — measured live: 10 of 40 images broken on `/Areas/Gaming/Wild Rift/Rammus` under
 * DevTools' "Offline" emulation, with `net::ERR_INTERNET_DISCONNECTED` six times in the console.
 *
 * `CacheFirst` is correct here (not `StaleWhileRevalidate` or `NetworkFirst`): these are
 * content-addressed transform URLs (`/rs:fit:WxHf:png/<path>`) that never change for a given path,
 * so there is nothing to revalidate against the network — a cache hit is definitionally fresh.
 *
 * Origins are a parameter, not a hardcoded literal, so a consumer pointing this demo at a different
 * vault (and a different CDN) can supply their own. `DEFAULT_IMAGE_ORIGINS` documents this
 * project's own CDN as the default so `vite.config.ts` doesn't need to repeat the literal.
 *
 * Caveat that stays true regardless of this rule: `CacheFirst` runtime caching only fills the cache
 * on first *visit* to a page that references the image — it is a browsing-history cache, not a
 * pre-warmed one. A note never opened online still has no cached icons offline. Pre-warming all
 * ~500 vault images on install was explicitly ruled out (megabytes of eager fetch on first load,
 * on top of the app shell); a same-page warm-on-visit is a separate, smaller feature and not
 * implemented here.
 */
/**
 * Structural subset of workbox-build's `RuntimeCaching` — hand-written rather than imported.
 * `workbox-build` is a transitive peer of `vite-plugin-pwa` (not a direct or hoisted dependency
 * here, and out of scope to add — see `dotfiles/rules/dependency-hygiene.md`), so its types aren't
 * resolvable from this package. This mirrors only the fields `imageRuntimeCaching` actually sets.
 */
type RuntimeCachingEntry = {
  urlPattern: RegExp
  handler: 'CacheFirst'
  options: {
    cacheName: string
    expiration: { maxEntries: number; maxAgeSeconds: number; purgeOnQuotaError: boolean }
    cacheableResponse: { statuses: number[] }
  }
}

/** This project's own image CDN — the default `origins` value for `imageRuntimeCaching`. */
export const DEFAULT_IMAGE_ORIGINS = ['https://img.jkrumm.com']

/** One year: content-addressed URLs never change for a given path, so staleness isn't a concern —
 * this is purely a storage-lifetime cap, not a freshness one. */
const IMAGE_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

/** 494 images in the vault today (`https://img.jkrumm.com`, all champion/item icons). Rounded up
 * with headroom for vault growth, not sized to any particular quota. */
const IMAGE_CACHE_MAX_ENTRIES = 600

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function imageRuntimeCaching(
  origins: string[] = DEFAULT_IMAGE_ORIGINS,
): RuntimeCachingEntry {
  const originPattern = origins.map(escapeRegExp).join('|')

  return {
    // Anchored to the start of the URL and requires a trailing `/` after the origin, so this only
    // ever matches a same-origin-prefixed path — never a same-origin URL that happens to embed one
    // of these hostnames as a query value or path segment.
    urlPattern: new RegExp(`^(?:${originPattern})/`),
    handler: 'CacheFirst',
    options: {
      cacheName: 'vault-images',
      expiration: {
        maxEntries: IMAGE_CACHE_MAX_ENTRIES,
        maxAgeSeconds: IMAGE_CACHE_MAX_AGE_SECONDS,
        // An iOS PWA's cache quota is small and eviction is silent — without this, a quota error
        // inside the CacheStorage write can leave the service worker's cache API in a broken state
        // for subsequent requests. Opting in means a quota hit prunes old entries and degrades
        // (fewer cached images) instead of wedging the SW.
        purgeOnQuotaError: true,
      },
      cacheableResponse: {
        // Verified against the live CDN (`curl -D- https://img.jkrumm.com/rs:fit:144/f:png/blog/
        // wildrift/champions/ahri.png` — a real, existing transform URL, HTTP 200): the response
        // headers carry no `Access-Control-Allow-Origin`, so the browser hands the service worker
        // an opaque response for a cross-origin `<img>` fetch — `status: 0`, not `200`. Without `0`
        // in this list every image would be silently rejected from the cache and this whole entry
        // would be a no-op. This also means workbox cannot see the real status of an opaque
        // response, so an upstream 4xx/5xx from the CDN would be cached as if it were a 200 — a risk
        // this CDN's own behavior (transform proxy in front of content-addressed storage) makes
        // acceptable, since a missing icon is a broken `<img>`, not a page-bricking failure.
        statuses: [0, 200],
      },
    },
  }
}
