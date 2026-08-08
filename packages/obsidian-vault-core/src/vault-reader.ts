/**
 * `readVault` — walks a directory on disk into a {@link VaultIndex}: every `.md` file parsed into
 * a `VaultNote` (frontmatter, headings, links), plus the `byPath`/`bySlug`/`backlinks`/`tags`
 * indexes and the wikilink `resolve` closure built over the finished note list.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { normalizeTags, parseFrontmatter } from './frontmatter.js'
import { extractHeadings } from './headings.js'
import { createIgnoreMatcher, isHardSkippedDir, readObsidianIgnoreFilters } from './ignore.js'
import { extractLinks, resolveLinkPath } from './links.js'
import { buildTree } from './tree.js'
import type { ReadVaultOptions, VaultBacklink, VaultIndex, VaultLink, VaultNote } from './types.js'

const MD_EXTENSION_LENGTH = '.md'.length

async function collectMarkdownPaths(
  dir: string,
  isIgnored: (relPath: string) => boolean,
): Promise<string[]> {
  const paths: string[] = []

  async function walk(absDir: string, relDir: string): Promise<void> {
    const entries = await readdir(absDir, { withFileTypes: true })

    for (const entry of entries) {
      const relPath = relDir === '' ? entry.name : `${relDir}/${entry.name}`

      if (entry.isDirectory()) {
        if (isHardSkippedDir(entry.name) || isIgnored(relPath)) continue
        await walk(join(absDir, entry.name), relPath)
        continue
      }

      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      if (isIgnored(relPath)) continue
      paths.push(relPath)
    }
  }

  await walk(dir, '')
  return paths
}

type PendingNote = {
  readonly path: string
  readonly slug: string
  readonly basename: string
  readonly title: string
  readonly frontmatter: Readonly<Record<string, unknown>>
  readonly body: string
  readonly headings: VaultNote['headings']
  readonly rawLinks: readonly Omit<VaultLink, 'resolvedPath'>[]
  readonly tags: readonly string[]
}

function toPendingNote(relPath: string, content: string): PendingNote {
  const { frontmatter, body } = parseFrontmatter(content)
  const lastSegment = relPath.slice(relPath.lastIndexOf('/') + 1)
  const basename = lastSegment.slice(0, -MD_EXTENSION_LENGTH)
  const titleRaw = frontmatter['title']
  const title = typeof titleRaw === 'string' && titleRaw.trim() !== '' ? titleRaw : basename

  return {
    path: relPath,
    slug: relPath.slice(0, -MD_EXTENSION_LENGTH),
    basename,
    title,
    frontmatter,
    body,
    headings: extractHeadings(body),
    rawLinks: extractLinks(body),
    tags: normalizeTags(frontmatter['tags']),
  }
}

export async function readVault(dir: string, options: ReadVaultOptions = {}): Promise<VaultIndex> {
  const useObsidianIgnoreFilters = options.useObsidianIgnoreFilters ?? true
  const obsidianFilters = useObsidianIgnoreFilters ? await readObsidianIgnoreFilters(dir) : []
  const filters = [...(options.ignore ?? []), ...obsidianFilters]
  const isIgnored = createIgnoreMatcher(filters)

  const relPaths = await collectMarkdownPaths(dir, isIgnored)

  const pending: PendingNote[] = []
  for (const relPath of relPaths) {
    const content = await readFile(join(dir, relPath), 'utf8')
    pending.push(toPendingNote(relPath, content))
  }

  const allPaths = pending.map((note) => note.path)

  const notes: VaultNote[] = pending.map((note) => {
    const links: VaultLink[] = note.rawLinks.map((raw) => {
      const resolvedPath = resolveLinkPath(raw.target, note.path, allPaths)
      return { ...raw, ...(resolvedPath !== undefined ? { resolvedPath } : {}) }
    })

    return {
      path: note.path,
      slug: note.slug,
      basename: note.basename,
      title: note.title,
      frontmatter: note.frontmatter,
      body: note.body,
      headings: note.headings,
      links,
      tags: note.tags,
    }
  })

  const byPath = new Map(notes.map((note) => [note.path, note]))
  const bySlug = new Map(notes.map((note) => [note.slug, note]))

  const backlinks = new Map<string, VaultBacklink[]>()
  for (const note of notes) {
    for (const link of note.links) {
      if (link.resolvedPath === undefined || link.resolvedPath === note.path) continue

      const entry: VaultBacklink = { from: note.path, link }
      const existing = backlinks.get(link.resolvedPath)
      if (existing === undefined) backlinks.set(link.resolvedPath, [entry])
      else existing.push(entry)
    }
  }

  const tags = new Map<string, string[]>()
  for (const note of notes) {
    for (const tag of note.tags) {
      const existing = tags.get(tag)
      if (existing === undefined) tags.set(tag, [note.path])
      else existing.push(note.path)
    }
  }

  return {
    notes,
    byPath,
    bySlug,
    backlinks,
    tags,
    tree: buildTree(notes),
    resolve(target: string, fromPath: string): VaultNote | undefined {
      const resolvedPath = resolveLinkPath(target, fromPath, allPaths)
      return resolvedPath !== undefined ? byPath.get(resolvedPath) : undefined
    },
  }
}
