import { describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { VaultIndex, VaultLink, VaultNote } from 'obsidian-vault-core'
import { VaultProvider } from '../src/context.js'
import { Backlinks } from '../src/nav/backlinks.js'

function note(path: string, title?: string): VaultNote {
  const basename = path.slice(path.lastIndexOf('/') + 1, -3)
  return {
    path,
    slug: path.slice(0, -3),
    basename,
    title: title ?? basename,
    frontmatter: {},
    body: '',
    headings: [],
    links: [],
    tags: [],
  }
}

function link(target: string, resolvedPath: string, alias?: string): VaultLink {
  return {
    raw: `[[${target}]]`,
    target,
    embed: false,
    resolvedPath,
    ...(alias !== undefined && { alias }),
  }
}

const TARGET = note('wiki/health/peptides/index.md', 'Peptides')
const SOURCE_A = note('wiki/health/index.md', 'Health')
const SOURCE_B = note('Areas/Training.md', 'Training')

function buildIndex(notes: readonly VaultNote[], backlinks: VaultIndex['backlinks']): VaultIndex {
  return {
    notes,
    byPath: new Map(notes.map((n) => [n.path, n])),
    bySlug: new Map(notes.map((n) => [n.slug, n])),
    backlinks,
    tags: new Map(),
    tree: { name: '', path: '', kind: 'folder', children: [] },
    resolve: () => undefined,
  }
}

function renderBacklinks(backlinks: VaultIndex['backlinks']) {
  const index = buildIndex([TARGET, SOURCE_A, SOURCE_B], backlinks)
  return render(
    <MantineProvider>
      <VaultProvider index={index}>
        <Backlinks path={TARGET.path} />
      </VaultProvider>
    </MantineProvider>,
  )
}

describe('Backlinks', () => {
  test('renders nothing when the note has no backlinks', () => {
    renderBacklinks(new Map())
    expect(screen.queryByText('Linked mentions')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('groups multiple links from the same source under one entry', () => {
    const backlinks = new Map([
      [
        TARGET.path,
        [
          { from: SOURCE_A.path, link: link('peptides/index', TARGET.path) },
          {
            from: SOURCE_A.path,
            link: link('peptides/index', TARGET.path, 'growth hormone peptides'),
          },
        ],
      ],
    ])
    renderBacklinks(backlinks)

    expect(screen.getAllByText('Health')).toHaveLength(1)
    expect(screen.getByText('growth hormone peptides')).toBeDefined()
  })

  test('lists each distinct source note once, linked to it', () => {
    const backlinks = new Map([
      [
        TARGET.path,
        [
          { from: SOURCE_A.path, link: link('peptides/index', TARGET.path) },
          { from: SOURCE_B.path, link: link('wiki/health/peptides/index', TARGET.path) },
        ],
      ],
    ])
    renderBacklinks(backlinks)

    const healthLink = screen.getByRole('link', { name: 'Health' })
    expect(healthLink.getAttribute('href')).toBe('/wiki/health/index')
    const trainingLink = screen.getByRole('link', { name: 'Training' })
    expect(trainingLink.getAttribute('href')).toBe('/Areas/Training')
  })
})
