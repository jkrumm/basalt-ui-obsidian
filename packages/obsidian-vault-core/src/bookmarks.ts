/**
 * Reads Obsidian's own `.obsidian/bookmarks.json`, same tolerance idiom as `nav-config.ts`'s
 * `readFolderIcons`: read straight off disk with `readFile` + try/catch, never throw — a missing
 * file, malformed JSON, or a shape this package doesn't recognize all degrade to an empty result
 * rather than failing the vault read.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { VaultBookmark } from './types.js'

/**
 * Parses one raw `items[]` entry into a {@link VaultBookmark}, or `undefined` when it's a shape
 * this package doesn't recognize — an unknown `type`, a `file`/`folder` with no string `path`, or
 * a `search` with no string `query`. Recognized entries are dropped rather than surfaced with
 * missing required fields, since a downstream consumer can't render a file bookmark with no path.
 * A `group` is the one exception that's never dropped for its own shape: its `items` are parsed
 * recursively (invalid children dropped, same rule), and a missing/malformed `items` array becomes
 * `items: []` rather than being treated as invalid — an empty group is still a real group Obsidian
 * shows in its UI.
 */
function parseBookmark(raw: unknown): VaultBookmark | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const entry = raw as Record<string, unknown>

  const title = typeof entry['title'] === 'string' ? entry['title'] : undefined
  const ctime = typeof entry['ctime'] === 'number' ? entry['ctime'] : undefined
  const common = { ...(title !== undefined && { title }), ...(ctime !== undefined && { ctime }) }

  switch (entry['type']) {
    case 'file': {
      const path = entry['path']
      if (typeof path !== 'string') return undefined
      const subpath = typeof entry['subpath'] === 'string' ? entry['subpath'] : undefined
      return { type: 'file', path, ...(subpath !== undefined && { subpath }), ...common }
    }
    case 'folder': {
      const path = entry['path']
      if (typeof path !== 'string') return undefined
      return { type: 'folder', path, ...common }
    }
    case 'search': {
      const query = entry['query']
      if (typeof query !== 'string') return undefined
      return { type: 'search', query, ...common }
    }
    case 'group': {
      const rawItems = entry['items']
      const items = Array.isArray(rawItems)
        ? rawItems.map(parseBookmark).filter((item): item is VaultBookmark => item !== undefined)
        : []
      return { type: 'group', items, ...common }
    }
    default:
      return undefined
  }
}

/**
 * Reads `<dir>/.obsidian/bookmarks.json` and returns its `items` recursively parsed into
 * {@link VaultBookmark}s. This is unvalidated against the note set on purpose — a bookmark can
 * point at an ignored or deleted note, and deciding how to show that is a UI concern, not this
 * package's. A missing or malformed file is not an error — it degrades to an empty array, same as
 * `readFolderIcons`.
 */
export async function readBookmarks(dir: string): Promise<readonly VaultBookmark[]> {
  try {
    const raw = await readFile(join(dir, '.obsidian', 'bookmarks.json'), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return []

    const items = (parsed as Record<string, unknown>)['items']
    if (!Array.isArray(items)) return []

    return items.map(parseBookmark).filter((item): item is VaultBookmark => item !== undefined)
  } catch {
    return []
  }
}
