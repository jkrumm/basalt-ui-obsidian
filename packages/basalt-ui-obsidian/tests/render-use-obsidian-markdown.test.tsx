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
