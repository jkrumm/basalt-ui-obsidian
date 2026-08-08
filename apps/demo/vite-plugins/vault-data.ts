/**
 * `vaultData` — reads an Obsidian vault directory at build/dev time and serves it to the browser
 * as two fetchable static JSON assets: the `VaultBundle` (`vault.json`) and a serialized MiniSearch
 * index (`search-index.json`). The browser has no filesystem, so this is the only place `readVault`
 * ever runs.
 *
 * Fetchable static JSON (not a virtual module) on purpose: the service worker can precache it
 * alongside the app shell, and refreshing vault content after a re-crawl only needs these two files
 * rewritten — not a rebuild of the JS bundle the way a virtual-module import would.
 *
 * Dev: served from an in-memory middleware. Build: emitted via `generateBundle`.
 *
 * Invalidation: the vault is read once per plugin instance and cached for its lifetime. Vite
 * creates a fresh plugin instance every time the dev server (re)starts, so a restart re-reads the
 * vault from disk — that is the "invalidate on restart" story. There is no file watcher: watching
 * ~110 markdown files for a personal vault that changes a few times a day isn't worth the
 * complexity here, and a `readVault` pass is cheap enough (~750 KB of markdown) that "restart to
 * refresh" is the right tradeoff for a demo app.
 */
import { readVault } from 'obsidian-vault-core'
import { buildSearchIndex, serializeSearchIndex, toVaultBundle } from 'obsidian-vault-core/search'
import type { Plugin } from 'vite'

// Deliberately no default. A hardcoded absolute path leaks a username and directory layout into
// git (see rules/security.md), and on a fresh clone it would silently read whatever happens to sit
// at that path instead of failing. Point `VAULT_DIR` at your own vault.
const VAULT_DIR_HELP =
  'No vault directory configured. Set VAULT_DIR (e.g. `VAULT_DIR=~/MyVault bun run dev`) or pass ' +
  '`vaultDir` to the vaultData() plugin.'

const VAULT_ASSET_NAME = 'vault.json'
const SEARCH_ASSET_NAME = 'search-index.json'

type VaultData = {
  readonly vaultJson: string
  readonly searchJson: string
  readonly noteCount: number
}

async function loadVaultData(vaultDir: string): Promise<VaultData> {
  const index = await readVault(vaultDir)
  return {
    vaultJson: JSON.stringify(toVaultBundle(index)),
    searchJson: serializeSearchIndex(buildSearchIndex(index)),
    noteCount: index.notes.length,
  }
}

export type VaultDataOptions = {
  /** Vault directory to read. Falls back to the `VAULT_DIR` env var; one of the two is required. */
  vaultDir?: string
}

export function vaultData(options: VaultDataOptions = {}): Plugin {
  const configured = options.vaultDir ?? process.env['VAULT_DIR']
  if (configured === undefined || configured === '') throw new Error(VAULT_DIR_HELP)
  // Re-declared with an explicit type rather than relying on the narrowing above: `getData` below
  // is a hoisted function declaration, and TS will not carry a narrowing into one.
  const vaultDir: string = configured

  // Lazy + memoized per plugin instance — see the module doc's invalidation note.
  let dataPromise: Promise<VaultData> | undefined
  function getData(): Promise<VaultData> {
    dataPromise ??= loadVaultData(vaultDir)
    return dataPromise
  }

  return {
    name: 'basalt-ui-obsidian-demo:vault-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === `/${VAULT_ASSET_NAME}`) {
          void getData().then(({ vaultJson }) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(vaultJson)
            return undefined
          }, next)
          return
        }
        if (req.url === `/${SEARCH_ASSET_NAME}`) {
          void getData().then(({ searchJson }) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(searchJson)
            return undefined
          }, next)
          return
        }
        next()
      })
    },
    async generateBundle() {
      const { vaultJson, searchJson } = await getData()
      this.emitFile({ type: 'asset', fileName: VAULT_ASSET_NAME, source: vaultJson })
      this.emitFile({ type: 'asset', fileName: SEARCH_ASSET_NAME, source: searchJson })
    },
  }
}
