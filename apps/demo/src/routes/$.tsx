/**
 * Note route — matches any vault-relative slug via a splat param (`_splat`), since slugs contain
 * `/`, spaces, and umlauts (e.g. `Areas/Health/Ernährungsplan`) that a single dynamic segment can't
 * carry. `hrefFor` in `routes/__root.tsx` builds `/${note.slug}` verbatim to match this route.
 */
import { createFileRoute } from '@tanstack/react-router'
import { Stack } from '@mantine/core'
import { EmptyState } from 'basalt-ui'
import { Backlinks, NoteView, useVault } from 'basalt-ui-obsidian'

function NotePage() {
  const { _splat: slug } = Route.useParams()
  const { index } = useVault()
  const note = slug !== undefined ? index.bySlug.get(slug) : undefined

  if (!note) {
    return <EmptyState title="Note not found" description={`No note at "${slug ?? ''}".`} />
  }

  return (
    <Stack gap="xl">
      <NoteView note={note} />
      <Backlinks path={note.path} />
    </Stack>
  )
}

export const Route = createFileRoute('/$')({ component: NotePage })
