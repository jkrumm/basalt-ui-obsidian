// oxlint-disable import/no-default-export -- vite config requires a default export
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { basaltAppPlugin, basaltViteConfig } from 'basalt-ui/vite'
import { fileURLToPath } from 'node:url'
import { mergeConfig } from 'vite'
import { vaultData } from './vite-plugins/vault-data'

// Alias the two workspace packages to their `src/`, same mechanism as the basalt-ui playground's
// `basaltSrc` (a single bare-specifier -> directory mapping resolves every subpath import too,
// e.g. `obsidian-vault-core/search` -> `<src>/search`) — the demo exercises real source with HMR
// instead of a `dist/` that doesn't exist yet, since both packages are being written alongside it.
const obsidianCoreSrc = fileURLToPath(
  new URL('../../packages/obsidian-vault-core/src', import.meta.url),
)
const basaltObsidianSrc = fileURLToPath(
  new URL('../../packages/basalt-ui-obsidian/src', import.meta.url),
)

export default mergeConfig(
  basaltViteConfig({
    port: 7732,
    version: '0.0.0',
    allowedHosts: ['brain.test', 'brain.mini.jkrumm.com'],
  }),
  {
    resolve: {
      alias: {
        'basalt-ui-obsidian': basaltObsidianSrc,
        'obsidian-vault-core': obsidianCoreSrc,
      },
    },
    plugins: [
      vaultData(),
      // tanstackRouter must precede the React plugin — it generates `src/routeTree.gen.ts` from the
      // `src/routes/` tree and rewrites route files for code-splitting before React's transform runs.
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      ...basaltAppPlugin({
        name: 'Brain — Vault Reader',
        shortName: 'Brain',
        description: 'A read-only, offline-capable reader for an Obsidian vault.',
        themeColor: 'auto',
        display: 'standalone',
        serviceWorker: {
          workbox: {
            // The whole corpus (app shell + vault content) is ~750 KB across ~110 notes — smaller
            // than a typical app-shell bundle on its own, so precache everything (json included, for
            // vault.json/search-index.json) and serve cache-first. No incremental sync, no ETag
            // revalidation, no IndexedDB — not worth building for a corpus this size.
            globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json,webmanifest}'],
            // `VaultBundle` (vault.json) carries every note three times over (once in `notes[]`,
            // once each in the `byPath`/`bySlug` record views over the same objects) — ~750 KB of
            // source markdown becomes a few MB of JSON. Workbox's 2 MiB default rejects that file
            // from the precache outright, so raise the ceiling well past the vault's current size.
            maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
            // No `runtimeCaching` rules are added on top of this. That is the point, not an
            // oversight: only files matched by `globPatterns` above ever enter the precache
            // manifest, and a precache-only Workbox setup never caches anything at runtime beyond
            // it. There is no auth today (this deploys tailnet-only) — but a cached login redirect
            // or a cached 401 is the classic way a PWA shell bricks itself, and the only way that
            // happens is an explicit `runtimeCaching` rule. Keeping this config precache-only, with
            // `/api` and `/auth` denylisted from the navigation fallback too, is what keeps that
            // failure mode structurally impossible rather than just "not currently triggered".
            navigateFallbackDenylist: [/^\/api/, /^\/auth/],
          },
        },
      }),
    ],
  },
)
