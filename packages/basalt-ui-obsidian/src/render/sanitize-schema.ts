/**
 * Additions-only `sanitizeSchema` extension for basalt-ui's `<Markdown>` — allow-lists the custom
 * hast attributes `useObsidianMarkdown`'s remark plugins and component overrides depend on:
 * `data-callout` / `data-callout-kind` / `data-callout-title` / `data-callout-fold` (blockquote,
 * from `remarkObsidianCallout`'s `hProperties` mirror), `data-wikilink` (a, from
 * `remarkObsidianWikilink`), and `width` / `height` (img, from `remarkObsidianImageSize`).
 *
 * `Markdown` runs its `rehype-sanitize` pass LAST, unconditionally — without this extension every
 * one of these attributes is stripped before the `blockquote`/`a`/`img` overrides below ever see
 * them.
 *
 * The `data-*` keys are the DASHED attribute spelling, verified against hast-util-sanitize 5.0.2:
 * `mdast-util-to-hast` copies `hProperties` onto `node.properties` verbatim, and the camelCase
 * folding that `property-information` applies to KNOWN HTML properties (`class` -> `className`)
 * does not apply to `data-*`, which stay literal. A camelCase entry here (`'dataCalloutKind'`)
 * matches nothing and the attribute is silently stripped — which is exactly what happened before
 * `rehype-sanitize` was installed and the pass started actually running. `width`/`height` ARE
 * known HTML properties and keep their plain names.
 *
 * Deliberately NOT the `'data*'` wildcard hast-util-sanitize also accepts: that would allow every
 * data attribute on these tags, which is a blanket allow wearing an allowlist's clothes.
 */
import type { SanitizeSchemaExtension } from 'basalt-ui/content'

export const OBSIDIAN_SANITIZE_SCHEMA: SanitizeSchemaExtension = {
  attributes: {
    blockquote: ['data-callout', 'data-callout-kind', 'data-callout-title', 'data-callout-fold'],
    a: ['data-wikilink'],
    img: ['width', 'height'],
  },
}
