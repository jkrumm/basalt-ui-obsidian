/**
 * `renderVaultIcon` — the demo's `VaultProvider.renderIcon` implementation. Iconize names a node
 * with its own `Li` (Lucide) prefix, e.g. `LiCamera`; stripping that prefix leaves exactly the
 * PascalCase name `lucide-react` exports the matching component under. A static lookup object over
 * only the icon names actually used in the brain vault's `data.json` — not a dynamic import loader —
 * is deliberate: this is a fixed, small set, and a dynamic loader would trade a lookup-table lookup
 * for an async boundary this component doesn't need. An unrecognized name (a typo, a name not yet
 * added here, or `Gamepad2` vs `Gamepad` picking the wrong one) renders nothing rather than
 * crashing — same "absent icon degrades to no icon" contract `VaultProvider.renderIcon` documents.
 *
 * `renderVaultChevron` — the demo's `VaultProvider.renderChevron` implementation. `VaultNav` stays
 * icon-library-free on its own (a small inline SVG default), but this app already depends on
 * `lucide-react` for every other icon, so it exercises the seam with a real one rather than leaving
 * the package default in place. Rotation on expand is `VaultNav`'s own concern — this only draws the
 * resting, right-pointing glyph.
 */
import {
  Book,
  Brain,
  Camera,
  ChevronRight,
  Gamepad,
  Hammer,
  Heart,
  Inbox,
  Lightbulb,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const LUCIDE_PREFIX = 'Li'

/** Only the names present in the brain vault's `.obsidian/plugins/obsidian-icon-folder/data.json`. */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  Inbox,
  Hammer,
  Lightbulb,
  Brain,
  Heart,
  Camera,
  Book,
  Gamepad,
}

export function renderVaultIcon(iconName: string) {
  const name = iconName.startsWith(LUCIDE_PREFIX) ? iconName.slice(LUCIDE_PREFIX.length) : iconName
  const Icon = ICONS[name]
  if (Icon === undefined) return null
  return <Icon size={14} aria-hidden="true" />
}

export function renderVaultChevron() {
  return <ChevronRight size={10} aria-hidden="true" />
}
