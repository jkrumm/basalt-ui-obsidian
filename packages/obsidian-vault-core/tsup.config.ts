import { defineConfig } from 'tsup'

// Unbundled ESM — mirrors basalt-ui's build so every source file keeps a 1:1 dist
// counterpart and consumers can tree-shake per subpath export.
export default defineConfig({
  entry: ['src/**/*.ts'],
  format: ['esm'],
  target: 'es2022',
  bundle: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
})
