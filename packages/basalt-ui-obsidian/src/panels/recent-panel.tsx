/**
 * `VaultRecentPanel` — two sources of "recent" behind one `SegmentedControl`: `Updated` (file
 * `mtime`, vault-wide) and `Viewed` (`useRecentlyViewed()`, this browser's own history). Both group
 * under the same sticky-header day buckets and share the same relative/absolute meta formatting —
 * `groupByBucket`/`metaFor` below don't know or care which source produced their input.
 *
 * Bucketing is by CALENDAR-DAY boundary in the local timezone (`startOfDay`), not a rolling 24h/48h
 * window — "yesterday at 23:00" must land in "Yesterday" even when it's 01:00 right now, which a
 * `now - at < 24h` check would get wrong (that delta is 2 hours, nowhere near a day).
 *
 * The compact `2h`/`3d`/`5w` relative form is hand-rolled arithmetic, not `Intl.RelativeTimeFormat`
 * — that API's shortest (`style: 'narrow'`) output is still a localized phrase (`'2 hr. ago'` in
 * `en`), never a bare unit letter, so it can't produce the format asked for here. `Intl.DateTimeFormat`
 * DOES earn its keep for the `d MMM yyyy` fallback past one year, where locale-correct month
 * abbreviation is exactly what it's for. Either way, no date library is added.
 */
import { useMemo, useState } from 'react'
import { SegmentedControl } from '@mantine/core'
import type { VaultNote } from 'obsidian-vault-core'
import { useVault } from '../context.js'
import { NoteRow } from './note-list.js'
import { useRecentlyViewed } from './use-recently-viewed.js'
import classes from './panel.module.css'

export type VaultRecentPanelProps = {
  readonly activePath?: string
  readonly onNavigate?: () => void
  /** Default 50. */
  readonly limit?: number
}

type Mode = 'updated' | 'viewed'
type Bucket = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Previous 30 days' | 'Older'
type BucketedItem = { readonly note: VaultNote; readonly at: number }
type BucketedGroup = { readonly bucket: Bucket; readonly items: readonly BucketedItem[] }

const BUCKET_ORDER: readonly Bucket[] = [
  'Today',
  'Yesterday',
  'Previous 7 days',
  'Previous 30 days',
  'Older',
]

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000
const WEEK = 604_800_000
const YEAR = 365 * DAY

function startOfDay(epochMs: number): number {
  const date = new Date(epochMs)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function bucketFor(at: number, now: number): Bucket {
  const diffDays = Math.round((startOfDay(now) - startOfDay(at)) / DAY)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return 'Previous 7 days'
  if (diffDays <= 30) return 'Previous 30 days'
  return 'Older'
}

function groupByBucket(items: readonly BucketedItem[], now: number): BucketedGroup[] {
  const byBucket = new Map<Bucket, BucketedItem[]>()
  for (const item of items) {
    const bucket = bucketFor(item.at, now)
    const list = byBucket.get(bucket)
    if (list === undefined) byBucket.set(bucket, [item])
    else list.push(item)
  }
  return BUCKET_ORDER.filter((bucket) => byBucket.has(bucket)).map((bucket) => ({
    bucket,
    items: byBucket.get(bucket) ?? [],
  }))
}

/** Exported for `panels-recent-panel.test.tsx` — the m/h/d/w branches have no UI proof otherwise. */
export function shortRelative(deltaMs: number): string {
  const clamped = Math.max(0, deltaMs)
  if (clamped < HOUR) return `${Math.max(1, Math.round(clamped / MINUTE))}m`
  if (clamped < DAY) return `${Math.round(clamped / HOUR)}h`
  if (clamped < WEEK) return `${Math.round(clamped / DAY)}d`
  return `${Math.round(clamped / WEEK)}w`
}

const absoluteDateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Exported for `panels-recent-panel.test.tsx` — the past-one-year absolute-date fallback has no UI
 * proof otherwise. */
export function metaFor(at: number, now: number): string {
  const delta = now - at
  return delta < YEAR ? shortRelative(delta) : absoluteDateFormat.format(new Date(at))
}

export function VaultRecentPanel({ activePath, onNavigate, limit = 50 }: VaultRecentPanelProps) {
  const { index } = useVault()
  const recentlyViewed = useRecentlyViewed()
  const [mode, setMode] = useState<Mode>('updated')

  const groups = useMemo(() => {
    const now = Date.now()
    if (mode === 'updated') {
      // `fromVaultBundle` now backfills a missing `mtime` to 0 on rehydration, so this filter is
      // belt-and-braces rather than the only defence — kept anyway as a second line of defence
      // against a non-finite value ever reaching `Date` formatting downstream.
      const items: BucketedItem[] = index.notes
        .filter((note) => Number.isFinite(note.mtime))
        .toSorted((a, b) => b.mtime - a.mtime)
        .slice(0, limit)
        .map((note) => ({ note, at: note.mtime }))
      return groupByBucket(items, now)
    }
    const items: BucketedItem[] = recentlyViewed
      .toSorted((a, b) => b.at - a.at)
      .slice(0, limit)
      .map((view) => ({ note: index.byPath.get(view.path), at: view.at }))
      .filter((item): item is BucketedItem => item.note !== undefined)
    return groupByBucket(items, now)
  }, [mode, index, recentlyViewed, limit])

  return (
    <div>
      <div style={{ padding: '4px 8px' }}>
        <SegmentedControl
          size="xs"
          fullWidth
          value={mode}
          onChange={(value) => setMode(value as Mode)}
          data={[
            { label: 'Updated', value: 'updated' },
            { label: 'Viewed', value: 'viewed' },
          ]}
        />
      </div>
      {groups.length === 0 ? (
        <div className={classes.emptyLabel}>
          {mode === 'updated' ? 'No notes.' : 'No notes viewed yet.'}
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.bucket}>
            <div className={classes.sectionHeader}>{group.bucket}</div>
            <div role="list">
              {group.items.map(({ note, at }) => (
                <NoteRow
                  key={note.path}
                  note={note}
                  active={note.path === activePath}
                  meta={metaFor(at, Date.now())}
                  {...(onNavigate !== undefined && { onNavigate })}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
