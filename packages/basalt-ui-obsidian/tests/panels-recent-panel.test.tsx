/**
 * `VaultRecentPanel` — the one behavior worth a dedicated test is calendar-DAY bucketing across a
 * local-midnight boundary, since a naive `now - at < 24h` check gets exactly this case wrong: a note
 * touched late yesterday must land in "Yesterday" even when "now" is only a couple hours later, on
 * the other side of midnight.
 */
import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import type { VaultIndex, VaultNote } from 'obsidian-vault-core'
import { VaultProvider } from '../src/context.js'
import { metaFor, shortRelative, VaultRecentPanel } from '../src/panels/recent-panel.js'

function note(path: string, title: string, mtime: number): VaultNote {
  const basename = path.slice(path.lastIndexOf('/') + 1, -3)
  return {
    path,
    slug: path.slice(0, -3),
    basename,
    title,
    frontmatter: {},
    body: '',
    headings: [],
    links: [],
    tags: [],
    mtime,
  }
}

function buildIndex(notes: readonly VaultNote[]): VaultIndex {
  return {
    notes,
    byPath: new Map(notes.map((n) => [n.path, n])),
    bySlug: new Map(notes.map((n) => [n.slug, n])),
    backlinks: new Map(),
    tags: new Map(),
    tree: { name: '', path: '', kind: 'folder', children: [] },
    bookmarks: [],
    resolve: () => undefined,
  }
}

describe('VaultRecentPanel', () => {
  beforeEach(() => {
    setSystemTime()
  })

  afterEach(() => {
    setSystemTime()
  })

  test('buckets a note touched late yesterday into "Yesterday" even just after local midnight', () => {
    // "Now" is 01:00 local time — only 2 hours after the yesterday-late note's own mtime, but on the
    // OTHER side of a calendar-day boundary. A `now - at < 24h` bucketing rule would wrongly call
    // this "Today"; a calendar-day rule must not.
    setSystemTime(new Date(2024, 0, 15, 1, 0, 0))
    const yesterdayLate = note('a.md', 'Yesterday Late', new Date(2024, 0, 14, 23, 0, 0).getTime())
    const todayEarly = note('b.md', 'Today Early', new Date(2024, 0, 15, 0, 30, 0).getTime())

    const index = buildIndex([yesterdayLate, todayEarly])
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <VaultRecentPanel />
        </VaultProvider>
      </MantineProvider>,
    )

    const todayGroup = screen.getByText('Today').parentElement
    const yesterdayGroup = screen.getByText('Yesterday').parentElement
    expect(todayGroup).not.toBeNull()
    expect(yesterdayGroup).not.toBeNull()

    expect(within(todayGroup as HTMLElement).getByText('Today Early')).toBeDefined()
    expect(within(yesterdayGroup as HTMLElement).getByText('Yesterday Late')).toBeDefined()
    // Neither note leaks into the other's bucket.
    expect(within(todayGroup as HTMLElement).queryByText('Yesterday Late')).toBeNull()
    expect(within(yesterdayGroup as HTMLElement).queryByText('Today Early')).toBeNull()
  })

  test('drops a note with a non-finite mtime instead of rendering an invalid date', () => {
    setSystemTime(new Date(2024, 0, 15, 12, 0, 0))
    const stale = note('c.md', 'Stale Bundle Note', Number.NaN)
    const fresh = note('d.md', 'Fresh Note', new Date(2024, 0, 15, 11, 0, 0).getTime())

    const index = buildIndex([stale, fresh])
    render(
      <MantineProvider>
        <VaultProvider index={index}>
          <VaultRecentPanel />
        </VaultProvider>
      </MantineProvider>,
    )

    expect(screen.getByText('Fresh Note')).toBeDefined()
    expect(screen.queryByText('Stale Bundle Note')).toBeNull()
  })
})

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000
const WEEK = 604_800_000

describe('shortRelative', () => {
  test('minutes: below one hour, floored at 1m for a near-zero delta', () => {
    expect(shortRelative(5 * MINUTE)).toBe('5m')
    expect(shortRelative(0)).toBe('1m')
  })

  test('hours: below one day', () => {
    expect(shortRelative(3 * HOUR)).toBe('3h')
  })

  test('days: below one week', () => {
    expect(shortRelative(3 * DAY)).toBe('3d')
  })

  test('weeks: one week and beyond', () => {
    expect(shortRelative(2 * WEEK)).toBe('2w')
  })
})

describe('metaFor', () => {
  test('within a year, delegates to the compact relative form', () => {
    const now = new Date(2024, 5, 15).getTime()
    expect(metaFor(now - 3 * HOUR, now)).toBe('3h')
  })

  test('past one year, falls back to an absolute d MMM yyyy date', () => {
    const now = new Date(2024, 5, 15).getTime()
    const at = new Date(2022, 0, 3).getTime()
    expect(metaFor(at, now)).toBe(
      new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(at)),
    )
  })
})
