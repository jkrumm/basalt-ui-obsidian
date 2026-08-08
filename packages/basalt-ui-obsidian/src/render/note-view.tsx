/**
 * `NoteView` — renders one `VaultNote`: basalt-ui's `<ArticleLayout>` (title/description/date meta,
 * TOC on by default) wrapping `<Markdown>` fed by `useObsidianMarkdown`. Pure composition — no new
 * visual vocabulary, everything visual stays basalt-ui's.
 */
import { ArticleLayout, Markdown } from 'basalt-ui/content'
import type { ArticleLayoutMeta } from 'basalt-ui/content'
import type { VaultNote } from 'obsidian-vault-core'

import { useObsidianMarkdown } from './use-obsidian-markdown.js'

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

export function NoteView({ note, toc, readingProgress }: NoteViewProps) {
  const markdownProps = useObsidianMarkdown({ path: note.path })

  return (
    <ArticleLayout
      meta={noteMeta(note)}
      {...(toc !== undefined && { toc })}
      {...(readingProgress !== undefined && { readingProgress })}
    >
      <Markdown {...markdownProps}>{note.body}</Markdown>
    </ArticleLayout>
  )
}
