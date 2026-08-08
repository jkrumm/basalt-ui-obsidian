# basalt-ui-obsidian

Read an Obsidian vault on the web. A framework-free parser plus (later) a React
reader built on [basalt-ui](https://github.com/jkrumm/basalt-ui).

Status: **v0, unreleased.** Only `obsidian-vault-core` exists so far.

## Packages

- **[`obsidian-vault-core`](packages/obsidian-vault-core)** — parses a vault
  directory into an index (notes, frontmatter, resolved wikilinks, backlinks,
  tags, folder tree), plus remark plugins for Obsidian-flavored syntax and a
  MiniSearch index. Zero React, zero DOM.
- **[`basalt-ui-obsidian`](packages/basalt-ui-obsidian)** — React components
  that render that index through [basalt-ui](https://github.com/jkrumm/basalt-ui):
  note view, recursive nav tree, backlinks, tags, search. It ships no markdown
  renderer of its own — it drives basalt-ui's `<Markdown>` through the two seams
  that component already has, `remarkPlugins` and per-element `components`.
- **[`apps/demo`](apps/demo)** — an offline-first PWA that reads a vault at
  build time and serves it. Point it at your own:

  ```bash
  VAULT_DIR=/path/to/your/vault bun run dev
  ```

  The whole vault is baked in and precached, so it works fully offline once
  installed. There is deliberately no sync engine, no IndexedDB, and no
  incremental revalidation: a typical vault is a few hundred KB of markdown,
  smaller than the app shell that renders it.

## Design

Obsidian's markdown dialect has no complete, maintained npm implementation. The
packages that exist cover one slice each, and several are pinned to a
pre-unified-v11 micromark. So the syntax plugins here are first-party: a
wikilink parser, an image-size-hint parser, and a callout parser, each about as
long as the wrapper a dependency would need anyway.

Link resolution mirrors Obsidian's own: match by basename, or by path suffix
when the target is path-qualified; compare case-insensitively and NFC-normalized
so vaults written on macOS resolve; break ties toward the same folder, then the
shortest path.

## Development

```bash
bun install
bun run pre     # fmt:check + lint + typecheck + test
bun test
```

The acceptance test runs against a real vault when you point it at one:

```bash
OBSIDIAN_VAULT_FIXTURE=/path/to/vault bun test
```

## Hosting

`apps/demo` runs as `brain-web`, always-on on the Mac mini — a static site,
not a dev server. nginx serves `apps/demo/dist` from a read-only bind mount
(`docker-compose.yml`), Caddy fronts it at `brain.test` locally and
`https://brain.mini.jkrumm.com` over the tailnet, and Colima's supervised boot
agent plus `restart: unless-stopped` are the whole uptime story — no
LaunchAgent watches the container itself.

```bash
make up   # build → recreate the container → assert the served bundle matches → http://127.0.0.1:7733
```

Two refresh paths, because code and content change on different clocks. A
code change goes through `make up` — full rebuild, `--force-recreate`. Vault
content changes every few minutes (`brain-sync`'s 300s pull loop keeps
`~/SourceRoot/brain` current) and only needs `make refresh`: a plain
`dist/` rebuild, no container restart, live on the next request because
nginx reads the bind mount fresh every time. A LaunchAgent
(`dotfiles/brain-web/`) makes that automatic — it polls the vault's git HEAD
every 5 minutes and calls `make refresh` only when it moved, so a quiet vault
costs one `git rev-parse` and nothing else.

Bind-mounted, not baked into the image, is the reason `make refresh` never
touches Docker: baking the vault in would mean rebuilding the image on every
content pull, for a corpus that changes far more often than the code does.

## License

Apache-2.0
