import { describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { VaultIndex } from 'obsidian-vault-core'
import { VaultProvider } from '../src/context.js'
import { TagIndex } from '../src/nav/tag-index.js'

function buildIndex(tags: VaultIndex['tags']): VaultIndex {
  return {
    notes: [],
    byPath: new Map(),
    bySlug: new Map(),
    backlinks: new Map(),
    tags,
    tree: { name: '', path: '', kind: 'folder', children: [] },
    resolve: () => undefined,
  }
}

describe('TagIndex', () => {
  test('renders nothing when the vault has no tags', () => {
    const index = buildIndex(new Map())
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <TagIndex />
        </VaultProvider>
      </MantineProvider>,
    )
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  test('renders each tag with its note count, sorted alphabetically', () => {
    const index = buildIndex(
      new Map([
        ['peptides', ['a.md', 'b.md']],
        ['fitness', ['c.md']],
      ]),
    )
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <TagIndex />
        </VaultProvider>
      </MantineProvider>,
    )

    const labels = screen.getAllByText(/^#/).map((el) => el.textContent)
    expect(labels[0]).toContain('fitness')
    expect(labels[1]).toContain('peptides')
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
  })

  test('calls onSelect with the clicked tag', () => {
    const index = buildIndex(new Map([['peptides', ['a.md']]]))
    const selected: string[] = []
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <TagIndex onSelect={(tag) => selected.push(tag)} />
        </VaultProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('checkbox'))
    expect(selected).toEqual(['peptides'])
  })

  test('marks the selected tag checked', () => {
    const index = buildIndex(new Map([['peptides', ['a.md']]]))
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <TagIndex selected="peptides" />
        </VaultProvider>
      </MantineProvider>,
    )

    const input = screen.getByRole('checkbox')
    expect((input as HTMLInputElement).checked).toBe(true)
  })
})
