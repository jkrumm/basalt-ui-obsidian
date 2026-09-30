/**
 * Typed CSS-module declaration (same hand-authored convention as basalt-ui's own
 * `content/article-card.module.css.d.ts`, mirrored locally by `nav/vault-nav.module.css.d.ts`) —
 * named string props, not an index signature, so dot access stays verbatim under
 * `noPropertyAccessFromIndexSignature`.
 */
declare const classes: {
  readonly foldRoot: string
  readonly foldSummary: string
  readonly dataview: string
  readonly dataviewCaption: string
  readonly dataviewCode: string
  readonly body: string
  readonly cell: string
  readonly headerCell: string
  readonly taskCheckbox: string
}
export default classes
