/**
 * NFD-normalises `text`, then strips Unicode combining diacritical marks, so accented input folds
 * onto its unaccented base (`"Ernährung"` -> `"Ernahrung"`). This is what makes `Ernahrung` — what
 * you actually type on an iPhone without long-pressing `a` — find `Ernährung`.
 *
 * Used on BOTH sides of search: as MiniSearch's `processTerm` (shared between index build and
 * browser search via the same `SEARCH_OPTIONS` object in `build-index.ts`, so the two sides cannot
 * diverge), and in the UI-side snippet/highlight matching (`snippet.ts`, `highlight.ts`), so a
 * folded query still finds and highlights the original accented text.
 *
 * Callers that map offsets between a folded string and the original rely on the fold being
 * LENGTH-PRESERVING — true for the vault's Latin diacritics, where a precomposed accented
 * character (`ä`) decomposes under NFD to exactly one base character (`a`) plus combining marks,
 * so stripping the marks yields a same-length string with the same character positions.
 */
export function foldDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}
