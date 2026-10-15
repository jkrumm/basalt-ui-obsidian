# basalt-ui-obsidian — Wave 7 fresh-agent DX trial (basalt-ui 2.8.1)

Recorded 2026-10-15 from `master` at `09f3ee9`.

## Setup

- Worktree `../basalt-ui-obsidian-trial` on branch `trial/graph-route`, `bun install --frozen-lockfile` only (no build).
- One headless `claude -p` run, `--output-format stream-json`, started in that worktree. Neutral brief, verbatim:
  "Add a `/graph` route to the demo app. For the note currently selected (take a note path as a search param, default to
  the first note in the vault index), it lists that note's outgoing links under a header styled as a Callout, and shows a
  preview of the note rendered through Markdown. It needs a sidebar nav entry, should behave sensibly on phone, tablet and
  desktop widths, and use the design system's color tokens. Keep it small and follow the repo's conventions. Run the
  repo's checks when done and report what you changed."
- No mention of the migration, basalt internals, `llms.txt`, rules or skills. The agent loaded `AGENTS.md`/`CLAUDE.md` and the
  `.claude/rules` the way any session would.
- Caveats: the run also inherited the owner's global `~/.claude` config (not a clean-room agent). The worktree contained
  `docs/waves/`; its tree listing showed it, but the agent never opened `PLAN.md` or any evidence file.
- Transcript: `/tmp/w7/transcript.jsonl` (not durable). 26 turns, 201 s, about $1.28.

## Outcome

`make check` green after the agent's work (261 tests, 0 fail), `check-theme` clean, no new `basalt/*` suppressions. Files:
`apps/demo/src/routes/graph.tsx` (new, a container-query `SimpleGrid`, basalt `Callout`, `Markdown` via `useObsidianMarkdown`,
`VX.ink2/muted/accent` only) and `apps/demo/src/lib/nav.tsx` (Graph entry, `mobile: 'more'` because the bar already holds the
5-tab maximum, comment updated). It did not view the page in a browser and committed nothing. The feature is not merged;
worktree and branch are deleted.

The managed layer worked where it was read: the `basalt-mantine` breakpoint rule made the agent replace a viewport `md` span
with a container-query grid, and the `basalt-tokens` rule kept colours on `VX.*`. It never invoked a `basalt-*` skill and
never ran `basalt-ui doctor`.

## Wrong turns

| # | Wrong turn | Root | Disposition |
|-|-|-|-|
| 1 | `cd apps/demo` twice in a persistent shell; second call failed | agent | none |
| 2 | Located `llms.txt` with `find`; AGENTS.md says "at the install directory" without a path | repo | fixed in `310d3cc` |
| 3 | `llms.txt` names `CalloutKind` and nav `mobile` options but not their members; agent grepped `dist/` three times for the unions (`'info'|'good'|'warn'|'bad'`, `'tab'|'more'|'hidden'`) | basalt | friction (a) |
| 4 | `VX` signature in `llms.txt` ends in `…`; two empty greps for ink tokens, resolved by grepping the repo's own `VX.*` usage | basalt | friction (b) |
| 5 | Wrote viewport `md` spans first, then switched to `SimpleGrid type="container"` after reading `basalt-mantine` | rule worked | none |
| 6 | `CONTAINER_KEYS` appears in `llms.txt` by name only; three greps through `dist/` to learn the values (`240/480/800`) | basalt | friction (c) |
| 7 | `--include=*.d.ts` with an unmatched zsh glob errored | agent | none |
| 8 | Fresh worktree: `routeTree.gen.ts` and the packages' `.d.ts` missing; found the fix in `check.yml`, not AGENTS.md (reproduced separately: `bun run typecheck` fails `TS2307` on `obsidian-vault-core` until `bun run build` + a demo build) | repo | fixed in `310d3cc` |
| 9 | Container grid has no unequal-column option; links column ended 50/50 | basalt, unconfirmed | friction (d) |

Repo-owned, not fixed (outside the ask): `NoteView` hides a leading `# Title` heading with a helper that is not exported from
`basalt-ui-obsidian`, so a route outside `NoteView` cannot reuse it.

## basalt friction (for the orchestrator to file, prefix `basalt-ui-obsidian W7 DX trial`)

a. `llms.txt` lists `CalloutKind` and `NavItem.mobile` without the union members; the answer is only in `dist/*.d.ts`.
b. `llms.txt` truncates the `VX` signature with `…`, so the available token names (`ink`, `ink2`, `muted`, `accent`) cannot be read from it.
c. `CONTAINER_KEYS` / `CONTAINER_CLASSES` values (240 / 480 / 800 px) are not in `llms.txt`, yet the breakpoint rule requires them.
d. (unconfirmed) `SimpleGrid type="container"` offers no way to give one column a narrower track; the agent accepted 50/50.
