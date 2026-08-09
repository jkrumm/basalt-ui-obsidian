/**
 * Out-of-band Obsidian plugin config the web reader also honors, same idiom as `ignore.ts`: read
 * straight off disk with `readFile` + try/catch, never throw — missing or malformed input degrades
 * to an empty result rather than failing the vault read. Two independent inputs:
 *
 * - Iconize's `data.json` ({@link readFolderIcons}): a flat vault-relative-path -> Lucide icon-name
 *   map, minus its one reserved `settings` key (plugin settings, not a vault path).
 * - Custom Sort's `sorting-spec` block ({@link parseSortingSpec}): explicit per-folder child order.
 *   The spec is YAML frontmatter on some note (by convention `sortspec.md`, but never hardcoded —
 *   {@link collectSortingSpecs} scans every parsed note for the key instead), so by the time this
 *   file sees it, `yaml` has already turned the `|` block scalar into a plain multi-line string;
 *   parsing that string is pure and takes no I/O of its own.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { VaultNote } from './types.js'

const ICONIZE_SETTINGS_KEY = 'settings'

/**
 * Reads `<dir>/.obsidian/plugins/obsidian-icon-folder/data.json` (written by the Iconize plugin)
 * and returns its path -> icon-name map. Every top-level key is a vault-relative path (folder or
 * note, matched later against `VaultTreeNode.path`) EXCEPT the reserved `settings` key, which is
 * plugin settings and is skipped; non-string values are skipped too. A missing or malformed file is
 * not an error — it degrades to an empty map, same as `readObsidianIgnoreFilters`.
 */
export async function readFolderIcons(dir: string): Promise<ReadonlyMap<string, string>> {
  try {
    const raw = await readFile(
      join(dir, '.obsidian', 'plugins', 'obsidian-icon-folder', 'data.json'),
      'utf8',
    )
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map()

    const icons = new Map<string, string>()
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (key === ICONIZE_SETTINGS_KEY) continue
      if (typeof value !== 'string') continue
      icons.set(key, value)
    }
    return icons
  } catch {
    return new Map()
  }
}

const TARGET_FOLDER_RE = /^target-folder:\s*(.*)$/

/**
 * A bare line using Custom Sort's advanced syntax (per-item icons, priority markers, wildcard
 * globs, collapsed-range markers) — outside the minimal subset this reads. Recognized so it can be
 * skipped rather than misread as a literal child name.
 */
function isAdvancedSyntaxLine(line: string): boolean {
  return (
    line.startsWith('<') ||
    line.startsWith('>') ||
    line.startsWith('%') ||
    line.startsWith('/') ||
    line.includes('...')
  )
}

/**
 * Custom Sort writes every `target-folder` rooted, `/Areas` and `/Areas/Photography` included, not
 * just the bare vault-root `/` — but `buildTree`'s `order` map is keyed by the SAME folder paths
 * `VaultTreeNode.path` uses, which never carry a leading or trailing slash. Stripping both turns
 * `/` and `` into the root (`''`) and `/Areas/Photography/` into `Areas/Photography`, so every
 * `target-folder` line — root or nested — lands on the key `buildTree` will actually look up.
 */
function normalizeTargetFolderPath(target: string): string {
  return target.replace(/^\/+/, '').replace(/\/+$/, '')
}

/**
 * Parses a Custom Sort `sorting-spec` block into folder-path -> ordered-child-names. Supports only
 * the minimal subset this vault's spec uses: a `target-folder: <path>` line opens a block (`path`
 * rooted or not, see {@link normalizeTargetFolderPath}), and every following non-empty,
 * non-comment (`#`) bare line is the next name in that folder's explicit order — until the next
 * `target-folder:` line closes it. Any line using Custom Sort's advanced syntax is skipped instead
 * of misread (see {@link isAdvancedSyntaxLine}). A line before any `target-folder:` has no folder
 * to attach to and is skipped too. Pure and never throws — worst case, garbage input parses to an
 * empty map.
 */
export function parseSortingSpec(spec: string): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, readonly string[]>()
  let currentPath: string | undefined
  let currentNames: string[] = []

  const flush = (): void => {
    if (currentPath !== undefined) result.set(currentPath, currentNames)
  }

  for (const rawLine of spec.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue

    const targetMatch = TARGET_FOLDER_RE.exec(line)
    if (targetMatch !== null) {
      flush()
      currentPath = normalizeTargetFolderPath((targetMatch[1] ?? '').trim())
      currentNames = []
      continue
    }

    if (currentPath === undefined || isAdvancedSyntaxLine(line)) continue
    currentNames.push(line)
  }

  flush()
  return result
}

/**
 * Scans every parsed note's frontmatter for a string `sorting-spec` key — the spec can live in any
 * note, `sortspec.md` in the brain vault is a naming convention, not a mechanism — and merges every
 * hit through {@link parseSortingSpec}. A folder path defined in more than one note's spec resolves
 * to whichever note is scanned last (plain last-write-wins), which is an unspecified edge case
 * rather than a promised ordering.
 *
 * Takes only `frontmatter`, not a full `VaultNote` — that's the one field this ever reads, and
 * narrowing the parameter lets `vault-reader.ts` pass its own pre-`VaultNote` parsed shape straight
 * through with no adapter.
 */
export function collectSortingSpecs(
  notes: readonly Pick<VaultNote, 'frontmatter'>[],
): ReadonlyMap<string, readonly string[]> {
  const merged = new Map<string, readonly string[]>()
  for (const note of notes) {
    const raw = note.frontmatter['sorting-spec']
    if (typeof raw !== 'string') continue
    for (const [path, names] of parseSortingSpec(raw)) merged.set(path, names)
  }
  return merged
}
