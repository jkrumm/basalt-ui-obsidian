# basalt-ui-obsidian — Wave 4 content, tokens and the library surface (basalt-ui 2.8.0)

Recorded 2026-10-15 on branch `basalt-2`. Pins are `2.8.0` (the plan text says 2.7.3; claims verified there
stay valid). Baseline is the Wave 1 dist (`/tmp/basalt-w1-dist`, 1.41.0) against a fresh 2.8.0 build of the
same scratch vault (`/tmp/basalt-w4-dist`), both served by the Wave 3 `Bun.serve` SPA script and measured with
headless Chrome (`puppeteer-core`). Scripts live in `/tmp/basalt-w4` (not durable); `measure.json` holds the
raw numbers.

## Gate

| Check                 | Result                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| `make check`          | green: `fmt:check`, `oxlint .` (0 errors) + `check-theme`, `tsc` ×3 clean |
| `bun test`            | 261 pass, 1 skip, 0 fail (was 260; +1 refused-image test)                 |
| Demo build            | green (`vite build --outDir /tmp/basalt-w4-dist`), 92 precache entries    |
| Console, `/Showcase`  | 0 errors/warnings on 2.8.0 at compact and expanded, both schemes          |

## Content semantics

| Surface                          | Finding                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refused image (MIGRATING § 2.0)  | **Repo-owned delta, fixed.** `ObsidianImage` overrides `img`, so basalt's new alt-text span never ran: a refused `src` still rendered the 1.x empty `<span aria-label>`. Now `alt ? <span>{alt}</span> : null` (literal parity with basalt's `ImageRenderer`, per `/review`); test `an image the URL allowlist refuses renders its alt text, with no <img>` failed first, then passes. |
| `contentTrust`                   | Not passed; default `'trusted'` is right for the owner's own vault (`['https://', '/']` image prefixes). No change.                                                                                                                                                                           |
| Heading-id contract              | Unchanged. `headingSlug` in 1.41.0 and 2.8.0 is byte-identical (only `readingTime` was removed, unused here); `obsidian-vault-core`'s `slugify`/`SlugTracker` is the same rule. Rendered ids on `/Showcase`: `code, table, diagram, subsection`, equal to the TOC `href`s on both versions.        |
| Block rhythm, `mobile-density.css` | The twelve `--vx-space-*` anchors it mirrors are unchanged in 2.8.0 `tokens.css` (14/30/10/6/14/6/18, callout 10/14/8, table 5/8); 0.8× rounding still lands on every literal.                                                                                                              |
| Measured computed styles         | `/Showcase`, 1440 and 390 wide, dark and light: paragraph, `h2`, `h3`, table `td`/`th` metrics, article/`h2` rects and `scrollWidth` are identical to 1.41.0. One difference below.                                                                                                              |

The one measured difference: the code fence's own `pre` margin-top is 18 px (expanded) / 14 px (compact) on 1.41.0
and 0 on 2.8.0, so the fence is 36 px shorter (`showcase-*-expanded-dark.png`, `Code` section: 117 px → 81 px
tall). The wrapper's top edge (y 470) is identical; this is basalt's `CodeBlock` chrome, not this repo's CSS.
Classify in Wave 5 as intended 2.x doctrine unless the owner dislikes the tighter fence.

Screenshots (`basalt-2-w4/`, 4 PNGs, 240 KB with `measure.json`): `showcase-<1.41|2.8>-<compact|expanded>-dark.png`.

## Sanitize schema

`mergeSanitizeSchema(rehype-sanitize defaultSchema, BASALT_SANITIZE_SCHEMA, OBSIDIAN_SANITIZE_SCHEMA)` run through
the installed 1.41.0 and 2.8.0 `dist/content/sanitize.js`: the two JSON dumps (296 lines, sorted keys) are
`cmp`-identical (md5 `fe08c12fbe7a316962c85fecd6196fe2`). `sanitize.js` itself differs only by whitespace;
`BASALT_SANITIZE_SCHEMA` is no longer re-exported from the barrel, which this repo does not import.

## Library packaging

- `bun run build` green for both packages; `publint` "All good!" for `basalt-ui-obsidian` and `obsidian-vault-core`.
- Emitted `.d.ts` basalt imports are `basalt-ui/content` (`FenceRenderers`, `MarkdownProps`,
  `SanitizeSchemaExtension`, plus the `ArticleLayoutMeta`/`CalloutKind` users) and `basalt-ui/tokens`; every one
  is exported by 2.8.0's `dist/content/index.d.ts` / tokens barrel. No removed type is referenced.
- `peerDependenciesMeta`: basalt 2.8.0 marks `react-markdown`, `rehype-sanitize` and `remark-gfm` optional; this
  library keeps `react-markdown` and `remark-gfm` required (it renders through them) and `rehype-sanitize`
  optional. Unchanged and correct.
- `obsidian-vault-core` `attw --pack .` exits 1 (`node10` resolution failed on all three entry points, CJS
  require resolves to ESM). **Pre-existing and not basalt-rooted**: the live 1.41.0 checkout fails identically.
  It is an ESM-only package with `exports` only; not touched.

## Comment sweep (only comments that were wrong)

| File                                         | Change                                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `obsidian-vault-core/src/slug.ts`            | `SlugTracker` "collides with basalt's `SlugTracker`" note was false (2.x does not export it); now states the shared algorithm and why it is a separate copy. |
| `apps/demo/src/shell/mobile-density.css`     | Added the 2.8.0 re-derivation line (the file says a moved anchor is silent).                                                                  |
| `apps/demo/vite-plugins/ios-status-bar.ts`   | "re-verified against 1.21.0" → 2.8.0 (`dist/vite.js` still hardcodes `content: "default"`, `BasaltAppOptions` still has no status-bar option). |

Checked and left alone because still true on 2.8.0: `basalt-ui/content/{prose,callout}.module.css` and
`basalt-ui/src/vite.ts` exist in the package; `BasaltBridge`, `SIZE_CLASS_BREAKPOINTS` (840 px) and
`tokens.css`'s `52.49375em` block are present; `tests/setup/dom.ts` cites basalt's own repo file, not the package.

## Bundle (context for Wave 5)

Entry JS 667414 → 697066 B (+29652), CSS 280277 → 298523 B (+18246), vendor `dist-*` 1590430 B unchanged,
precache 92 entries 4437.12 → 4537.28 KiB. Same split Wave 2 recorded; unchanged by this wave's edits.

## Mermaid fonts (ledger row 68)

Not worked around, per the brief. On 2.8.0 `/Showcase` the rendered mermaid SVG still requests the
`fonts.googleapis.com/css2?family=var(--basalt-font-sans)…` `@import` (ORB-blocked); this is the only console/network
entry on 2.8.0 and the same one Wave 1 recorded on 1.41.0. Fixed upstream, unreleased.
