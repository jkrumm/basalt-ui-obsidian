import { defineConfig } from 'tsup'

export default defineConfig({
  // Excludes declaration and test files: the glob entry otherwise treats a co-located
  // `*.module.css.d.ts` as source and transpiles it into a junk `.d.js`. Mirrors basalt-ui's own
  // tsup entry; `scripts/copy-assets.mjs` copies the real CSS + decl files instead.
  entry: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/*.test.{ts,tsx}'],
  format: ['esm'],
  target: 'es2022',
  bundle: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
})
