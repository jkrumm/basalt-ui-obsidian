# Wave 3 evidence — shell, routing and the command surface

Branch `basalt-2`, basalt-ui `2.8.0`. No source change: every probe came back equal to the 1.41.0 baseline
or better, so this wave is evidence only. Observed with `@verifier` (puppeteer-core, HeadlessChrome/155) on
`apps/demo` built against `/tmp/basalt-w1-vault` for both dists (`/tmp/basalt-w1-dist` = 1.41.0,
`/tmp/basalt-w3-dist` = 2.8.0), 8 routes × 3 size classes (compact 390, medium 1024, expanded 1440).

## Gate

`make check` green: `fmt:check`, `oxlint .` (warnings only, 0 errors) + `check-theme`, `tsc --noEmit` ×3
(0 errors), `bun test` 260 pass / 1 skip / 0 fail (28 files). Demo build green (2.8.0 dist above). No
`basalt/*` suppression added. `/review`: not run, the diff is docs and PNGs only.

## D4 — Spotlight ownership: resolved, one overlay

| Input | 1.41.0 | 2.8.0 |
|-|-|-|
| Meta+K / Control+K | 1 dialog, input "Search the vault…" (24/24 route×size cells) | identical (24/24) |
| `/` | no dialog | no dialog (no shortcut is wired on either dist, so no regression) |
| Sidebar "Open search" click (medium, expanded) | same single dialog | same |
| Second overlay / duplicate Spotlight root | none | none (`spotlight={false}` on `BasaltProvider`) |

2.8 only: one empty, closed `.mantine-Modal-root` is mounted (the provider's modals host); it has no
dialog and no children. `?` opens nothing. No ledger row: `spotlight={false}` is the 2.x answer (2.8.0).

## Shell chrome (2.8.0 equals 1.41.0 in every probed respect)

| Property | compact 390 | medium 1024 | expanded 1440 |
|-|-|-|-|
| Brand "Brain" | header is `display:none` | 48px rail, no brand | in the header |
| Search trigger | in the off-canvas navbar (x=-390) | icon-only, on screen | "Search… ⌘K", on screen |
| Nav | bottom bar, 5 tabs, no More | rail, 5 icon links | sidebar with the 5 destinations |
| `sidebarBlocks` custom node | present, off-screen | `display:none` in the rail, visible once expanded | visible; `display:none` after collapse |

The `SidebarPanels` strip (`role=group[aria-label="Browse vault"]`) is the last child of the nav scroll
region at every size, one instance. The compact bottom bar has no More trigger and no sheet, so "the More
sheet omits it" holds vacuously (as noted in Wave 1: the 1.41.0 phone nav has no More either). The `.d.ts`
agrees: a `kind: 'custom'` block is desktop-only and hidden in the rail unless it sets `icon` + `label` /
`mobile: 'more'`, which the demo does not.

## Route transitions (`/Showcase`, 1440)

| Check | 1.41.0 | 2.8.0 |
|-|-|-|
| TOC rail `position: sticky; top: 12px`, scrolled 600 | pinned (159 → 64) | pinned |
| Sticky ancestors | only `<main data-basalt-scrollport>` has overflow ≠ visible; no transform or containment | same |
| Forward nav (wikilink, sidebar) | scrollTop 0 | scrollTop 0 |
| Back nav from scroll 600 | scrollTop 0 (not restored) | 447, stable for 2 s |
| View transition | none | `startViewTransition` fires, type `basalt-sibling`, forward and back |

Nothing in the app wraps `<Outlet>` in `<ViewTransition>` (grep: no `ViewTransition` in `apps` or
`packages`). Back-navigation restore is partial on 2.8.0 (200 and 400 restore exactly; 600 and 647 land on 447, max
scroll 647). It is better than 1.41.0, which did not restore at all. The cause is undetermined, so it is not claimed as a basalt
bug; Wave 5's visual pass can look again.

## Breakpoints and tokens: nothing moved

Boundaries probed at 839 / 840 / 841 / 1199 / 1200 are identical on both dists: bottom bar only at 839, 48px
rail 840–1199, 256px sidebar from 1200. The demo's literal `52.49375em` (`shell/mobile-density.css`,
`shell/safe-area.css`) is still the exact complement of `SIZE_CLASSES.medium` (840px = 52.5em, 2.8.0
`size-classes.d.ts`); no changed breakpoint. `useSizeClass` consumers: `routes/index.tsx` swaps to the tree
panel at ≤839, `lib/vault-search-spotlight.tsx` uses `=== 'compact'` for the mobile layout; both behave as in 1.41.0.

| Token | 390 | 1440 |
|-|-|-|
| `--vx-space-prose-article-block-gap` | 14px (the `mobile-density.css` override) | 18px |
| `--app-shell-header-height` | 0px (override) | `calc(2.75rem * 1)` |
| `--vx-hit` | 44px (coarse) | 24px |
| `--app-note-stack-gap` | 1.25rem | 1.625rem |

Content gutter (main padding + the Outlet box's 18px), same on both dists: 26px left edge at 390, 82px at 1024
(rail 48), 290px at 1440 (sidebar 256).

## Console

2.8.0, all 8 routes × 3 sizes: 0 errors, 0 warnings, 0 page errors, no 4xx/5xx. The only entry is the known
mermaid `fonts.googleapis.com` `ERR_BLOCKED_BY_ORB` request on `/Showcase` (ledger row 68, ignored).

## Observations (not wave findings)

- Compact has no on-screen search trigger (it lives in the off-canvas navbar); Cmd+K opens it with a keyboard
  only. Identical on 1.41.0, so a baseline fact, not a regression.
- The compact off-canvas navbar is not `aria-hidden` or `inert`, 14 focusable elements, same on 1.41.0. Tab
  reachability was not tested.

## Screenshots (`basalt-2-w3/`, 28 PNGs, ≤72 KB each)

- `shell-{home,showcase}-dark-{compact,medium,expanded}-{1.41,2.8}.png` — before/after pairs (both `home` compact
  and expanded pairs are byte-identical).
- `shell-{home,showcase}-light-{compact,medium,expanded}-2.8.png` — light scheme.
- `shell-searchopen-dark-{compact,medium,expanded}-2.8.png` — the one Spotlight at each class.
- `shell-showcase-rail-dark-expanded-{1.41,2.8}.png` — collapsed rail, strip hidden.
- `shell-showcase-sidebaropen-dark-medium-{1.41,2.8}.png` — medium sidebar expanded.
- `shell-bottombar-{dark,light}-compact-*.png` — five-tab bottom bar, no More.
