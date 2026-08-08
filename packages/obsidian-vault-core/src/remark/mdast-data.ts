/**
 * Module augmentation only — no runtime exports (this compiles to an empty module). Adds the two
 * custom `data` fields our remark plugins attach to mdast nodes: `hProperties` (hast-shaped
 * attributes a downstream renderer can spread onto the element it produces) and `callout`
 * (parsed Obsidian callout metadata, set by `remarkObsidianCallout`). Every plugin module that
 * reads or writes either field imports this file for its side effect, which is also what keeps
 * the merge visible to a consumer that imports anything from the `./remark` entry point — mdast's
 * declaration-merge propagates through the same import graph TypeScript already follows for
 * `.d.ts` re-exports.
 */
export type CalloutKind = 'info' | 'good' | 'warn' | 'bad'

export type ObsidianCalloutData = {
  readonly type: string
  readonly kind: CalloutKind
  readonly fold?: 'open' | 'closed'
  readonly title?: string
}

declare module 'mdast' {
  interface Data {
    hProperties?: Record<string, string | number>
    callout?: ObsidianCalloutData
  }
}
