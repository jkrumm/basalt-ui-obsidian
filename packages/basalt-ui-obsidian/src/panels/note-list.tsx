/**
 * `NoteRow` / `NoteList` — the shared row primitive every panel in `src/panels/` renders through.
 * Every navigable row is built from `hrefFor(note)` + `renderLink(href, children)` (`useVault()`),
 * never an onClick-only div — same contract `vault-nav.tsx` follows, so cmd-click / open-in-new-tab
 * work identically everywhere in this package. The wrapping row still carries its own `onClick`
 * (calling `onNavigate`) for the same reason `VaultNavRow`'s note case does: `VaultLinkRenderer`'s
 * signature (`context.tsx`) hands back a consumer-owned element this file cannot attach further
 * props to, so a click-tracking callback has nowhere to land except a wrapping element.
 *
 * Every row is single-line (`panel.module.css`'s `.row`, `min-height: 28px`/`32px` coarse),
 * including the folder — see `.folderPath`'s own doc for why that reads inline after the title
 * rather than on a second line, and how the two share the row's width.
 */
import type { ReactNode } from 'react'
import type { VaultNote } from 'obsidian-vault-core'
import { VX } from 'basalt-ui/tokens'
import { useVault } from '../context.js'
import { folderPath } from '../nav/use-vault-search.js'
import classes from './panel.module.css'

export type NoteRowProps = {
  readonly note: VaultNote
  readonly active?: boolean
  /** Right-aligned, dimmed — a relative time, a note count, whatever the panel wants to show. */
  readonly meta?: ReactNode
  readonly onNavigate?: () => void
}

export function NoteRow({ note, active = false, meta, onNavigate }: NoteRowProps) {
  const { hrefFor, renderLink } = useVault()
  const folder = folderPath(note.path)
  // Resolves the same way `VaultNavRow`'s resting/active/hover color does (`vault-nav.tsx`) —
  // `--vault-panel-hover-ink` is `panel.module.css`'s own copy of that same trick.
  const titleColor = active ? VX.ink : `var(--vault-panel-hover-ink, ${VX.ink2})`

  return (
    <div
      role="listitem"
      data-active={active || undefined}
      className={classes.row}
      onClick={onNavigate}
    >
      <div className={`${classes.anchorReset} ${classes.grow}`}>
        {renderLink(
          hrefFor(note),
          <span className={classes.rowLabelLine}>
            <span
              className={folder === '' ? classes.title : `${classes.title} ${classes.titleShrink}`}
              style={{ color: titleColor, fontWeight: active ? 600 : 400 }}
            >
              {note.title}
            </span>
            {folder !== '' && <span className={classes.folderPath}>{folder}</span>}
          </span>,
        )}
      </div>
      {meta !== undefined && <span className={classes.meta}>{meta}</span>}
    </div>
  )
}

export type NoteListProps = {
  readonly notes: readonly VaultNote[]
  readonly activePath?: string
  readonly onNavigate?: () => void
  /** Per-note right-aligned meta — a relative time (`recent-panel.tsx`), a tag's note count, … */
  readonly metaFor?: (note: VaultNote) => ReactNode
  /** Default: `'No notes.'` */
  readonly emptyLabel?: string
}

/** `role="list"` over `NoteRow`s — empty state is a quiet centered dimmed line, not basalt's
 * `EmptyState` (too heavy inside a sidebar). */
export function NoteList({
  notes,
  activePath,
  onNavigate,
  metaFor,
  emptyLabel = 'No notes.',
}: NoteListProps) {
  if (notes.length === 0) {
    return <div className={classes.emptyLabel}>{emptyLabel}</div>
  }

  return (
    <div role="list">
      {notes.map((note) => (
        <NoteRow
          key={note.path}
          note={note}
          active={note.path === activePath}
          {...(onNavigate !== undefined && { onNavigate })}
          {...(metaFor !== undefined && { meta: metaFor(note) })}
        />
      ))}
    </div>
  )
}
