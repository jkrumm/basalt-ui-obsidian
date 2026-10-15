# basalt-ui-obsidian on basalt-ui 2.7.3

**Goal:** basalt-ui-obsidian (the `basalt-ui-obsidian` library, `obsidian-vault-core` and the demo
reader served as brain-web) runs on `basalt-ui@2.7.3`: the library's peer range is `^2.7.3`, the demo
is wired on `BasaltProvider` + `createBasaltRouter`, the managed layer is synced, and no workaround for
basalt exists anywhere in this repo. Proven against a recorded 1.41.0 baseline with screenshots and
bundle numbers, then live on brain-web.

**Gate (every wave):** `make check` green (`AGENTS.md` § Validate: `fmt:check`, `oxlint .` +
`basalt-ui check-theme`, `tsc --noEmit` per workspace, `bun test`) plus a demo build
(`VAULT_DIR=<scratch vault> bun --filter @basalt-ui-obsidian/demo build`; a fresh checkout has no
`routeTree.gen.ts` until it runs); `/review` clean on every merged diff; zero new `basalt/*`
suppressions; the wave's evidence in `docs/waves/evidence/basalt-2-w<n>.md`, compared against
`docs/waves/evidence/basalt-2-w1.md` from Wave 2 on.

**Target:** `basalt-ui@2.8.0` (released 2026-10-15; carries the fleet-probe fixes, basalt-ui ledger rows 61–67). Where this plan pins 2.7.3, pin 2.8.0; claims verified on 2.7.3 stay valid.

**Fleet note:** this plan feeds basalt-ui `docs/waves/argo-friction.md`. A basalt-rooted problem
becomes a row there, prefixed `basalt-ui-obsidian W<n>`, and is never worked around locally. This repo
stays exact-pinned on the 1.41.0 pin until Wave 2 runs. basalt-ui is PR-required: a lead that cannot
land the row writes it into its wave's **Left behind** and the orchestrator files it. This file is
separate from any `docs/waves/PLAN.md`; it does not edit, reorder or start waves there.

## Ground truth and decisions

- Inventory and probe numbers: Appendix A and B below. Contract: the installed package's
  `MIGRATING.md` § 2.0.0 and every section 2.0.1 … 2.7.3 (this repo reads from 2.0.0; the 1.x sections
  are already behind it at 1.41.0). Worked shape: argo `docs/waves/PLAN.md`.
- **It is small.** 23 `basalt-ui` import lines in 16 files; the probe broke 6 type errors in 3 files, all
  in the demo's wiring. The library package typechecks clean on 2.7.3, its 260 tests pass, `lint:basalt`
  and `fmt:check` are green. The risk is not compile fallout, it is **silent runtime and visual
  semantics** (provider/overlay mount, Spotlight, content gutter, CSS layer order) and the live reader.
- **D1 — Library versioning: no event.** `basalt-ui-obsidian` and `obsidian-vault-core` are
  `version: 0.0.0`, have no `publishConfig`, no release workflow, and the README states "v0,
  unreleased"; `private` is not set but nothing publishes them. Nothing outside this repo lists
  `basalt-ui-obsidian` in a `package.json` (grepped `~/SourceRoot`, excluding `node_modules` and
  `.claude/worktrees`): the only consumer is `apps/demo` via `workspace:*`. So the `^1.30.2` → `^2.7.3`
  peer move is breaking on paper and free in practice. The wave records it in the README status line;
  no version bump, no changelog, no release. If publishing starts later, 2.x is the first published
  range.
- **D2 — Peer range floor is `^2.7.3`, not `^2.0.0`.** The library imports only `./content` and
  `./tokens` symbols that exist from 2.0, but `^2.7.3` matches the version the demo and the tests were
  proven on; a wider floor would be unproven. Same rule for the Mantine peers: basalt 2.7.3 requires
  `@mantine/core|hooks ^9.7.0`, so the library's own `^9.3.0` ranges move to `^9.7.0`.
- **D3 — Landing order and the live reader (owner decision needed).** `make refresh` is the
  `com.jkrumm.brain-web-refresh` LaunchAgent: every 5 minutes, when the vault HEAD moves, it runs
  `make build` on the **live checkout's working tree** and nginx serves the result. A half-migrated
  master landed in the live checkout is therefore built and served on the next vault change, with no
  visual check. Options: (a) land Waves 2–5 on master with the LaunchAgent paused for the window
  (`launchctl bootout` / `bootstrap` of that one agent, a mini-side change that is the owner's);
  (b) keep the live checkout on a pinned commit until Wave 5 passes and land everything else on master
  only via worktrees. **Tendency: (b)** — no agent state to restore, and the live checkout is already
  read-only to the lead. Waves 2–5 assume (b); Wave 6 advances the live checkout.
- **D4 — Spotlight ownership.** 1.x `BasaltOverlays spotlight={false}` kept the command-palette
  Spotlight off because `src/lib/vault-search-spotlight.tsx` owns Cmd+K. In 2.x `BasaltOverlays` is
  deleted and `BasaltProviderProps` has no Spotlight toggle: the provider mounts `Spotlight`, binds the
  registry hotkeys and generates `nav.<id>` entries from `defineNav`. Wave 3 measures whether two
  Spotlights now compete for Cmd+K. If they do, that is a ledger row (the app's own search is a
  legitimate reason to opt out) and Wave 3 waits for a basalt minor rather than patching around it.

## Wave 1 — Baseline on 1.41.0 <!-- status: active -->

- [ ] Pin check: both `basalt-ui` pins read 1.41.0, `bun install --frozen-lockfile` is clean, and
      `make check` plus the demo build are green on 1.41.0 (Appendix B records the 0-error typecheck).
- [ ] Build against a fixed scratch vault (a small fixed vault kept outside the repo, e.g. under `/tmp`) and record `apps/demo/dist` bytes: entry JS, CSS, the `dist-*` vendor
      chunk, SW precache count and size, `vault.json` and `search-index.json` size, plus the md5
      build-id. Appendix B has the unscripted starting numbers (entry JS 667414, CSS 280277, vendor
      1590430, 92 precache entries / 4432 KiB).
- [ ] Screenshots, light and dark, desktop (1440) and phone (390), of every route that renders basalt
      UI: `/`, `/recent`, `/search`, `/tags`, `/bookmarks`, and a note route `/$` with a callout, a
      code fence, a table, a mermaid fence and an Obsidian wikilink. Also the open Cmd+K search
      overlay, the collapsed sidebar rail, the mobile More sheet, and the "Vault failed to load"
      state. Stored under `docs/waves/evidence/basalt-2-w1/` through the `/img` stack or a size-bounded
      PNG set; the evidence file lists the filenames and what each proves.
- [ ] Runtime evidence this repo can produce: `bun test` count (261 tests, 28 files), console output of
      the served bundle (zero errors and warnings), Lighthouse score for `/` and one note route via
      `@verifier`. There is no OTel and no Kuma monitor (`AGENTS.md` § Verify & Monitor); say so rather
      than inventing one.
- [ ] Commit `docs/waves/evidence/basalt-2-w1.md`. Do not touch any pin.

## Wave 2 — The 2.7.3 bump (atomic) <!-- status: pending -->

Sized from the probe: 6 type errors in 3 files plus 3 `doctor` hard failures. 1.x and 2.x cannot share
the demo, so this lands as one change: pins, wiring and managed layer together.

- [ ] Pins: `basalt-ui` `2.7.3` exact in `packages/basalt-ui-obsidian` devDependencies and
      `apps/demo`; the library peer becomes `^2.7.3` (D1, D2); `@mantine/core|hooks` devDependencies
      and peers to `^9.7.0` (installed 9.6.1 trips bun's incorrect-peer warning); add the now-required
      `@mantine/modals` and `@mantine/notifications` to the demo, and move `shiki`, `@shikijs/*`,
      `@tanstack/react-query` and `motion` to what the 2.7.3 peer table asks if a clean
      `bun install` warns. `bun install` stays warning-free.
- [ ] `apps/demo/src/main.tsx` to the shipped `agent/templates/main.tpl` shape: `createBasaltRouter({
      routeTree })` replaces `createRouter` + `QueryClientProvider` + `RouterProvider`;
      `<BasaltProvider router={router} theme=… defaultColorScheme="dark" telemetry=…>` replaces the
      children-wrapping provider; delete `BasaltOverlays`, `lib/query-client.ts`, and the
      `@mantine/core/styles.layer.css` and `@mantine/spotlight/styles.layer.css` imports (the 2.x
      `styles.css` `@import`s them; keeping them ships the bundle twice). Keep `./shell/*.css` after
      `basalt-ui/styles.css`. `onError` becomes the `telemetry` seam or is dropped, and the choice goes in
      the evidence.
- [ ] `routes/__root.tsx` and `lib/nav.tsx`: `defineNav`, `navGroup`, `useBasaltNav` import from
      `basalt-ui`; `useNav(VAULT_NAV)` and the `{...nav}` spread become `nav={VAULT_NAV}` on
      `BasaltShell`; `createRootRoute` becomes `createRootRouteWithContext<BasaltRouterContext>()`
      only if `doctor` or the template requires it.
- [ ] Toolchain: `tsconfig.base.json` extends `basalt-ui/configs/tsconfig.react-app.json` (doctor
      `tsconfig-base`); keep the repo's stricter extras only if the preset lacks them. Run
      `packages/basalt-ui-obsidian/node_modules/.bin/basalt-ui sync` (local bin, never `bunx`) to
      refresh `.claude/rules`, `.claude/skills`, the AGENTS.md managed block and `.basalt/manifest.json`,
      then `doctor`: zero hard failures. Update the `check.yml` header comment if the sync changes the
      documented bin path.
- [ ] `make check` and the demo build green; README status line records the peer move (D1); a
      the built bundle loads in a headless browser with zero console errors. Compare to
      Appendix B: 0 type errors, 260 pass.

## Wave 3 — Shell, routing and the command surface <!-- status: pending -->

- [ ] Decide D4 with evidence: with the provider-mounted `Spotlight`, press Cmd/Ctrl+K and `/`-style
      hotkeys on every route; record which overlay opens and whether `VaultSearchSpotlight` still
      wins. If the two compete, write the ledger row (`basalt-ui-obsidian W3`), park the Spotlight
      sub-step, and continue the rest.
- [ ] `BasaltShell` props the demo passes (`brand`, `search`, `sidebarBlocks`) against the 2.7.3
      `.d.ts`; `sidebarBlocks` custom node still lands last in the nav scroll region and hides in the
      collapsed rail; the mobile More sheet still omits it.
- [ ] Route transitions: `createBasaltRouter` now sets `defaultViewTransition` with direction from the
      `defineNav` order. Check that the note-route scroll restoration and the TOC rail `position:
      sticky` (documented in `__root.tsx`) survive, and that no `<ViewTransition>` wraps `<Outlet>`.
- [ ] `useSizeClass` consumers (`routes/index.tsx`, `vault-search-spotlight.tsx`) and the demo's
      `shell/mobile-density.css`, `shell/safe-area.css` constants (840px / 52.5em complement) against
      MIGRATING § 1.31 and § 2.0 shell rows; record any changed breakpoint.
- [ ] Evidence `basalt-2-w3.md`: a before/after for the shell at the three size classes.

## Wave 4 — Content, tokens and the library surface <!-- status: pending -->

The library's real basalt surface: `Markdown`, `Callout`, `ArticleLayout`, `mergeSanitizeSchema` and
the fence/component types from `basalt-ui/content`, plus `VX`/`alpha` from `basalt-ui/tokens` in
three panels.

- [ ] Content semantics: `Markdown` blocked-image rendering (`alt` text span, MIGRATING § 2.0
      content), `contentTrust`, the heading-id contract with `TableOfContents`, content inset and block
      rhythm (the demo's `mobile-density.css` overrides it), and the Prose/Callout spacing. Compare
      note-route screenshots to Wave 1.
- [ ] Sanitize schema: `render-sanitize-schema.test.tsx` and `sanitize-schema.ts` against the 2.x
      `SanitizeSchemaExtension` shape (compiles today; confirm the merge result is identical by running
      the schema through both the 1.41 baseline output and 2.7.3 output on the same fixture).
- [ ] Library packaging: `bun run build`, `publint && attw --pack .` in `obsidian-vault-core`, and
      `.d.ts` output of `basalt-ui-obsidian` no longer references a removed basalt type. Re-read
      `peerDependenciesMeta` against the 2.7.3 table (`react-markdown`, `rehype-sanitize`,
      `remark-gfm` stay).
- [ ] Update the comments that cite 1.x behaviour: `obsidian-vault-core/src/slug.ts` (the
      `SlugTracker` collision note: `SlugTracker` is deleted from `basalt-ui/content`, so the
      collision is gone and the comment is stale), `tests/setup/dom.ts`, `mobile-density.css` and
      `safe-area.css` file references (`basalt-ui/content/{prose,callout}.module.css`,
      `basalt-ui/src/vite.ts`). Only edit comments that are now wrong.
- [ ] Not used here, so no wave: charts (none rendered), tables, controls/forms, agent chat, state.

## Wave 5 — Visual check against the baseline (before deploy) <!-- status: pending -->

- [ ] Rebuild with the Wave 1 scratch vault and take the Wave 1 screenshot set again, same
      viewports, schemes and states.
- [ ] Diff each pair; the evidence file lists every difference as intended (2.x doctrine), regression
      (fix or ledger row) or noise. Bundle bytes vs Wave 1: the SW precache and entry/vendor split
      must be explained, not just reported.
- [ ] Fix regressions that are this repo's; write ledger rows for basalt-rooted ones and hold the
      wave until the minor that fixes them or the owner accepts them.
- [ ] `/review` the full migration diff (Waves 2–5) and run `@verifier` on the built `dist` served
      from a scratch nginx on a non-production port (no change to the live container).

## Wave 6 — Deploy and live verify <!-- status: pending -->

- [ ] Advance the live checkout (D3), run `make deploy` (`up`: build, recreate container, `verify`).
      Never raw `docker compose`.
- [ ] Prove it live: `make verify` exits 0 with matching `build-id.txt`; the served
      `http://127.0.0.1:7733/build-id.txt` equals `apps/demo/dist/build-id.txt`; `curl` shows the new
      `index.html` and a 2.x-built asset hash.
- [ ] `@verifier` loads the real brain-web (loopback, and the Caddy URL if reachable) on desktop and
      phone, opens a note, the Cmd+K search, the bookmarks route, and confirms an installed PWA picks up
      the new service worker (the `sw-update` path) with zero console errors.
- [ ] Wait one `make refresh` cycle: touch nothing, let the LaunchAgent fire after the next vault
      commit, and confirm the served build-id still equals a 2.x build. If verify fails, the next PR is
      the fix; rollback is rebuilding the previous revision and `make refresh` (`AGENTS.md` § Deploy).

## Wave 7 — Fresh-agent DX trial <!-- status: pending -->

- [ ] Spawn a fresh agent with no migration context, only `AGENTS.md`, the shipped rules and skills.
      Brief: add a `/graph` route to the demo that lists a note's outgoing links with a `Callout`-styled
      header and a note preview rendered through `Markdown`, using the shell, the `defineNav` entry,
      `useSizeClass` and `VX` tokens (the surfaces this repo uses).
- [ ] Have it record every wrong turn that was basalt-rooted (missing `llms.txt` prop shapes, rule
      silence, a `.d.ts` that disagrees with `MIGRATING.md`, a doctor message it could not act on).
- [ ] Each wrong turn becomes a row in `argo-friction.md` (`basalt-ui-obsidian W7 DX trial`) with the
      workaround it did NOT take; fix repo-owned ones (stale comments, AGENTS.md gaps) in-repo.
- [ ] Evidence `basalt-2-w7.md`: the trial transcript summary and the row list. Remove the trial route
      unless the owner wants it.

**Blast radius:** 23 `basalt-ui` import lines in 16 files (11 in 7 demo files, 12 in 9 library
files incl. 2 tests); ~12 files touched in the bump (3 `package.json`, `bun.lock`, `main.tsx`,
`__root.tsx`, `nav.tsx`, `query-client.ts` deleted, 1–2 tsconfigs, managed layer under `.claude/` +
AGENTS.md + `.basalt`); 6 tsc errors in 3 files; 0 charts to rewrite; deploy target brain-web (nginx on
the mini, loopback 7733 behind Caddy, one user); library has no external consumers. **small**.

---

## Appendix A — Import inventory (basalt-ui 1.41.0 → 2.7.3)

Grep over `packages`, `apps`, `tests`, excluding `node_modules`, `.claude/worktrees`, `dist`. Fate is
read from the installed 2.7.3 `MIGRATING.md` § 2.0.0 (Subpaths/peers, Provider and wiring, Router
bridge, content rows) plus the probe in Appendix B; "compiles" means `tsc` accepted it on 2.7.3.

| File | Subpath | Symbols | 2.x fate |
| - | - | - | - |
| `apps/demo/vite.config.ts` | `basalt-ui/vite` | `basaltAppPlugin`, `basaltViteConfig` | **unmapped** (no § 2.0 row); compiles, `./vite` is still exported. Behaviour (PWA, `injectRegister`) verified in Wave 2 |
| `apps/demo/src/main.tsx` | `basalt-ui/styles.css` | side-effect CSS | kept; now `@import`s Mantine core, notifications and spotlight layers |
| `apps/demo/src/main.tsx` | `basalt-ui` | `BasaltProvider`, `createBasaltTheme` | `BasaltProvider` props change: `children`/`onError` removed, `router` required; `createBasaltTheme` kept (default theme) |
| `apps/demo/src/main.tsx` | `basalt-ui/commands` | `BasaltOverlays` | **deleted** (TS2305); provider mounts modals, notifications, Spotlight. `spotlight={false}` has **no 2.x equivalent** (D4) |
| `apps/demo/src/lib/nav.tsx` | `basalt-ui/router-tanstack` | `defineNav`, `navGroup` | subpath **deleted** (TS2307); both move to `basalt-ui`; `defineNav` needs the `Register` augmentation |
| `apps/demo/src/routes/__root.tsx` | `basalt-ui` | `BasaltShell`, `EmptyState` | kept; `BasaltShell` takes `nav={…}`; `EmptyState` props type deleted (derive), component stays |
| `apps/demo/src/routes/__root.tsx` | `basalt-ui/router-tanstack` | `useBasaltNav`, `useNav` | subpath deleted (TS2307); `useBasaltNav` → `basalt-ui`; `useNav` **deleted** → `BasaltShell nav` |
| `apps/demo/src/routes/index.tsx` | `basalt-ui` | `useSizeClass` | kept (shell-chrome use only, MIGRATING § 1.32) |
| `apps/demo/src/routes/$.tsx` | `basalt-ui` | `EmptyState` | kept |
| `apps/demo/src/lib/vault-search-spotlight.tsx` | `basalt-ui` | `useSizeClass` | kept |
| `apps/demo/src/lib/vault-search-spotlight.tsx` | `basalt-ui/tokens` | `alpha`, `VX` | kept (same specifier on 1.41 and 2.7.3) |
| `packages/basalt-ui-obsidian/src/render/note-view.tsx` | `basalt-ui/content` | `ArticleLayout`, `Markdown`, type `ArticleLayoutMeta` | compiles; `ArticleLayoutProps` type deleted but not used here |
| `packages/basalt-ui-obsidian/src/render/obsidian-components.tsx` | `basalt-ui/content` | `Callout`; types `CalloutKind`, `FenceRenderer`, `FenceRenderers` | compiles; `CalloutProps` deleted, not used |
| `packages/basalt-ui-obsidian/src/render/use-obsidian-markdown.ts` | `basalt-ui/content` | types `MarkdownComponents`, `MarkdownProps` | compiles |
| `packages/basalt-ui-obsidian/src/render/sanitize-schema.ts` | `basalt-ui/content` | type `SanitizeSchemaExtension` | compiles |
| `packages/basalt-ui-obsidian/src/panels/note-list.tsx` | `basalt-ui/tokens` | `VX` | kept |
| `packages/basalt-ui-obsidian/src/panels/bookmarks-panel.tsx` | `basalt-ui/tokens` | `VX` | kept |
| `packages/basalt-ui-obsidian/src/nav/vault-nav.tsx` | `basalt-ui/tokens` | `alpha`, `VX` | kept |
| `packages/basalt-ui-obsidian/tests/render-sanitize-schema.test.tsx` | `basalt-ui/content` | `mergeSanitizeSchema`, type `SanitizeSchemaInput` | compiles |
| `packages/basalt-ui-obsidian/tests/render-use-obsidian-markdown.test.tsx` | `basalt-ui/content` | `Markdown` | compiles |

Non-import wiring:

| Surface | 1.41.0 state | 2.7.3 fate |
| - | - | - |
| `apps/demo/src/lib/query-client.ts` | `new QueryClient()` handed to `QueryClientProvider` | **unmapped** row for a hand-rolled client; implied by `createBasaltRouter`'s owned client. Delete; `useVaultIndexQuery` runs under the router's client |
| CSS layer imports in `main.tsx` | `@mantine/core/styles.layer.css`, `@mantine/spotlight/styles.layer.css`, then `basalt-ui/styles.css` | delete the two Mantine imports (doubles the bundle otherwise) |
| `.oxlintrc.json`, `lefthook.yml`, `check.yml` | extend/exec through `packages/basalt-ui-obsidian/node_modules/basalt-ui/...` | unchanged paths; doctor `lefthook`, `oxlint-preset`, `retired-lint-rules` pass on 2.7.3 |
| `tsconfig.base.json` | own strict set | doctor wants `extends: basalt-ui/configs/tsconfig.react-app.json` |
| CLI use | `sync --check` in CI, `check-theme` in `lint:basalt`, `doctor` in CI | `doctor` gains `app-wiring`, `install-parity`, `tsconfig-base`; run `sync` once in Wave 2 |
| `.claude/rules|skills`, AGENTS.md block, `.basalt/manifest.json` | written by 1.41.0 | refreshed by `sync` |
| `DESIGN.md` | thin consumer file, empty series table | unchanged; no chart series exist |

Unmapped symbols (each a candidate friction row): `basaltAppPlugin` / `basaltViteConfig` (no § 2.0
row), the hand-rolled `QueryClient` + `QueryClientProvider` pattern, `BasaltOverlays spotlight={false}`
(deleted with no Spotlight-opt-out answer), and `BasaltProvider`'s dropped `onError` for apps that
want a console sink without a telemetry backend.

## Appendix B — Probe numbers

Local branch `tmp/basalt-2.7.3-probe` off `57023d8`, never pushed, deleted. Exact pins to `2.7.3`,
library peer to `^2.7.3`, `bun install`, `timeout 600 bun run typecheck`.

| Run | Result |
| - | - |
| Baseline on 1.41.0 (after a demo build wrote `routeTree.gen.ts`) | `obsidian-vault-core`, `basalt-ui-obsidian`, `@basalt-ui-obsidian/demo` typecheck: **0 errors** |
| Typecheck on 2.7.3 | **6 errors** — `obsidian-vault-core` 0, `basalt-ui-obsidian` 0, demo 6 |
| `bun test` on 2.7.3 | 260 pass, 1 skip, 0 fail (28 files) |
| `bun run lint:basalt` on 2.7.3 | exit 0; `oxlint` warnings only (`react/only-export-components`, two `exhaustive-effect-dependencies`, one `no-console`), theme guard "no off-palette colors" |
| `bun run fmt:check` on 2.7.3 | clean |

Errors per file: `src/main.tsx` 4, `src/routes/__root.tsx` 1, `src/lib/nav.tsx` 1. Codes: TS2307 ×2,
TS7006 ×2, TS2322 ×1, TS2305 ×1. Representative:

- `src/lib/nav.tsx(23,37): TS2307: Cannot find module 'basalt-ui/router-tanstack'`
- `src/routes/__root.tsx(22,38): TS2307: Cannot find module 'basalt-ui/router-tanstack'`
- `src/main.tsx(12,10): TS2305: Module '"basalt-ui/commands"' has no exported member 'BasaltOverlays'`
- `src/main.tsx(37,6): TS2322: … Property 'children' does not exist on type … { router: BasaltRouter; theme?: … }`
- `src/main.tsx(41,17): TS7006: Parameter 'error' implicitly has an 'any' type` (`onError` has no type left)

Caveat: the count is a floor. With `basalt-ui/router-tanstack` gone, `defineNav`'s typing cannot fire, and
the `Register` augmentation changes once `createBasaltRouter` replaces `createRouter`, so route-typed
calls (`Link to`, the `$.tsx` and route files) can surface a second wave after Wave 2's wiring edit.

`timeout 120 basalt-ui doctor` in `apps/demo` (local bin, 3 hard failures, 0 warnings):

```
✖ install-parity: basalt-ui resolves at packages/basalt-ui-obsidian/node_modules/basalt-ui (2.7.3), but .basalt/manifest.json was last written by 1.41.0 …
✖ tsconfig-base: tsconfig.json … does not extend the shipped preset — … Fix: set "extends": "basalt-ui/configs/tsconfig.react-app.json"
✖ app-wiring: src/main.tsx does not use createBasaltRouter. Fix: make it match node_modules/basalt-ui/agent/templates/main.tpl
✓ guard-scan (44 files), oxlint preset, lefthook, ai-major-parity, retired-lint-rules, dropped-subpaths, exact-peers, subpath-peers, config-keys
```

Peer table risks seen in the 2.7.3 `package.json` (checked at clean `bun install`: no warning printed,
an incremental one flagged `@mantine/hooks@9.6.1`): `@mantine/core|hooks|modals|notifications|spotlight
^9.7.0` (repo 9.6.1; `modals` and `notifications` are not installed in the demo — required peers in
2.x, `doctor`'s `subpath-peers` stayed green, so verify in the Wave 2 build, not here), `react ^19.3.0`
(repo 19.3.0, ok), `shiki` and `@shikijs/* ^4.5.0` (repo 4.4.3, optional peers), `@tanstack/react-query
^5.104.0` (demo `^5.103.1`), `motion 14.1.0` exact (repo 13.4.0; subpath-required for `./agent` only, so
unused).

Baseline bundle (1.41.0, built against a one-note scratch vault; app JS/CSS do not depend on the
vault): entry `index-*.js` 667414 B, `index-*.css` 280277 B, vendor `dist-*.js` 1590430 B,
`tsx`/`typescript`/`jsx` shiki grammar chunks 175529 / 181073 / 177785 B, SW precache 92 entries /
4432.00 KiB. These are a pointer for Wave 1, which owns the authoritative set.

Probe cleanup: `git checkout -- .`, switched back, `git branch -D tmp/basalt-2.7.3-probe`,
`git branch --list 'tmp/*'` empty, `bun install --frozen-lockfile` restored `node_modules`.
