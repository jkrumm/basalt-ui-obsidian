import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/**/*.ts', 'src/**/*.tsx'],
  format: ['esm'],
  target: 'es2022',
  bundle: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
})
