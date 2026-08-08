/**
 * Backlinks — the "Linked mentions" panel (Obsidian's own term for its backlinks pane), grouped
 * by source note. `VaultIndex.backlinks` can carry more than one link from the same source (e.g.
 * two `[[Target|alias]]` occurrences in one note), so entries are grouped by `from` first; each
 * link's alias (when it has one) is listed under the source note's own link.
 */
import { Box, Stack, Text } from '@mantine/core'
import type { VaultBacklink } from 'obsidian-vault-core'
import { useVault } from '../context.js'

export type BacklinksProps = {
  readonly path: string
  readonly title?: string
  readonly className?: string
}

/** Groups backlinks by their source note path, preserving first-seen order. */
function groupBySource(
  backlinks: readonly VaultBacklink[],
): ReadonlyMap<string, readonly VaultBacklink[]> {
  const groups = new Map<string, VaultBacklink[]>()
  for (const backlink of backlinks) {
    const group = groups.get(backlink.from)
    if (group === undefined) groups.set(backlink.from, [backlink])
    else group.push(backlink)
  }
  return groups
}

export function Backlinks({ path, title = 'Linked mentions', className }: BacklinksProps) {
  const { index, hrefFor, renderLink } = useVault()
  const backlinks = index.backlinks.get(path) ?? []

  if (backlinks.length === 0) return null

  const groups = groupBySource(backlinks)

  return (
    <Box {...(className !== undefined && { className })}>
      <Text size="sm" fw={600} mb="xs">
        {title}
      </Text>
      <Stack gap="sm">
        {[...groups].map(([from, links]) => {
          const source = index.byPath.get(from)
          if (source === undefined) return null
          const aliases = links
            .map((backlink) => backlink.link.alias)
            .filter((alias): alias is string => alias !== undefined)

          return (
            <Box key={from}>
              {renderLink(hrefFor(source), <Text size="sm">{source.title}</Text>)}
              {aliases.length > 0 && (
                <Stack gap={0} pl="md">
                  {aliases.map((alias) => (
                    <Text key={alias} size="xs" c="dimmed">
                      {alias}
                    </Text>
                  ))}
                </Stack>
              )}
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
