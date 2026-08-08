/**
 * TagIndex — `VaultIndex.tags` projected into a tappable tag list with per-tag note counts.
 * Selection is fully controlled by the consumer (`selected`/`onSelect`) — this component holds no
 * state of its own, matching the read-through-props idiom the rest of this package uses.
 */
import { Chip, Group, Text } from '@mantine/core'
import { useVault } from '../context.js'

export type TagIndexProps = {
  readonly selected?: string
  readonly onSelect?: (tag: string) => void
  readonly className?: string
  /**
   * Cap the rendered list to this many tags, ranked by note count (most-used first, ties broken
   * alphabetically) — a "top tags" summary rather than the full list, for a spot (e.g. a landing
   * page) where dozens of once-used tags would otherwise outweigh the content around them. Omitted
   * renders every tag, alphabetically (unchanged default).
   */
  readonly limit?: number
}

export function TagIndex({ selected, onSelect, className, limit }: TagIndexProps) {
  const { index } = useVault()
  const allTags = [...index.tags.entries()]
  const tags =
    limit === undefined
      ? allTags.toSorted(([a], [b]) => a.localeCompare(b))
      : allTags
          .toSorted(
            ([tagA, pathsA], [tagB, pathsB]) =>
              pathsB.length - pathsA.length || tagA.localeCompare(tagB),
          )
          .slice(0, limit)

  if (tags.length === 0) return null

  return (
    <Group gap="xs" role="list" {...(className !== undefined && { className })}>
      {tags.map(([tag, paths]) => (
        <Chip key={tag} size="md" checked={tag === selected} onChange={() => onSelect?.(tag)}>
          #{tag}{' '}
          <Text component="span" c="dimmed" size="xs">
            {paths.length}
          </Text>
        </Chip>
      ))}
    </Group>
  )
}
