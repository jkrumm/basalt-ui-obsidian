import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import type { VaultIndex, VaultNote } from 'obsidian-vault-core'

import { VaultProvider } from '../src/context.js'
import { NoteView } from '../src/render/note-view.js'

function makeIndex(notes: readonly VaultNote[]): VaultIndex {
  return {
    notes,
    byPath: new Map(notes.map((note) => [note.path, note])),
    bySlug: new Map(notes.map((note) => [note.slug, note])),
    backlinks: new Map(),
    tags: new Map(),
    tree: { name: '', path: '', kind: 'folder', children: [] },
    resolve: () => undefined,
  }
}

const NOTE: VaultNote = {
  path: 'wiki/example.md',
  slug: 'wiki/example',
  basename: 'example',
  title: 'Example Note',
  frontmatter: { description: 'A short description.', date: '2026-01-05' },
  body: '## Heading\n\nSome body text.\n',
  headings: [{ depth: 2, text: 'Heading', slug: 'heading' }],
  links: [],
  tags: [],
}

describe('NoteView', () => {
  test('renders the note title, description, and markdown body', async () => {
    render(
      <MantineProvider>
        <VaultProvider index={makeIndex([NOTE])}>
          <NoteView note={NOTE} />
        </VaultProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Example Note')).toBeDefined()
    expect(screen.getByText('A short description.')).toBeDefined()
    expect(await screen.findByText('Some body text.')).toBeDefined()
  })

  test('narrows the article measure to 68ch', async () => {
    render(
      <MantineProvider>
        <VaultProvider index={makeIndex([NOTE])}>
          <NoteView note={NOTE} />
        </VaultProvider>
      </MantineProvider>,
    )

    const title = await screen.findByText('Example Note')
    const root = title.closest<HTMLElement>('[style*="--vx-prose-measure"]')
    expect(root?.style.getPropertyValue('--vx-prose-measure')).toBe('68ch')
  })

  test('a note without frontmatter description/date omits the meta row', () => {
    const bare: VaultNote = { ...NOTE, frontmatter: {} }
    render(
      <MantineProvider>
        <VaultProvider index={makeIndex([bare])}>
          <NoteView note={bare} />
        </VaultProvider>
      </MantineProvider>,
    )

    expect(screen.queryByText('A short description.')).toBeNull()
  })
})

describe('NoteView — duplicate leading heading', () => {
  test('suppresses a body H1 that duplicates the note title', async () => {
    const note: VaultNote = {
      ...NOTE,
      title: 'Engineering (wiki)',
      body: '# Engineering (wiki)\n\nBody text under the duplicate heading.\n',
    }
    const { container } = render(
      <MantineProvider>
        <VaultProvider index={makeIndex([note])}>
          <NoteView note={note} />
        </VaultProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Body text under the duplicate heading.')).toBeDefined()
    // `ArticleLayout`'s own meta header renders the title once — the body's own duplicate must not
    // add a second `<h1>`.
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  })

  test('suppresses a duplicate H1 even when it opens with an inline icon image', async () => {
    const note: VaultNote = {
      ...NOTE,
      title: 'Shyvana',
      body: '# ![icon](https://img.example.com/shyvana.png) Shyvana\n\nJungle champion.\n',
    }
    const { container } = render(
      <MantineProvider>
        <VaultProvider index={makeIndex([note])}>
          <NoteView note={note} />
        </VaultProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Jungle champion.')).toBeDefined()
    expect(container.querySelectorAll('h1')).toHaveLength(1)
  })

  test('keeps a leading H1 that does NOT match the note title', async () => {
    const note: VaultNote = {
      ...NOTE,
      title: 'Example Note',
      body: '# A Different Heading\n\nBody text.\n',
    }
    const { container } = render(
      <MantineProvider>
        <VaultProvider index={makeIndex([note])}>
          <NoteView note={note} />
        </VaultProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('A Different Heading')).toBeDefined()
    // One from `ArticleLayout`'s meta header, one from the body's own (non-duplicate) heading.
    expect(container.querySelectorAll('h1')).toHaveLength(2)
  })
})
