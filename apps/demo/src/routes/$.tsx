/**
 * Note route — matches any vault-relative slug via a splat param (`_splat`), since slugs contain
 * `/`, spaces, and umlauts (e.g. `Areas/Health/Ernährungsplan`) that a single dynamic segment can't
 * carry. `hrefFor` in `routes/__root.tsx` builds `/${note.slug}` verbatim to match this route.
 */
import { useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ActionIcon, Group, Stack, Text } from '@mantine/core'
import { EmptyState, PageActions } from 'basalt-ui'
import { Backlinks, NoteView, useVault } from 'basalt-ui-obsidian'
import type { VaultNote } from 'obsidian-vault-core'

/** Back-to-home affordance — mobile only, matches the shell's inline-glyph convention. */
function IconBack() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6l6 6" />
    </svg>
  )
}

// The vault carries no language field, so `document.documentElement.lang` is inferred rather than
// read from data: a cheap German/English heuristic over the title + body, not a real language
// detector. Diacritics are a strong signal on their own; the stopword count catches German prose
// that happens to carry none (e.g. a title-only umlaut-free page). Good enough to fix `lang` for
// the vault's German notes (e.g. `Areas/Health/Ernährungsplan`) without a new dependency.
const GERMAN_STOPWORD_RE =
  /\b(und|der|die|das|nicht|mit|ist|für|auf|eine|ein|den|des|sich|auch)\b/gi

/** Density, not a raw count: an absolute threshold of 3 marked English notes German, because a
 * long note picks up three stray hits by chance — "die cast", a quoted German product name, an
 * umlaut in someone's surname. German prose runs far denser than that, so the ratio separates the
 * two cleanly where a count cannot. The floor keeps a two-word note from tripping on one hit. */
const GERMAN_MIN_RATIO = 0.04
const GERMAN_MIN_HITS = 5

function detectLang(note: VaultNote): 'de' | 'en' {
  // Code is stripped first: fenced blocks and inline spans carry identifiers, URLs and config keys
  // that match the stopword pattern without being prose in any language.
  const text = `${note.title} ${note.body}`
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
  const words = text.split(/\s+/).filter(Boolean).length
  if (words === 0) return DEFAULT_LANG
  const hits = (text.match(/[äöüßÄÖÜ]/g)?.length ?? 0) + (text.match(GERMAN_STOPWORD_RE)?.length ?? 0)
  return hits >= GERMAN_MIN_HITS && hits / words >= GERMAN_MIN_RATIO ? 'de' : 'en'
}

const DEFAULT_TITLE = 'Brain — Vault Reader'
const DEFAULT_LANG = 'en'

function NotePage() {
  const { _splat: slug } = Route.useParams()
  const { index } = useVault()
  const note = slug !== undefined ? index.bySlug.get(slug) : undefined

  // `document.title`/`lang` are global DOM state, not React-owned — set them imperatively on
  // mount/note-change and restore the app default on unmount (leaving the note route, e.g. back to
  // `/`) rather than leaving the last note's title/language stuck in the tab, the history entry,
  // and the iOS home-screen app switcher.
  useEffect(() => {
    if (!note) return
    document.title = `${note.title} — Brain`
    document.documentElement.lang = detectLang(note)
    return () => {
      document.title = DEFAULT_TITLE
      document.documentElement.lang = DEFAULT_LANG
    }
  }, [note])

  if (!note) {
    return <EmptyState title="Note not found" description={`No note at "${slug ?? ''}".`} />
  }

  return (
    <Stack gap="xl">
      <PageActions>
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <ActionIcon
            component={Link}
            to="/"
            hiddenFrom="sm"
            variant="subtle"
            size="lg"
            aria-label="Back to vault home"
          >
            <IconBack />
          </ActionIcon>
          <Text fw={600} truncate style={{ minWidth: 0 }}>
            {note.title}
          </Text>
        </Group>
      </PageActions>
      <NoteView note={note} />
      <Backlinks path={note.path} />
    </Stack>
  )
}

export const Route = createFileRoute('/$')({ component: NotePage })
