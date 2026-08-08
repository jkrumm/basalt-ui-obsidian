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
