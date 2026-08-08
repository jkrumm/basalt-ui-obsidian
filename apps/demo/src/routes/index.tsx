/**
 * Vault index route — the landing page. Composes two existing basalt-ui-obsidian/basalt-ui
 * primitives rather than inventing new visual vocabulary: `TagIndex` (browse by tag, filtering the
 * list below) and `ArticleCard`/`ArticleGrid` (basalt-ui/content) for the notes themselves, grouped
 * by their top-level vault folder ("area") and sorted alphabetically within each — `VaultNote`
 * carries no modified-time field, so "most recently modified" isn't data this route has access to.
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Stack, Text, Title } from '@mantine/core'
import { ArticleCard, ArticleGrid } from 'basalt-ui/content'
import type { ArticleNavTarget } from 'basalt-ui/content'
import { TagIndex, useVault } from 'basalt-ui-obsidian'
import type { VaultNote } from 'obsidian-vault-core'

/** The vault-relative path's top-level folder — the coarse "area" grouping for the landing grid. */
function areaOf(note: VaultNote): string {
  const slash = note.path.indexOf('/')
  return slash === -1 ? 'Notes' : note.path.slice(0, slash)
}

/** Groups notes by `areaOf`, each group sorted alphabetically by title (case-insensitive). */
function groupByArea(notes: readonly VaultNote[]): ReadonlyMap<string, readonly VaultNote[]> {
  const groups = new Map<string, VaultNote[]>()
  for (const note of notes) {
    const area = areaOf(note)
    const group = groups.get(area)
    if (group === undefined) groups.set(area, [note])
    else group.push(note)
  }
  for (const group of groups.values()) group.sort((a, b) => a.title.localeCompare(b.title))
  return groups
}

function renderNoteLink(target: ArticleNavTarget, node: ReactNode) {
  return <Link to={target.href as never}>{node}</Link>
}

function IndexPage() {
  const { index, hrefFor } = useVault()
  const [selectedTag, setSelectedTag] = useState<string | undefined>()

  const notes = useMemo(() => {
    if (selectedTag === undefined) return index.notes
    const paths = index.tags.get(selectedTag) ?? []
    return paths
      .map((path) => index.byPath.get(path))
      .filter((note): note is VaultNote => note !== undefined)
  }, [index, selectedTag])

  const areas = useMemo(
    () => [...groupByArea(notes)].toSorted(([a], [b]) => a.localeCompare(b)),
    [notes],
  )

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={1}>Brain</Title>
        <Text c="dimmed">{index.notes.length} notes. Press ⌘K to search.</Text>
      </Stack>

      <TagIndex
        {...(selectedTag !== undefined && { selected: selectedTag })}
        onSelect={(tag) => setSelectedTag((prev) => (prev === tag ? undefined : tag))}
      />

      {areas.map(([area, areaNotes]) => (
        <Stack key={area} gap="sm">
          <Title order={2}>{area}</Title>
          <ArticleGrid>
            {areaNotes.map((note) => {
              const description = note.frontmatter['description']
              return (
                <ArticleCard
                  key={note.path}
                  title={note.title}
                  {...(typeof description === 'string' && { description })}
                  href={hrefFor(note)}
                  renderLink={renderNoteLink}
                />
              )
            })}
          </ArticleGrid>
        </Stack>
      ))}
    </Stack>
  )
}

export const Route = createFileRoute('/')({ component: IndexPage })
