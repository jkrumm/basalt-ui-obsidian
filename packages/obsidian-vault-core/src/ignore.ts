/**
 * Ignore-filter logic for the vault walk: the hardcoded skip list (`.git`, `node_modules`,
 * `.obsidian`, any dotted directory) plus the optional Obsidian `userIgnoreFilters` read from
 * `.obsidian/app.json`. Not part of the public surface — consumed by `vault-reader.ts` only.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const ALWAYS_SKIP_DIRS = new Set(['.git', 'node_modules', '.obsidian'])

/** True for directory names the walk never descends into, regardless of any ignore filter. */
export function isHardSkippedDir(name: string): boolean {
  return ALWAYS_SKIP_DIRS.has(name) || name.startsWith('.')
}

/**
 * Reads `<dir>/.obsidian/app.json` and returns its `userIgnoreFilters` array. Missing or
 * malformed input is not an error — it falls back to an empty list.
 */
export async function readObsidianIgnoreFilters(dir: string): Promise<readonly string[]> {
  try {
    const raw = await readFile(join(dir, '.obsidian', 'app.json'), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return []

    const filters = (parsed as Record<string, unknown>)['userIgnoreFilters']
    if (!Array.isArray(filters)) return []

    return filters.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

/**
 * Builds a matcher over a flat list of ignore entries (folder prefixes ending in `/`, or exact
 * file paths). `relPath` is a vault-relative POSIX path with no leading `/`; works for both a
 * directory's own path (to prune the walk early) and a file's path.
 */
export function createIgnoreMatcher(filters: readonly string[]): (relPath: string) => boolean {
  return (relPath: string): boolean => {
    for (const filter of filters) {
      if (filter.endsWith('/')) {
        const prefix = filter.slice(0, -1)
        if (relPath === prefix || relPath.startsWith(filter)) return true
      } else if (relPath === filter) {
        return true
      }
    }
    return false
  }
}
