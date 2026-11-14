# basalt-ui-obsidian — Agent Instructions

## Design system — read DESIGN.md

Read `DESIGN.md` before any UI work — it records this app's deltas on top of the shipped
basalt-ui doctrine. The doctrine itself is the six `basalt-*` rules in `.claude/rules/`.

The basalt-ui managed block (stack, precedence, local-bin rule, restraint and chart-doctrine
overrides) lives in `CLAUDE.md`, because `basalt-ui sync` owns it there and CI gates it with
`sync --check`. Agents that do not load `CLAUDE.md` should read that block too — never hand-edit it.

## Validate

`make check` runs `make typegen`, then `bun run pre`: `fmt:check` (oxfmt), `lint:basalt` (`oxlint .`
plus `basalt-ui check-theme` from the local bin), `typecheck` (`tsc --noEmit` per workspace) and
`test` (`bun test`). It writes no vault, and exits non-zero on the first
failure. Not covered: `make build` (writes `apps/demo/dist/`) and `make verify` (asserts the served
bundle); neither is validation.

**`make typegen`** emits the gitignored artifacts `typecheck` needs — the two packages' `.d.ts`
(`bun run build`) and the demo's `src/routeTree.gen.ts` (a demo build against a throwaway one-note
vault, `--outDir` in a temp dir, so the live `apps/demo/dist/` is untouched). It runs `bun install`
first when `node_modules` is missing, so `make check` is green from a fresh checkout or worktree
with no manual steps. Without it `typecheck` reports `TS2307` on `obsidian-vault-core` /
`basalt-ui-obsidian` and `TS2345` on route paths. `.github/workflows/check.yml` does the same inline.

**basalt-ui reference:** the installed `llms.txt` is `packages/basalt-ui-obsidian/node_modules/basalt-ui/llms.txt`.
It truncates long signatures (the `VX` token list ends in `…`) and names types without their members
(`CalloutKind`, `CONTAINER_KEYS` values); for those read the `.d.ts` under `dist/` beside it, or the `VX.*`
names already used in `packages/basalt-ui-obsidian/src`.

## Deploy

`make deploy` is an alias of `make up`: build the workspace + demo site, then `make verify` before
printing the URL. This is the deploy mechanism on the mini. There is no container: Caddy's host-less
`:7733` block (dotfiles `config/Caddyfile`) serves `apps/demo/dist` with `file_server`, reading it off
disk per request, so a build is live on the next request and nothing restarts. `make refresh` is the
content-only path — it rebuilds `apps/demo/dist` from `VAULT_DIR`; the `com.jkrumm.brain-web-refresh`
LaunchAgent runs it every 5 minutes when the vault's git HEAD moves. There is no rollback step:
reverting means rebuilding the previous revision and running `make refresh`.

## Verify & Monitor

- **Health URL:** `http://127.0.0.1:7733/` (loopback only; Caddy fronts it externally). `make verify`
  probes it and compares the served `http://127.0.0.1:7733/build-id.txt` against the working tree's
  `apps/demo/dist/build-id.txt` — an md5 of `vault.json` plus every emitted JS/CSS asset.
- **Deployed version:** `make version` prints the commit sha the served bundle was built from, read
  from `http://127.0.0.1:7733/commit.txt` (`make build` writes `dist/commit.txt` from `git rev-parse HEAD`).
  It exits non-zero unless the body is a 40-hex sha — the door answers a missing file with the SPA
  `index.html` and a 200. `project.yaml` (`deploy.mode make`, target `mini`, `verify: make verify`)
  is how the factory ships this repo.
- **Kuma monitor:** `none` — `~/SourceRoot/homelab/uptime-kuma/monitors.yaml` has no brain-web
  monitor. The nearest entries are `Brain Sync - Push` and `Brain Backup - Push`, which watch the
  vault's git sync/backup, not this reader.
- **OTel `service.name`:** `none` — the app ships no OpenTelemetry instrumentation; there is no
  `service.name` to route a signal by.

## Gotchas

- **No container, no `docker-compose.yml`, no `nginx.conf`** — retired 2026-11-14 when Caddy took
  over `:7733`. Don't reintroduce one: it would fight Caddy for the port. Door logs are Caddy's,
  not this repo's.
- `make verify`'s `MISMATCH` means the door is serving a different `dist/` than this tree's (wrong
  cwd or checkout), not staleness to rebuild past. `SKIPPED` means one side could not be read (e.g. no
  `build-id.txt` yet) — it is not a pass; don't treat it as one.
- The cache policy lives in the `:7733` block of dotfiles `config/Caddyfile`: `/`, `index.html`,
  `vault.json`, `search-index.json` and `sw.js` are `no-cache` on purpose (rewritten in place, or the
  PWA never sees an update); only hashed `/assets/` are immutable. Change it there, not here.

<!-- basalt:begin 2.28.0 -->

## basalt-ui (managed — do not hand-edit)

Placed by `basalt-ui init`, refreshed by `basalt-ui sync` (`--check` gates drift in CI); edit `DESIGN.md`, not this block.

**Stack:** React 19 + Mantine v9 via `basalt-ui` (`BasaltProvider`, `BasaltShell`), TanStack Router and
Query, TanStack Charts via `basalt-ui/charts`, Bun, oxlint + oxfmt, no Tailwind. Color is `VX.*` or a
series token, never a literal.

**Precedence** (highest wins): consumer `DESIGN.md` > the six shipped `basalt-*` rules in
`.claude/rules/` > the `basalt-*` skills. Each rule bullet ends in the lint rule, guard kind or type
that enforces it; skills are procedure, not law.

**Run the local bin** (`./node_modules/.bin/basalt-ui` or a package script), never `bunx`; `init` is
the one exception. In a workspace: the app package's `node_modules/.bin/basalt-ui`.

**Before guessing an import, read the installed `llms.txt`** at the install directory (in a workspace,
under the depending package; `basalt-ui doctor` prints where; a fresh worktree needs `bun install` first).

**Skills and subagent** (installed in `.claude/`; invoke by name):

- `/basalt-app`: scaffold, wire, upgrade or verify the app (`init`, `doctor`, `sync`).
- `/basalt-design`: build or restyle a screen — scenario, `basalt-ui shot` rounds, review, revise; routes to its `references/` on demand.
- `/basalt-charts`: add or extend a chart, register its series colors.
- `basalt-design-reviewer` (subagent): scores a `basalt-ui shot` out dir per component; run it after every shot round, never on your own work.

@./DESIGN.md

**Restraint override (supersedes `/frontend-design`).** This is a calm, data-dense professional
surface: no "bold aesthetic direction", gradient meshes, grain or dramatic motion. Neutral by default,
the single accent spent only when earned.

**Chart override.** `/basalt-design`, `/basalt-charts` and the `basalt-charts` rule supersede any global chart rule and
the bundled `/dataviz` skill (its palette, marks, forms yield to basalt's tokens, catalogue, guards): compose `CartesianChart`.

<!-- basalt:end -->
