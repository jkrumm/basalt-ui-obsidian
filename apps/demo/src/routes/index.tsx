/**
 * Vault index route — the landing page. Leads with the vault's own STRUCTURE (`VaultIndex.tree`'s
 * top-level folders, each an `ArticleCard` tile carrying its note count) as the primary overview —
 * "where is everything" — with a real tappable search trigger above it and the full note grid
 * (grouped by top-level folder, same grouping the structure tiles jump-link into) below. Tags are
 * demoted to the bottom, capped to the most-used ones by default: a landing page is not the place
 * for 40+ alphabetical chips, most used exactly once.
 *
 * Composes existing basalt-ui/basalt-ui-obsidian primitives rather than inventing new visual
 * vocabulary: `SidebarSearch` (the shell's own search trigger, reused standalone here),
 * `ArticleCard`/`ArticleGrid` (basalt-ui/content) for both the structure tiles and the notes
 * themselves, and `TagIndex` (browse-by-tag, filtering the note grid below) demoted under a
 * "Show all" toggle.
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { SimpleGrid, Stack, Text, Title, UnstyledButton, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { ArticleCard, ArticleGrid } from 'basalt-ui/content'
import type { ArticleNavTarget } from 'basalt-ui/content'
import { SidebarSearch } from 'basalt-ui'
import { TagIndex, useVault } from 'basalt-ui-obsidian'
import type { VaultNote, VaultTreeNode } from 'obsidian-vault-core'
import { openVaultSearch } from '../lib/vault-search-spotlight'

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

/** Recursively counts `kind: 'note'` leaves under a tree node — a top-level folder's total note
 * count, regardless of how deep its own subfolders nest. Exported for direct unit testing, same
 * reasoning as `vault-search-spotlight.tsx`'s exported pure helpers: no router/DOM needed to verify
 * the vault-structure derivation the home view's "structure" section reads from. */
export function countNotes(node: VaultTreeNode): number {
  if (node.kind === 'note') return 1
  return (node.children ?? []).reduce((sum, child) => sum + countNotes(child), 0)
}

/** A same-page jump target for an area's `<Title>` below — non-alphanumeric characters replaced so
 * every top-level folder name (today: `Areas`, `Projects`, `wiki`, `Inbox`) yields a valid `id`. */
export function areaAnchorId(area: string): string {
  return `area-${area.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

/** Clears the sticky mobile/desktop shell header before a same-page `#area-…` jump lands a heading
 * right under it — reads `--app-shell-header-offset` live, so it tracks whichever breakpoint's
 * header height is active (see `apps/demo/src/styles/mobile-density.css`'s mobile override) instead
 * of assuming one. */
const AREA_HEADING_STYLE = {
  scrollMarginTop: 'calc(var(--app-shell-header-offset, 0px) + var(--mantine-spacing-sm))',
}

const DEFAULT_TAG_LIMIT = 12

function renderNoteLink(target: ArticleNavTarget, node: ReactNode) {
  return <Link to={target.href as never}>{node}</Link>
}

function IndexPage() {
  const { index, hrefFor } = useVault()
  const [selectedTag, setSelectedTag] = useState<string | undefined>()
  const [showAllTags, setShowAllTags] = useState(false)

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

  // The vault's own structure, straight off `VaultIndex.tree` (not re-derived from the flat note
  // list) — top-level folders only, each with a recursive note count. Root-level loose notes (a
  // `kind: 'note'` child of the tree root, if the vault ever has one) have no folder to tile, so
  // they're left to the "Notes" bucket `groupByArea` already produces below.
  const structure = useMemo(
    () =>
      (index.tree.children ?? [])
        .filter((node) => node.kind === 'folder')
        .map((node) => ({ name: node.name, count: countNotes(node) }))
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    [index.tree],
  )

  const tagCount = index.tags.size

  // `Stack.gap` has no responsive-object form at the type level (see `routes/$.tsx`'s matching
  // comment) — a JS breakpoint check instead.
  const theme = useMantineTheme()
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`, undefined, {
    getInitialValueInEffect: false,
  })

  return (
    <Stack gap={isMobile ? 'md' : 'xl'}>
      <Stack gap={4}>
        <Title order={1}>Brain</Title>
        <Text c="dimmed" size="sm">
          {index.notes.length} notes
        </Text>
      </Stack>

      {/* A real tappable control on mobile, not a keyboard-shortcut hint — `SidebarSearch` already
          renders its `⌘K`/`Ctrl K` hint as a `<Kbd>` (a `<kbd>` element), which `safe-area.css`'s
          existing `@media (pointer: coarse) { kbd { display: none } }` rule already hides on a
          touch device with no physical keyboard — no extra media query needed here. */}
      <SidebarSearch onOpen={openVaultSearch} placeholder="Search the vault…" />

      {structure.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {structure.map(({ name, count }) => (
            <ArticleCard
              key={name}
              title={name}
              description={`${count} ${count === 1 ? 'note' : 'notes'}`}
              href={`#${areaAnchorId(name)}`}
            />
          ))}
        </SimpleGrid>
      )}

      {areas.map(([area, areaNotes]) => (
        <Stack key={area} gap="sm">
          <Title order={2} id={areaAnchorId(area)} style={AREA_HEADING_STYLE}>
            {area}
          </Title>
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

      {tagCount > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={600} c="dimmed">
            Tags
          </Text>
          <TagIndex
            {...(selectedTag !== undefined && { selected: selectedTag })}
            onSelect={(tag) => setSelectedTag((prev) => (prev === tag ? undefined : tag))}
            {...(!showAllTags && tagCount > DEFAULT_TAG_LIMIT && { limit: DEFAULT_TAG_LIMIT })}
          />
          {tagCount > DEFAULT_TAG_LIMIT && (
            <UnstyledButton type="button" onClick={() => setShowAllTags((prev) => !prev)}>
              <Text size="sm" c="dimmed" td="underline">
                {showAllTags ? 'Show fewer tags' : `Show all ${tagCount} tags`}
              </Text>
            </UnstyledButton>
          )}
        </Stack>
      )}
    </Stack>
  )
}

export const Route = createFileRoute('/')({ component: IndexPage })
