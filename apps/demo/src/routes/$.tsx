/**
 * Note route — matches any vault-relative slug via a splat param (`_splat`), since slugs contain
 * `/`, spaces, and umlauts (e.g. `Areas/Health/Ernährungsplan`) that a single dynamic segment can't
 * carry. `hrefFor` in `routes/__root.tsx` builds `/${note.slug}` verbatim to match this route.
 */
import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Stack, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { EmptyState } from 'basalt-ui'
import { Backlinks, NoteView, useVault } from 'basalt-ui-obsidian'
import type { VaultNote } from 'obsidian-vault-core'

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
  const text = `${note.title} ${note.body}`.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ')
  const words = text.split(/\s+/).filter(Boolean).length
  if (words === 0) return DEFAULT_LANG
  const hits =
    (text.match(/[äöüßÄÖÜ]/g)?.length ?? 0) + (text.match(GERMAN_STOPWORD_RE)?.length ?? 0)
  return hits >= GERMAN_MIN_HITS && hits / words >= GERMAN_MIN_RATIO ? 'de' : 'en'
}

const DEFAULT_TITLE = 'Brain — Vault Reader'
const DEFAULT_LANG = 'en'

function NotePage() {
  const { _splat: slug } = Route.useParams()
  const { index } = useVault()
  const note = slug !== undefined ? index.bySlug.get(slug) : undefined
  // `Stack.gap` has no responsive-object form at the type level — it's a bespoke component prop
  // wired straight to a `--stack-gap` inline style, not one of `Box`'s generic `StyleProp<T>` style
  // props (`p`/`m`/`w`/`h`/…, see `@mantine/core`'s `MantineStyleProps`). A JS breakpoint check is
  // the plain, type-safe alternative; `max-width`, not `min-width`, so the test harness's constant
  // `matchMedia` stub (`matches: false`) resolves to "not mobile" and keeps today's desktop value.
  const theme = useMantineTheme()
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`, undefined, {
    getInitialValueInEffect: false,
  })

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
    // `xl` (26px) is a desktop-tuned gap — same measure between the article and the backlinks
    // section on a 393px phone, where every px of vertical space is scarcer. `lg` (20px) below `sm`
    // keeps the gap present (the two still separate distinct regions) without the desktop's extra
    // breathing room; desktop is untouched.
    <Stack gap={isMobile ? 'lg' : 'xl'}>
      <NoteView note={note} />
      <Backlinks path={note.path} />
    </Stack>
  )
}

export const Route = createFileRoute('/$')({ component: NotePage })
