import { describe, expect, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { VaultIndex, VaultLink, VaultNote } from 'obsidian-vault-core'
import { VaultProvider } from '../src/context.js'
import { Backlinks, extractBacklinkContext } from '../src/nav/backlinks.js'

function note(path: string, title?: string, body = ''): VaultNote {
  const basename = path.slice(path.lastIndexOf('/') + 1, -3)
  return {
    path,
    slug: path.slice(0, -3),
    basename,
    title: title ?? basename,
    frontmatter: {},
    body,
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

    // One title link plus one context line per source group — never one line per link.
    expect(screen.getAllByText('Health')).toHaveLength(2)
  })

  test("shows the surrounding sentence from the SOURCE note's own body, not the target's title", () => {
    const sourceLink = link('peptides/index', TARGET.path)
    const source: VaultNote = note(
      SOURCE_A.path,
      'Health',
      'Some unrelated opening sentence. See [[peptides/index]] for supplement notes. A trailing sentence.',
    )
    const index = buildIndex(
      [TARGET, source],
      new Map([[TARGET.path, [{ from: source.path, link: sourceLink }]]]),
    )
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <Backlinks path={TARGET.path} />
        </VaultProvider>
      </MantineProvider>,
    )

    // The wikilink flattens to its display text (basename, no alias given), same as a rendered
    // note body would show it — not the raw `[[peptides/index]]` syntax.
    expect(screen.getByText('See index for supplement notes.', { exact: false })).toBeDefined()
    // The old bug: every context line read as the CURRENT page's own display text.
    expect(screen.queryByText('Peptides')).toBeNull()
  })

  test("falls back to the source note's own title when the link cannot be located in its body", () => {
    const backlinks = new Map([
      [TARGET.path, [{ from: SOURCE_A.path, link: link('peptides/index', TARGET.path) }]],
    ])
    renderBacklinks(backlinks)

    // The title link plus its (fallback) context line both read "Health" — the fallback is the
    // SOURCE's own title, never the raw link/alias text.
    expect(screen.getAllByText('Health')).toHaveLength(2)
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

describe('extractBacklinkContext', () => {
  test('extracts the sentence containing the link, trimmed to a sentence boundary and stripped of markdown', () => {
    // Both paddings run well past the extractor's ±120-char window, so their marker words can
    // only show up in the result if the window (or its sentence-boundary trim) reaches too far.
    const farPrefix =
      'PREFIX_MARKER ' + 'padding '.repeat(20) + 'that ends this opening paragraph right here. '
    const farSuffix =
      ' This trailing paragraph exists purely to push the SUFFIX_MARKER well outside the window: ' +
      'padding '.repeat(20) +
      'so it never appears in the extracted context.'
    const body = `${farPrefix}The **bold** claim links to [[note|Note]] for proof.${farSuffix}`
    const testLink: VaultLink = {
      raw: '[[note|Note]]',
      target: 'note',
      alias: 'Note',
      embed: false,
    }

    const result = extractBacklinkContext(body, testLink)

    expect(result).toContain('The bold claim links to Note for proof.')
    expect(result).not.toContain('PREFIX_MARKER')
    expect(result).not.toContain('SUFFIX_MARKER')
    expect(result).not.toContain('**')
  })

  test('returns undefined when the raw link text cannot be located in the body', () => {
    const testLink: VaultLink = { raw: '[[missing]]', target: 'missing', embed: false }
    expect(
      extractBacklinkContext('This body never mentions that link at all.', testLink),
    ).toBeUndefined()
  })
})
