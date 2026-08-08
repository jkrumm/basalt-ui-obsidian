import { describe, expect, test } from 'bun:test'
import { render, renderHook, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { Markdown } from 'basalt-ui/content'
import type { ReactNode } from 'react'
import type { VaultIndex, VaultNote } from 'obsidian-vault-core'

import { VaultProvider } from '../src/context.js'
import { useObsidianMarkdown } from '../src/render/use-obsidian-markdown.js'

const SKIN_NOTE: VaultNote = {
  path: 'Ernährungsplan.md',
  slug: 'Ernährungsplan',
  basename: 'Ernährungsplan',
  title: 'Ernährungsplan',
  frontmatter: {},
  body: '',
  headings: [{ depth: 2, text: 'Hinweise für klare Haut', slug: 'hinweise-fuer-klare-haut' }],
  links: [],
  tags: [],
}

function makeIndex(): VaultIndex {
  return {
    notes: [SKIN_NOTE],
    byPath: new Map([[SKIN_NOTE.path, SKIN_NOTE]]),
    bySlug: new Map([[SKIN_NOTE.slug, SKIN_NOTE]]),
    backlinks: new Map(),
    tags: new Map(),
    tree: { name: '', path: '', kind: 'folder', children: [] },
    resolve: (target) => (target === 'Ernährungsplan' ? SKIN_NOTE : undefined),
  }
}

// Built once at module scope, not per render — `VaultProvider` memoizes its context value on
// `[index, hrefFor, renderLink]`, so a `Wrapper` that rebuilt the index on every render would make
// `resolveWikilink` (and everything downstream of it) unstable for reasons that have nothing to do
// with `useObsidianMarkdown` itself.
const INDEX = makeIndex()

function Wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <MantineProvider>
      <VaultProvider index={INDEX}>{children}</VaultProvider>
    </MantineProvider>
  )
}

function Harness({ markdown }: { readonly markdown: string }) {
  const props = useObsidianMarkdown({ path: 'index.md' })
  return <Markdown {...props}>{markdown}</Markdown>
}

const MARKDOWN = `> [!info]- Karabiner setup — per machine, do this on every Mac
> body

![\\|56](https://img.jkrumm.com/rs:fit:144/f:png/x.png)

See [[Ernährungsplan#Hinweise für klare Haut|the skin section]] and [[No Such Note]].
`

describe('useObsidianMarkdown', () => {
  test('renders callout, sized image, resolved wikilink, and a dead wikilink as plain text', async () => {
    const { container } = render(
      <Wrapper>
        <Harness markdown={MARKDOWN} />
      </Wrapper>,
    )

    // Callout — the marker is stripped and the title renders through basalt's `Callout`.
    const title = await screen.findByText('Karabiner setup — per machine, do this on every Mac')
    expect(title).toBeDefined()

    // Size hint — `width` from `remarkObsidianImageSize`, alt cleared. `alt=""` makes this a
    // decorative image per ARIA (no implicit `img` role), so it's found by tag, not role.
    const img = await within(container).findByRole('presentation')
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('width')).toBe('56')
    expect(img.getAttribute('alt')).toBe('')

    // Resolved wikilink — href came from `hrefFor` (the default: `/${slug}#${headingSlug}`).
    // `mdast-util-to-hast` percent-encodes the URL, hence the decode before comparing.
    const link = await screen.findByRole('link', { name: 'the skin section' })
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toBe(
      '/Ernährungsplan#hinweise-fuer-klare-haut',
    )

    // Dead wikilink — plain text, no anchor.
    expect(container.textContent).toContain('No Such Note')
    expect(within(container).queryByRole('link', { name: 'No Such Note' })).toBeNull()
  })
})

describe('useObsidianMarkdown — table cells and inline icons', () => {
  test('table cells get normal word-boundary wrapping, not the prose default', async () => {
    const table = '| Second | Boots |\n| --- | --- |\n| a | b |\n'
    const { container } = render(
      <Wrapper>
        <Harness markdown={table} />
      </Wrapper>,
    )

    const cell = await within(container).findByText('Second')
    expect(cell.style.overflowWrap).toBe('normal')
    expect(cell.style.wordBreak).toBe('normal')
  })

  test('an icon-sized image (<=64px width hint) sits inline on the text baseline', async () => {
    const markdown = 'before ![\\|32](https://img.example.com/icon.png) after\n'
    const { container } = render(
      <Wrapper>
        <Harness markdown={markdown} />
      </Wrapper>,
    )

    const img = await within(container).findByRole('presentation')
    expect(img.style.verticalAlign).toBe('middle')
    expect(img.style.display).not.toBe('block')
  })

  test('an unsized image renders as a block, not an inline icon', async () => {
    const markdown = '![a standalone screenshot](https://img.example.com/full.png)\n'
    const { container } = render(
      <Wrapper>
        <Harness markdown={markdown} />
      </Wrapper>,
    )

    const img = container.querySelector('img')
    expect(img?.style.display).toBe('block')
    expect(img?.style.verticalAlign).toBe('')
  })
})

describe('useObsidianMarkdown — folded callout', () => {
  test('a fold marker renders a collapsible <details>, closed by default, with a single title', async () => {
    const markdown = '> [!warning]- Careful here\n> body text\n'
    const { container } = render(
      <Wrapper>
        <Harness markdown={markdown} />
      </Wrapper>,
    )

    await screen.findByText('Careful here')
    expect(container.querySelector('details')?.open).toBe(false)
    expect(within(container).getAllByText('Careful here')).toHaveLength(1)
  })

  test('`[!type]+` starts open', async () => {
    const markdown = '> [!tip]+ Always open\n> body text\n'
    const { container } = render(
      <Wrapper>
        <Harness markdown={markdown} />
      </Wrapper>,
    )

    await screen.findByText('Always open')
    expect(container.querySelector('details')?.open).toBe(true)
  })

  test('no fold marker stays a plain, non-collapsible callout', async () => {
    const markdown = '> [!info] Plain callout\n> body text\n'
    const { container } = render(
      <Wrapper>
        <Harness markdown={markdown} />
      </Wrapper>,
    )

    await screen.findByText('Plain callout')
    expect(container.querySelector('details')).toBeNull()
  })
})

describe('useObsidianMarkdown — dataview fence', () => {
  test('renders a labelled, inert block instead of a raw code block with a copy button', async () => {
    const markdown = '```dataview\nTABLE file.mtime FROM "Projects"\n```\n'
    const { container } = render(
      <Wrapper>
        <Harness markdown={markdown} />
      </Wrapper>,
    )

    expect(await screen.findByText('Dataview query (not evaluated)')).toBeDefined()
    expect(container.textContent).toContain('TABLE file.mtime FROM "Projects"')
    expect(container.querySelector('pre code')).toBeNull()
    expect(within(container).queryByRole('button')).toBeNull()
  })
})

describe('useObsidianMarkdown — task list', () => {
  test('checkboxes render as non-interactive glyphs, not native inputs', async () => {
    const markdown = '- [x] Done thing\n- [ ] Pending thing\n'
    const { container } = render(
      <Wrapper>
        <Harness markdown={markdown} />
      </Wrapper>,
    )

    expect(await within(container).findByRole('img', { name: 'checked' })).toBeDefined()
    expect(within(container).getByRole('img', { name: 'unchecked' })).toBeDefined()
    expect(container.querySelector('input[type="checkbox"]')).toBeNull()

    for (const item of container.querySelectorAll('li')) {
      expect((item as HTMLElement).style.listStyleType).toBe('none')
    }
  })
})

describe('useObsidianMarkdown — referential stability', () => {
  test('remarkPlugins/components/sanitizeSchema stay referentially stable across an unrelated re-render', () => {
    const { result, rerender } = renderHook(() => useObsidianMarkdown({ path: 'index.md' }), {
      wrapper: Wrapper,
    })

    const first = result.current
    rerender()
    const second = result.current

    expect(second.remarkPlugins).toBe(first.remarkPlugins)
    expect(second.components).toBe(first.components)
    expect(second.sanitizeSchema).toBe(first.sanitizeSchema)
  })

  test('a changed `path` produces a new `remarkPlugins` but keeps `components` stable', () => {
    const { result, rerender } = renderHook(
      ({ path }: { path: string }) => useObsidianMarkdown({ path }),
      { wrapper: Wrapper, initialProps: { path: 'index.md' } },
    )

    const first = result.current
    rerender({ path: 'other.md' })
    const second = result.current

    expect(second.remarkPlugins).not.toBe(first.remarkPlugins)
    expect(second.components).toBe(first.components)
  })
})
