# basalt-ui-obsidian — Agent Instructions

## Design system — read DESIGN.md

Read `DESIGN.md` before any UI work — it records this app's deltas on top of the shipped
basalt-ui doctrine. The doctrine itself is the six `basalt-*` rules in `.claude/rules/`.

The basalt-ui managed block (stack, precedence, local-bin rule, restraint and chart-doctrine
overrides) lives in `CLAUDE.md`, because `basalt-ui sync` owns it there and CI gates it with
`sync --check`. Agents that do not load `CLAUDE.md` should read that block too — never hand-edit it.

## Validate

`make check` runs `bun run pre`: `fmt:check` (oxfmt), `lint:basalt` (`oxlint .` plus
`basalt-ui check-theme` from the local bin), `typecheck` (`tsc --noEmit` per workspace) and
`test` (`bun test`). It is side-effect free — no container, no vault write — and exits non-zero on
the first failure. Not covered: `make build` (writes `apps/demo/dist/`) and `make verify` (asserts
the served bundle); neither is validation.

## Deploy

`make deploy` is an alias of `make up`: build the workspace + demo site, recreate the nginx
container (`--force-recreate`), then `make verify` before printing the URL. This is the deploy
mechanism on the mini. `make refresh` is the content-only path — it rebuilds `apps/demo/dist`
from `VAULT_DIR` with no container churn (nginx serves the read-only bind mount live); the
`com.jkrumm.brain-web-refresh` LaunchAgent runs it every 5 minutes when the vault's git HEAD moves.
There is no rollback step: the bind mount serves whatever `dist/` holds, so reverting means
rebuilding the previous revision and running `make refresh`.

## Verify & Monitor

- **Health URL:** `http://127.0.0.1:7733/` (loopback only; Caddy fronts it externally). `make verify`
  probes it and compares the served `http://127.0.0.1:7733/build-id.txt` against the working tree's
  `apps/demo/dist/build-id.txt` — an md5 of `vault.json` plus every emitted JS/CSS asset.
- **Kuma monitor:** `none` — `~/SourceRoot/homelab/uptime-kuma/monitors.yaml` has no brain-web
  monitor. The nearest entries are `Brain Sync - Push` and `Brain Backup - Push`, which watch the
  vault's git sync/backup, not this reader.
- **OTel `service.name`:** `none` — the app ships no OpenTelemetry instrumentation; there is no
  `service.name` to route a signal by.

## Gotchas

- **Never raw `docker compose`** — go through `make up` / `make refresh` (docker-makefile rule).
  `make logs` is the bounded read (`--tail=200`, exits); `make logs-follow` is the tailer.
- The `dist/` **bind mount**, not an image `COPY`, is what makes `make refresh` container-less.
  Baking the vault into the image would force an image rebuild on every content pull — don't.
- `make verify`'s `MISMATCH` means the container is reading a different `dist/` (stale mount, wrong
  cwd), not staleness to rebuild past. `SKIPPED` means one side could not be read (e.g. no
  `build-id.txt` yet) — it is not a pass; don't treat it as one.
- `nginx.conf` serves `index.html`, `vault.json`, `search-index.json` and `sw.js` as `no-cache`
  on purpose; only hashed `/assets/` are immutable. Don't "optimize" those away.

<!-- basalt:begin 1.41.0 -->

## basalt-ui (managed — do not hand-edit)

Placed by `bunx basalt-ui init`, refreshed by `basalt-ui sync` (`sync --check` gates drift in CI).
Framework-owned: edit `DESIGN.md` or your own files — this block is overwritten on the next sync.

**Stack:** React 19 + Mantine v9 themed by `basalt-ui` (`BasaltProvider` + `createBasaltTheme`), Bun,
oxlint + oxfmt (no ESLint/Biome/Prettier), no Tailwind. Color is the three-tier `--vx-*` token system —
`VX.*` or a series token, never a raw hex. Charts are visx via `basalt-ui/charts`; `check-theme` + the
`basalt/*` oxlint rules are the teeth.

**Precedence — the only statement of it.** Highest wins; a lower layer fills gaps and never
overrides a higher one:

> consumer `DESIGN.md` (app deltas) > the six shipped `basalt-*` rules > the `basalt-*` skills

**All six rules are law** — `basalt-{tokens,mantine,charts,state,controls,batteries}` in
`.claude/rules/`, each with a generated `<!-- basalt:coverage -->` header naming what enforces it and
what is only advisory. The skills (`/basalt-app`, `/basalt-design`, `/basalt-charts`) are METHOD, never law.

**Run the LOCAL bin, not `bunx`** — `./node_modules/.bin/basalt-ui`, or a `package.json` script.
`bunx` does not re-resolve a cached package, so it can answer for a version you upgraded away from;
`init` is the one legitimate `bunx` invocation, because nothing is installed yet.

**Before guessing an import, read the installed package's `llms.txt` and `AGENTS.md`** — at the
install directory (in a workspace, under the depending package; `basalt-ui doctor` prints where).

@./DESIGN.md

**Restraint override (supersedes `/frontend-design`).** This app is a calm, data-dense professional
surface, not a showcase. Ignore the push toward a "BOLD aesthetic direction", gradient meshes,
noise/grain and dramatic motion. Here: the shipped three-font system, depth from a whisper shadow
with a 1px ring, neutral-by-default with the single accent spent only when earned — trend, signal,
or genuine categorical separation. Restraint **is** the identity.

**Chart-doctrine override.** A global `visx-charts` rule auto-loading on `**/charts/**` is generic
non-basalt discipline; here `basalt-charts` supersedes it — compose `CartesianChart`.

<!-- basalt:end -->
