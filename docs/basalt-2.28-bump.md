# basalt-ui 2.11.1 → 2.28.0

Bumped `packages/basalt-ui-obsidian` and `apps/demo` to exactly 2.28.0. No peer pins demanded. `sync`: 9 updated, 8 created, 0 drift. `doctor`: all checks pass.

Guard fixes: 7 `inline-spacing` errors, all CSS `padding` literals of 8px/10px (the sub-scale ceiling dropped from 10px to 7px in 2.16.0, `error` since 2.24.0) in `vault-nav.module.css` and `panel.module.css`. Each now reads `var(--mantine-spacing-xs)`; the one 10px became `--mantine-spacing-sm` (12px) and the 6px/8px/10px bottom padding became `xs`. No waivers.

## Shots

Scratch vault: 4 notes (callouts, ts code block, mermaid, task list, table, backlinks). Production builds only; both sides rendered with the 2.28.0 CLI. Images stay in the gitignored `apps/demo/.design-parity/w47/{before,after}`.

| Page | Before → after (light, desktop) |
|-|-|
| `/` (Tree / recently updated) | Whole layout 2–6px tighter vertically; the active "Tree" row loses its blue icon and label tint (grey fill only); segmented control gains a hairline border. |
| `/Projects/Alpha` (note) | Same structure, ~4px tighter; callout, code, mermaid and table intact; nav label size drops about 1px; active "Alpha" row stays neutral. |
| `/Projects` (folder) | "Note not found" in both builds: the reader has no folder page. Only the chrome tightening shows. |
| `/search` | Input and hint ~5px higher; the active "Search" nav row loses its blue tint (neutral grey now). |
| `/tags`, `/recent` | Captured, no structural change beyond the same density shift. |

`shot detect` (default round, no anchors): before 75 (P0 `scan/no-anchors`), after 75 (same).
`--auto-anchors` round: before 100, after 100, no findings.

## FRICTION

1. **Task text points at the wrong file.** The brief says the managed block lives in `CLAUDE.md`; this repo has no `CLAUDE.md` and `sync` rewrote the block in `AGENTS.md`. `AGENTS.md` itself still says the block "lives in `CLAUDE.md`" (pre-existing, stale; left untouched). Expectation: docs and `sync` agree on one file.
2. **`shot` finds no anchors on any route.** Every page shows `no data-shot anchors on <route>`, and `detect` scores 75 with a P0 `scan/no-anchors`. The reader has no `data-shot` attributes, so the default round measures no component. Expectation: either the 2.28.0 `init`/`sync` or the migration notes explain that a pre-2.15 consumer needs anchors to get a score.
3. **`--auto-anchors` gives 100 but proves little.** 18 shots "not declared", 4 skipped, and only one route (`/Projects/Alpha`) produced anchors. The 100 means "no findings among the few things measured", not "parity".
4. **`shot detect` trend is shared across out dirs.** The "trend 75 → 75 → 100 → 100" line chains four unrelated runs (before, after, before-aa, after-aa) because the history is not keyed by `--out`. Expectation: a per-dir trend, or a flag to start fresh, so a before/after pair is not read as a progression.
5. **`--out` outside the project is rejected** (`must be a directory inside the project`), and "the project" resolves to `apps/demo`, not the repo root. `--out ../../.design-parity/...` fails; the path has to be relative to the app dir. The 2.28.0 help text does not say which directory counts.
6. **Quoted route list silently passes.** `shot "/ /Projects/Alpha …"` treated the whole string as one route and wrote one image named `Projects-Alpha-Projects-search-tags-recent-…`, with no error. Expectation: a route that contains a space is rejected.
7. **Playwright is a hard install into the consumer.** `shot` needs `bun add -d playwright` plus a Chromium download, and `doctor` only hints at it. It edits `package.json` and the lockfile, so the install had to be reverted before committing. Expectation: `shot` can run with `bunx`-scoped playwright or a `--playwright` path.
8. **No folder route.** `/Projects` renders "Note not found". Not a basalt-ui issue, but a folder/list page is part of the requested route kinds and does not exist.
9. **Reads worse after: the active nav row.** The 2.11.1 build tinted the active sidebar row blue (icon plus label); 2.28.0 shows a neutral grey fill. This follows the "neutral by default, accent spent only when earned" doctrine, but the current location is now harder to spot at a glance on the sidebar nav (`Tree` / `Search` rows). The consumer has no DESIGN.md deviation for it, so it was left as shipped.
10. **Unstyled "Linked mentions" link.** The backlink anchor renders in browser-default blue with an underline in both builds (pre-existing in the reader's `backlinks.tsx`); the bump neither fixed nor worsened it.
11. **Warnings the bump leaves untouched.** `oxlint` reports 18 warnings (`only-export-components`, `exhaustive-effect-dependencies`, `no-console`, `promise/always-return`), none of them guard errors; they predate the bump.
12. **MIGRATING.md is one 6,000-line file with a version-by-version table.** Finding the inline-spacing change meant grepping across §§ 2.16.0, 2.17.0 and 2.24.0; no single "2.11.1 → 2.28.0" section exists. Expectation: a range-aware summary per consumer-visible guard.
