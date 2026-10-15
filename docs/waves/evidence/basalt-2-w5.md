# basalt-ui-obsidian — Wave 5 visual check against the 1.41.0 baseline (basalt-ui 2.8.0)

Recorded 2026-10-15 on branch `basalt-2`. Pins are `2.8.0`. Both dists were built from the Wave 1 scratch vault
(recipe in `basalt-2-w1.md`): the 1.41.0 dist is the Wave 1 one, the 2.8.0 dist is
`vite build --outDir /tmp/basalt-w5-dist` from this worktree. Both were served by a `Bun.serve` SPA-fallback script
on non-production ports and captured with headless Chrome (`puppeteer-core`), 1.41.0 and 2.8.0 on the same day so the
relative ages ("41w") match without masking. Scripts live in `/tmp/basalt-w5` (not durable).

Deviation from the plan: the "scratch nginx" was not used. Docker is Makefile-only in this repo (hook-enforced), and no
Makefile target starts a second container, so the served-dist checks ran against the Bun server. nginx-specific behaviour
(`no-cache` headers, bind mount) is Wave 6's live verify.

## Gate

| Check                      | Result                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `make check`               | green after the docblock edit: `fmt:check`, `oxlint .` + `check-theme`, `tsc` ×3 clean, `bun test` 261 pass / 1 skip / 0 fail                           |
| Demo build                 | green, `vite build --outDir /tmp/basalt-w5-dist`, 92 precache entries (4537.28 KiB)         |
| `/review` (Waves 2–5 diff) | 1 blocking (disproved), 2 improvements (1 fixed, 1 skipped), 4 test-gap notes (not actioned) |
| `@verifier` on the dist    | PASS with one note (CLS, below)                                                              |

## Screenshot diff (37 pairs, 1.41.0 vs 2.8.0)

Per-pixel diff in headless Chrome (channel delta > 24, then > 3 to catch faint changes). Set: 6 routes × light/dark ×
desktop 1440 / phone 390@2x, the `#diagram` scroll, TOC sheet, collapsed rail, Cmd+K (plain and with a query), and the
"Vault failed to load" state.

| Result                                                     | Pairs                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Pixel-identical (0 % at both thresholds)                  | 25 of 37: every `home`, `recent`, `tags`, `bookmarks`, `cmdk-*`, `vault-failed-*` pair, `search-dark-*`, `recent-*`, and `showcase-diagram-{light,dark}-desktop` + `-light-phone` |
| Noise (<0.02 %, ≤1 caret/dot)                              | 4: `home-light-phone`, `search-light-desktop`, `search-light-phone`, `showcase-diagram-dark-phone`      |
| Differs: the code fence region of `/Showcase` (4.2–7.7 %)  | 8: `showcase-{light,dark}-{desktop,phone}`, `sidebar-collapsed-{light,dark}-desktop`, `toc-sheet-{light,dark}-phone` (all the same note view, fence and everything below shifts up) |

Everything outside the fence is identical: shell, nav, tokens, callouts, table, mermaid, TOC rail, Spotlight, failure
state. Files: `basalt-2-w5/` holds the 37 2.8.0 PNGs (same names as `basalt-2-w1/`, which is the 1.41.0 baseline), plus
`showcase-light-phone-1.41.png`, `copy-button-long-line-hover-{1.41,2.8}.png`.

## Classification

| Difference                                                    | Class                                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Fence inner padding 28 px → 10 px (pre margin 18/14 → 0)      | Intended 2.x, see "Code fence delta"                                         |
| **Copy button overlaps the first code line**                  | **Regression, basalt-rooted** — see "basalt friction"; not worked around     |
| Back-nav scroll restores 447 of 600 (1.41.0: 0)                | Improvement, not a regression; cause settled below                           |
| Entry JS +29652 B, CSS +18246 B, precache +100.2 KiB          | Explained below                                                              |
| `/Showcase` CLS 0.008–0.014 vs 0–0.005 (Lighthouse, 3 runs)   | Noise-level, under 0.1; plausibly the same fence reflow, not diagnosed       |
| Phone TOC trigger overlap, mermaid skew, phone fence clip, dark callouts, whole-word search, 760 px home list (Wave 1 oddities 1–6) | Unchanged on 2.8.0 (pixel-identical regions); inherited, not regressions |

## Code fence delta (orchestrator question)

Measured on `/Showcase` at 1440 (expanded) and 390 (compact), plus a paragraph and a list cloned directly in front of
the fence (`insertBefore`, same CSS) so the gap is not read only against an `h2`:

| Gap (px)                       | 1.41.0 exp / compact | 2.8.0 exp / compact |
| ------------------------------ | -------------------- | ------------------- |
| paragraph → fence wrapper      | 18 / 14              | 18 / 14             |
| list → fence wrapper           | 18 / 14              | 18 / 14             |
| fence wrapper → paragraph      | 18 / 14              | 18 / 14             |
| fence wrapper → list           | 18 / 14              | 18 / 14             |
| reference paragraph → paragraph | 14 / 11             | 14 / 11             |
| `pre` margin-top / bottom      | 18 / 18 (14 compact) | 0 / 0               |
| wrapper height (`.container`)  | 117 / 109            | 81 / 81             |
| body top → first code line     | 28 / 24              | 10 / 10             |

The fence is **not** flush: the outer `_container` margin (18/14) still separates it from the preceding paragraph or
list, and from the next block, identically on 1.41.0 and 2.8.0. What moved is the *inner* spacing: 1.41.0 stacked a
18 px `pre` margin on top of the 10 px body padding (28 px to the first line); 2.8.0 drops the `pre` margin (10 px).
Rhythm vs prose is equivalent → this part is **intended**. The side effect is the copy-button regression below.

## basalt friction

1. **CodeBlock copy button overlaps the first code line (basalt `CodeBlock`, 2.8.0 vs 1.41.0).** The 22 px copy button
   keeps its position (`y` = wrapper top + 6) while the first code line moved from `y` = top + 29 to top + 11, so the
   button's box (6–28) now sits across the line (11–29). 1.41.0 left a 28 px button row above the code (button bottom
   498, line top 499 at 1440). 2.8.0: button bottom 498, line top 481 = **17 px overlap**. Visible wherever the first
   line reaches the right edge: on the phone it is always visible (the touch button is permanent) and clips the
   `number` token on the demo's 41-character first line; on desktop it appears on hover over any first line longer than
   ~70 characters (`copy-button-long-line-hover-2.8.png` vs `-1.41.png`). Not worked around (no local CSS for it).
   Suggested row: `basalt-ui-obsidian W5` — `CodeBlock` needs either a top inset equal to the button row or right padding
   on the first line. Filing is the orchestrator's; basalt-ui is PR-required and was not touched.
2. **Dev-only chunks are emitted and SW-precached in production.** `dev-dock` (1695 B), `theme-lab` (32197 B) and
   `react-{router,query}-devtools_basalt-ui` (109 + 108 B) are new 2.x lazy chunks, 34109 B in total, in the 92-entry
   precache. They are never requested at runtime in the built app (network trace on `/Showcase`: zero requests), so the
   cost is the first-visit PWA precache only. Removing them locally would be a `globIgnores` workaround, so it was
   left alone. Minor.
3. Back-nav restore is one-shot (below); the router bridge does not re-apply when late content grows the page. Minor,
   not a ledger row by itself.

## Back-nav scroll restoration (Wave 3 open item): settled

Instrumented `Element.scrollTop` on `<main>`: on back, the router writes `scrollTop = 600` **once**, at a moment when
`<main>` is `scrollHeight − clientHeight = 447`, so it clamps to 447; the page later grows to 647 and nothing re-applies.
At that moment the fences are still plain `<pre>` fallbacks (the `<pre>` heights are 81 and 101 px) and become the
highlighted shiki block (61 px) and the mermaid SVG afterwards, so late async content (shiki highlighter, mermaid)
changes the page height after the restore. Targets of 200 and 400 restore exactly; 600 and 640 land on 447. 1.41.0
restored none of them (always 0) because it had no scroll restoration. Verdict: **intended 2.x behaviour (an
improvement), not a regression, not a defect of this repo**. A one-shot restore against late-growing content is
inherent to the router bridge; it is the same cause as any lazily-highlighted fence.

## Bundle: what changed and why (1.41.0 → 2.8.0, same scratch vault)

| Group                                   | 1.41.0 B | 2.8.0 B | Δ B     |
| --------------------------------------- | -------- | ------- | ------- |
| entry JS                                | 667414   | 697066  | +29652  |
| entry CSS                               | 280277   | 298523  | +18246  |
| shiki grammar/engine chunks (`core`, `css`, `engine-javascript`, `sql`, `rust`, `html`) | 296003 | 332108 | +36105 |
| dev-only chunks (basalt `dev-dock`, `theme-lab`, devtools stubs) | 0 | 34109 | +34109 |
| everything else (Mantine chunk re-split, panels, glue; vendor `dist-*.js` is byte-identical at 1590430) | 3284943 | 3269575 | −15368 |
| **Total `assets/`**                     |          |         | **+102744** |

- Entry JS +29.7 KB: the provider now owns router, query client, telemetry, modals/notifications/Spotlight mounts and
  the dev-dock `lazy()` stub; the demo deleted its own equivalent (`QueryClientProvider`, `BasaltOverlays`) but the
  framework code is larger than what it replaced.
- Entry CSS +18.2 KB: 2.x `styles.css` `@import`s the Mantine core, notifications and spotlight layers.
- Shiki +36.1 KB: the repo's shiki/@shikijs pins moved 4.4.3 → 4.5.0 to match basalt's peer table in Wave 2; a new `core`
  chunk of 30957 B appears and `css` grows 4324 B. Not basalt code.
- Mantine split: the `FocusTrap`/`Input`/`tokens`/`preload-helper` chunks became `Stack`/`InputBase`/`react`, from
  Mantine 9.6.1 → 9.7.2; −14.4 KB net.
- SW precache: 92 entries both versions; 4437.12 KiB → 4537.28 KiB (+100.16 KiB), which is the +102744 B above; no
  entries were added or dropped beyond the renamed chunks and the four dev-only ones.
- Build-id (Makefile formula over the scratch dist): `24d7c27b59bfc93d773a17e806b64833` (1.41.0:
  `79c76ca27350ecb53981bb009a37bae7`).

## Verifier (`@verifier`, puppeteer-core + Lighthouse 13.5.0, both dists)

- Console, page errors, failed requests, 8 routes × desktop and phone: **0 on every route on both versions** except the
  known `fonts.googleapis.com/css2?family=var(--basalt-font-sans)…` `ERR_BLOCKED_BY_ORB` on `/Showcase` (ledger row 68,
  same URL on both versions, one per render).
- Service worker on 2.8.0: 1 registration, scope `/`, activated and controlling, precache `workbox-precache-v2` with 92
  entries including `index-BQxA3W6K.js` and `index-B6CK1gCK.css`.
- Lighthouse desktop (3 runs): `/` 86 / 100 / 100 / 91 on both versions (FCP 1.63 s, LCP 1.73 s, TBT 0, CLS 0);
  `/Showcase` 66 / 97 / 100 / 91 on both (an 80 and a 81 run appear on both versions: variance). CLS on `/Showcase`
  0.008–0.014 vs 0–0.005.
- Cmd+K and Ctrl+K open exactly one dialog (the app's `VaultSearchSpotlight`, "Search the vault…"), Escape closes it,
  on `/` and `/Showcase`, desktop and phone, both versions.
- OTel and Kuma: none (`AGENTS.md` § Verify & Monitor).

## `/review` of the Waves 2–5 diff

| Finding                                                                                   | Disposition                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Blocking: `useQuery` without a `QueryClientProvider` after deleting `query-client.ts`     | **Disproved** (reviewer could not run anything; its own note says unverified). 2.8.0 `createBasaltRouter` puts the QueryClient in the router context and `BasaltProvider` reads `router.options.context.queryClient` (`WC()` in the bundle throws only if absent). The built reader fetches `vault.json` through `useVaultIndexQuery` and renders every route with zero console errors (this wave, Wave 2, the verifier). |
| `toVaultSearchActions` docblock still cites `BasaltOverlays`                              | Fixed (`use-vault-search.ts`).                                                                                                       |
| `ObsidianImage` treats a whitespace-only `alt` as non-empty (`alt?.trim()`)               | Skipped: Wave 4 chose literal parity with basalt's `ImageRenderer` (`alt ? <span>{alt}</span> : null`) on `/review`; trimming would diverge from basalt. |
| Test gaps: `ObsidianImage` sizing branches, no-alt refused image, telemetry sink, shell smoke test | Not actioned: not caused by the migration, outside the ask; listed here for the owner.                                          |
