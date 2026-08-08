/**
 * `NoteView` — renders one `VaultNote`: basalt-ui's `<ArticleLayout>` (title/description/date meta,
 * TOC on by default) wrapping `<Markdown>` fed by `useObsidianMarkdown`. Pure composition — no new
 * visual vocabulary, everything visual stays basalt-ui's.
 */
import type { CSSProperties } from 'react'
import { Text, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { ArticleLayout, Markdown } from 'basalt-ui/content'
import type { ArticleLayoutMeta } from 'basalt-ui/content'
import { VX } from 'basalt-ui/tokens'
import type { VaultNote } from 'obsidian-vault-core'

import { useObsidianMarkdown } from './use-obsidian-markdown.js'

/** Widens `--vx-text-md`'s param position, purely so the object literal below type-checks — csstype
 * has no generic `--${string}` index signature on `CSSProperties`, only its named properties. */
type CustomCSSProperties = Record<`--${string}`, string>

/**
 * Narrows basalt's 72ch default measure (`ArticleLayout`/`Prose` both key off this ONE token —
 * `article-layout.module.css`'s grid column AND `prose.module.css`'s own max-width). Canvas-measured
 * on three vault paragraphs at 16px/27.2px: 72ch actually renders 82–86 characters per line (`ch`
 * tracks the `0` glyph's advance width, not the font's real average character width), well past the
 * 60–75ch comfortable range. 68ch brings it back into range and — since the grid column shrinks with
 * it — frees the horizontal room the layout otherwise wasted.
 */
const PROSE_MEASURE_STYLE: CSSProperties & CustomCSSProperties = {
  '--vx-prose-measure': '68ch',
}

export type NoteViewProps = {
  readonly note: VaultNote
  /** Sticky scroll-spy TOC rail. Default `true` (via `ArticleLayout`'s own default). */
  readonly toc?: boolean
  /** Scroll-driven top progress bar. Default `false` (via `ArticleLayout`'s own default). */
  readonly readingProgress?: boolean
}

/** `frontmatter.date` may already be a native `Date` — the `yaml` parser resolves ISO date
 * scalars that way — so this normalizes both shapes to the ISO string `ArticleLayoutMeta.date`
 * wants. */
function frontmatterDate(frontmatter: VaultNote['frontmatter']): string | undefined {
  const raw = frontmatter['date']
  if (typeof raw === 'string') return raw
  if (raw instanceof Date) return raw.toISOString()
  return undefined
}

function noteMeta(note: VaultNote): ArticleLayoutMeta {
  const description = note.frontmatter['description']
  const date = frontmatterDate(note.frontmatter)
  return {
    title: note.title,
    ...(typeof description === 'string' && { description }),
    ...(date !== undefined && { date }),
  }
}

/** A leading Markdown inline image (`![alt](src)`), matched so it can be stripped from a heading's
 * text before comparing it to the note title — some notes prefix the H1 with an inline icon. */
const LEADING_IMAGE_RE = /^!\[[^\]]*\]\([^)]*\)\s*/

/** A body's leading ATX H1 line (`# …`), captured up to (excluding) its trailing newline. Only
 * matches at the very start of the string — a later `#`-heading mid-document is untouched, and
 * `## ` (or deeper) never matches since the space is required immediately after the single `#`. */
const LEADING_H1_RE = /^# +([^\n]*)\n?/

/** Trim, collapse internal whitespace, and lowercase — the same normalization on both sides of the
 * title comparison, so trivial formatting differences (extra spaces, case) don't defeat the match. */
function normalizeHeadingText(raw: string): string {
  return raw.replace(LEADING_IMAGE_RE, '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * `ArticleLayout` already renders `note.title` once, in its own meta header — when the body's own
 * first line is an identical H1 (optionally led by an inline icon image), Markdown would render it
 * a second time. Strips exactly that leading heading line (plus one following blank line) when its
 * normalized text matches the note title; otherwise returns `body` untouched, including when the
 * body opens with a DIFFERENT heading (H1 or otherwise) that isn't a duplicate.
 */
function stripDuplicateLeadingHeading(body: string, title: string): string {
  const withoutLeadingBlankLines = body.replace(/^\s*\n+/, '')
  const match = LEADING_H1_RE.exec(withoutLeadingBlankLines)
  if (match === null) return body
  const headingText = normalizeHeadingText(match[1] ?? '')
  if (headingText !== normalizeHeadingText(title)) return body
  return withoutLeadingBlankLines.slice(match[0].length).replace(/^\s*\n+/, '')
}

export function NoteView({ note, toc, readingProgress }: NoteViewProps) {
  const markdownProps = useObsidianMarkdown({ path: note.path })
  const body = stripDuplicateLeadingHeading(note.body, note.title)

  // `ArticleLayout`'s own meta header renders `note.title` a second time — on mobile the consuming
  // app's fixed shell header (`apps/demo/routes/$.tsx`'s `PageActions` back-button row) already
  // names the note, so the two stack ~30px apart with nothing between them but air. There is no
  // narrower prop on `ArticleLayout` to drop just the title while keeping `description`/`date` (its
  // header is one all-or-nothing `meta` block), and desktop has no such duplicate (no fixed-header
  // title there) plus the room to spare — so the fix is per-breakpoint: omit `meta` entirely below
  // `sm`, keep it in full at `sm` and up. `max-width` (not `min-width`) so the test-suite's constant
  // `matchMedia` stub (`matches: false`, `tests/setup/dom.ts`) resolves to "not mobile" and every
  // existing meta-rendering test keeps its current (desktop) behavior unchanged.
  const theme = useMantineTheme()
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`, undefined, {
    getInitialValueInEffect: false,
  })

  // Dropping the whole `meta` block on mobile also dropped `description` — the note's own one-line
  // summary, and the single most useful line on the page for someone arriving from search. Only the
  // TITLE duplicates the shell's fixed header; the description does not. `ArticleLayout`'s meta is
  // all-or-nothing, so render the description ourselves in that branch rather than losing it.
  const description = noteMeta(note).description

  return (
    <ArticleLayout
      {...(!isMobile && { meta: noteMeta(note) })}
      style={PROSE_MEASURE_STYLE}
      {...(toc !== undefined && { toc })}
      {...(readingProgress !== undefined && { readingProgress })}
    >
      {isMobile && description !== undefined && (
        <Text c={VX.muted} size="sm" mb="sm">
          {description}
        </Text>
      )}
      <Markdown {...markdownProps}>{body}</Markdown>
    </ArticleLayout>
  )
}
