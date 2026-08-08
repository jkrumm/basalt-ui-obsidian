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
}

export function TagIndex({ selected, onSelect, className }: TagIndexProps) {
  const { index } = useVault()
  const tags = [...index.tags.entries()].toSorted(([a], [b]) => a.localeCompare(b))

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
