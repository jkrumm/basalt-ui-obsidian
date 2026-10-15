# basalt-ui-obsidian — Wave 1 baseline on basalt-ui 1.41.0

Recorded 2026-10-15 at `e1112cf`. Both `basalt-ui` pins read `1.41.0`; the library peer is `^1.30.2`.
`bun install --frozen-lockfile` is clean. No pin was touched.

## Gate on 1.41.0

| Check        | Result                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `make check` | green: `fmt:check`, `oxlint .` (4 warnings, 0 errors) + `check-theme`, `tsc --noEmit` ×3 (0 errors), `bun test` |
| `bun test`   | 260 pass, 1 skip, 0 fail, 487 expects, 28 files (261 tests)                                                     |
| Demo build   | green against the scratch vault                                                                                 |

oxlint warnings (baseline, not regressions): `no-console` in `copy-assets.mjs:41`,
`exhaustive-effect-dependencies` in `vault-nav.tsx:738` and `vault-search-spotlight.tsx:143`,
`promise/always-return` in `sw-update.ts:50`.

## Reproduction

Scratch vault `/tmp/basalt-w1-vault` (git repo, 5 commits at fixed dates, 4 notes: `Welcome`, `Showcase`,
`Projects/Alpha`, `Areas/Health`, plus `.obsidian/bookmarks.json` with `Showcase` and `Alpha`).
`Showcase` carries two callouts (note, warning), a `ts` fence, a table, a `mermaid` fence, wikilinks (plain
and aliased), a task list and an `h2`/`h3` outline. The vault is outside the repo; recreate it from this
description (the content is not load-bearing beyond those features).

This checkout is the live brain-web checkout (the served `build-id.txt` equals `apps/demo/dist/build-id.txt`),
so the baseline build did **not** use `make build`: it would have overwritten the served `dist/`. Used instead:

```
bun run build   # workspace packages
cd apps/demo && VAULT_DIR=/tmp/basalt-w1-vault vite build --outDir /tmp/basalt-w1-dist --emptyOutDir
```

build-id recomputed with the Makefile formula over the scratch dist: `79c76ca27350ecb53981bb009a37bae7`.
Wave 5 must use the same `--outDir` route. Scratch dist served by a 12-line `Bun.serve` SPA-fallback script (file if it exists, else
`index.html`); a second instance returns 500 for `/vault.json` to produce the failure state.

## Bundle (1.41.0, scratch vault)

| Artifact                                  | Bytes                                 |
| ----------------------------------------- | ------------------------------------- |
| entry `assets/index-N2vZ8t5f.js`          | 667414                                |
| `assets/index-B6viLNB8.css`               | 280277                                |
| vendor `assets/dist-CsyB0UlE.js`          | 1590430                               |
| shiki `tsx` / `typescript` / `jsx` chunks | 175529 / 181073 / 177785              |
| `assets/` file count                      | 82                                    |
| SW precache                               | 92 entries, 4437.12 KiB               |
| `sw.js`                                   | 6301                                  |
| `vault.json` / `search-index.json`        | 3921 / 2065 (scratch-vault dependent) |
| build-id (md5)                            | `79c76ca27350ecb53981bb009a37bae7`    |

Entry JS, CSS, vendor chunk and precache count match Appendix B exactly; precache size differs by the
scratch vault's `vault.json`/`search-index.json` (4432.00 → 4437.12 KiB).

## Screenshots

`docs/waves/evidence/basalt-2-w1/`, 37 PNGs, 1.8 MB. Desktop 1440×900, phone 390×844 @2x (mobile, touch).
`<scheme>-<vp>` = {light,dark}-{desktop,phone}; scheme verified via `data-mantine-color-scheme`.

| Files                                                                                  | Proves                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `home-<scheme>-<vp>.png`                                                               | `/`: Recently updated (Updated/Viewed toggle) on desktop; tree + bottom nav on phone |
| `recent-…`, `search-…`, `tags-…`                                                       | those routes render (search: empty-query state)                                      |
| `bookmarks-<scheme>-<vp>.png`                                                          | `/bookmarks` lists **Showcase** and **Alpha · Projects** (populated, not empty)      |
| `showcase-<scheme>-<vp>.png`                                                           | note route `/Showcase`: callouts, shiki fence, table, TOC rail (desktop)             |
| `showcase-diagram-<scheme>-<vp>.png`                                                   | scrolled to `#diagram`: mermaid SVG, task list, linked mentions                      |
| `cmdk-search-<light\|dark>-desktop.png`, `cmdk-search-showcase-query-dark-desktop.png` | Cmd/Ctrl+K opens the app's own Spotlight                                             |
| `sidebar-collapsed-<light\|dark>-desktop.png`                                          | 48 px icon rail                                                                      |
| `toc-sheet-<light\|dark>-phone.png`                                                    | phone "On this page" popover                                                         |
| `vault-failed-dark-<desktop\|phone>.png`                                               | "Vault failed to load / Failed to load vault.json (500)", after 4 retries (~7.6 s)   |

Not captured: a "More" sheet. The phone bottom nav in this baseline is Tree, Search, Tags, Marks, Recent
(5 items, no overflow), so no More sheet renders. The plan's Wave 3 step on the "mobile More sheet" has no
baseline to compare against; it appears only if the 2.x nav overflows.

Caveat: "Recently updated" ages (`OLDER`, `41w`) are relative to the capture date; the fixed 2026-01 commit
dates drift, so Wave 5 diffs of `home`/`recent` need those labels masked or the vault re-dated.

## Runtime evidence

Headless Chrome via `puppeteer-core` (scripts kept outside the repo, in `/tmp`, because `oxlint .` lints
anything under `docs/`) and Lighthouse 13.5.0 (desktop). The chrome-devtools MCP was not
available to the verifier.

- Console: 0 errors, 0 warnings, 0 page errors across all routes/schemes/viewports; 0 HTTP 4xx/5xx.
- One failed request, only where mermaid renders (`/Showcase`):
  `https://fonts.googleapis.com/css2?family=var(--basalt-font-sans):wght@400;500;600;700&display=swap net::ERR_BLOCKED_BY_ORB`.
  The mermaid SVG's inline `<style>` `@import`s a Google Font URL with the unresolved literal
  `var(--basalt-font-sans)`: external and malformed. Baseline oddity, see Left behind.
- Service worker: registered, `activated`, controlling the page, scope `/`.
- Lighthouse:

| Route       | Perf | A11y | Best practices | SEO | FCP / LCP / TBT / CLS        |
| ----------- | ---- | ---- | -------------- | --- | ---------------------------- |
| `/`         | 86   | 100  | 100            | 91  | 1.6 s / 1.7 s / 0 ms / 0     |
| `/Showcase` | 66   | 97   | 100            | 91  | 2.5 s / 3.6 s / 0 ms / 0.005 |

Notable failed audits: unused JS (755 KiB on `/`, 3406 KiB on `/Showcase`), cache lifetimes,
render-blocking (400 ms), `label-content-name-mismatch`, `link-in-text-block` (note route), invalid
`robots.txt` (SPA fallback returns `index.html`; the scratch server's behaviour, not necessarily nginx's).

- Cmd/Ctrl+K opens exactly one dialog: the app's `VaultSearchSpotlight` (Mantine Spotlight, input "Search the
  vault…"). No second overlay. This is the D4 baseline: on 1.41 `BasaltOverlays spotlight={false}` keeps the
  provider Spotlight off.
- OTel and Kuma: none (`AGENTS.md` § Verify & Monitor). Nothing invented.

## Baseline visual oddities (observed, not fixed)

1. Phone note route: the "ON THIS PAGE" trigger overlaps the first paragraph; the popover opens over body text.
2. Phone code fence clips mid-token with no scroll affordance.
3. Mermaid `graph TD` layout is skewed (edges overlap, pale-blue edges on dark, left-heavy box).
4. Spotlight search is whole-word: `show` → no match, `showcase` → Showcase. (Search-index behaviour, not basalt.)
5. Desktop home list capped at ~760 px; right ~40 % empty.
6. Dark callouts (blue note, brown warning) are low-contrast but readable.

Visual inspection covered ~10 of 37 shots by eye; the rest were verified for scheme and background
programmatically only.
