#!/usr/bin/env bun
/**
 * Mirror non-transpiled assets into the unbundled dist — same job, and the same shape, as
 * `basalt-ui/packages/basalt-ui/scripts/copy-assets.mjs`.
 *
 * tsup with `bundle: false` emits only `.ts`/`.tsx`, so two asset classes have to be copied
 * verbatim with the `src/` tree preserved or the published package does not resolve:
 *   - `*.module.css` — the emitted JS keeps its `import classes from './x.module.css'` verbatim
 *     and the consumer's bundler processes it.
 *   - `*.module.css.d.ts` — the co-located type declaration, so the emitted `.d.ts` resolve the
 *     CSS import self-containedly rather than relying on a consumer's ambient declaration.
 *
 * Pair this with the `!src/**\/*.d.ts` exclusion in tsup.config.ts: without it the glob entry
 * treats `vault-nav.module.css.d.ts` as a source file and transpiles it into a junk
 * `dist/nav/vault-nav.module.css.d.js`, which is what this package shipped before.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const SRC = resolve(import.meta.dirname, '..', 'src')
const DIST = resolve(import.meta.dirname, '..', 'dist')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

let n = 0
for (const f of walk(SRC)) {
  if (f.endsWith('.css') || f.endsWith('.css.d.ts')) {
    const dest = join(DIST, relative(SRC, f))
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(f, dest)
    n++
  }
}
console.log(`copy-assets: ${n} css/decl files mirrored into dist`)
